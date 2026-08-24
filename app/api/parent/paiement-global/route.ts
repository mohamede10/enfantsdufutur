// app/api/parent/paiement-global/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const body = await request.json();
    const { montant, modePaiement, reference, parentId } = body;

    if (!montant || montant <= 0 || !modePaiement) {
      return NextResponse.json({ error: "Données incomplètes ou invalides" }, { status: 400 });
    }

    let targetParentId = parentId;

    if (!targetParentId) {
      // Si aucun parentId n'est fourni, on cherche le parent lié à l'utilisateur connecté
      const parentResult = await query(`
        SELECT p.id 
        FROM parents p 
        JOIN utilisateurs u ON p.utilisateur_id = u.id 
        WHERE u.email = $1
      `, [session.user?.email]);

      if (parentResult.rows.length === 0) {
        return NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 });
      }
      targetParentId = parentResult.rows[0].id;
    } else {
      // Vérifier l'autorisation si parentId est fourni
      if (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }
    }

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Récupérer toutes les pré-inscriptions avec un solde > 0
      const preinscriptionsResult = await query(`
        SELECT id, montant_restant_plan 
        FROM preinscriptions 
        WHERE parent_id = $1 AND montant_restant_plan > 0 AND statut != 'rejete'
        ORDER BY date_preinscription ASC
      `, [targetParentId]);

      // 2. Récupérer toutes les réinscriptions avec un solde > 0
      const reinscriptionsResult = await query(`
        SELECT id, montant_restant_plan 
        FROM reinscriptions 
        WHERE parent_id = $1 AND montant_restant_plan > 0 AND statut != 'rejete'
        ORDER BY date_reinscription ASC
      `, [targetParentId]);

      let montantRestantDistribuer = montant;
      const paiementsEffectues = [];

      // Fonction d'aide pour traiter un lot de dossiers (pré-inscriptions ou réinscriptions)
      const processDossiers = async (dossiers: any[], type: 'preinscription' | 'reinscription') => {
        for (const dossier of dossiers) {
          if (montantRestantDistribuer <= 0) break;

          const detteDossier = Number(dossier.montant_restant_plan);
          const montantImpute = Math.min(montantRestantDistribuer, detteDossier);
          
          const nouveauRestant = detteDossier - montantImpute;
          const nouveauStatut = nouveauRestant === 0 ? 'paye' : 'partiel';

          if (type === 'preinscription') {
            await query(`UPDATE preinscriptions SET montant_restant_plan = $1, frais_statut = $2 WHERE id = $3`, [nouveauRestant, nouveauStatut, dossier.id]);
            await query(`
              INSERT INTO paiements (
                preinscription_id, montant, type_frais, mode_paiement, reference_transaction, statut, date_paiement, mois, annee, saisie_par
              ) VALUES ($1, $2, 'inscription', $3, $4, 'valide', CURRENT_DATE, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), $5)
            `, [dossier.id, montantImpute, modePaiement, reference || null, (session.user as any).id || null]);
          } else {
            await query(`UPDATE reinscriptions SET montant_restant_plan = $1, frais_statut = $2 WHERE id = $3`, [nouveauRestant, nouveauStatut, dossier.id]);
            await query(`
              INSERT INTO paiements (
                reinscription_id, montant, type_frais, mode_paiement, reference_transaction, statut, date_paiement, mois, annee, saisie_par
              ) VALUES ($1, $2, 'reinscription', $3, $4, 'valide', CURRENT_DATE, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), $5)
            `, [dossier.id, montantImpute, modePaiement, reference || null, (session.user as any).id || null]);
          }

          montantRestantDistribuer -= montantImpute;
          paiementsEffectues.push({ type, id: dossier.id, montant: montantImpute });
        }
      };

      // Prioriser les pré-inscriptions puis les réinscriptions
      await processDossiers(preinscriptionsResult.rows, 'preinscription');
      await processDossiers(reinscriptionsResult.rows, 'reinscription');

      // 3. Si du montant reste à distribuer, imputer sur les élèves directement
      if (montantRestantDistribuer > 0) {
        const elevesResult = await query(`
          SELECT e.id 
          FROM eleves e
          JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
          WHERE lpe.parent_id = $1 AND e.deleted_at IS NULL
          ORDER BY e.id ASC
        `, [targetParentId]);

        if (elevesResult.rows.length > 0) {
          const partParEleve = Math.floor(montantRestantDistribuer / elevesResult.rows.length);
          let resteAImputer = montantRestantDistribuer;

          for (let i = 0; i < elevesResult.rows.length; i++) {
            const eleve = elevesResult.rows[i];
            const montantEleve = (i === elevesResult.rows.length - 1) ? resteAImputer : partParEleve;
            
            if (montantEleve > 0) {
              await query(`
                INSERT INTO paiements (
                  eleve_id, montant, type_frais, mode_paiement, reference_transaction, statut, date_paiement, mois, annee, saisie_par
                ) VALUES ($1, $2, 'scolarite', $3, $4, 'valide', CURRENT_DATE, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), $5)
              `, [eleve.id, montantEleve, modePaiement, reference || null, (session.user as any).id || null]);
              
              paiementsEffectues.push({ type: 'eleve', id: eleve.id, montant: montantEleve });
              resteAImputer -= montantEleve;
            }
          }
          montantRestantDistribuer = 0;
        }
      }

      if (montantRestantDistribuer > 0) {
        throw new Error(`Le montant saisi (${montant} GNF) dépasse le solde total dû.`);
      }

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Paiement global de ${montant.toLocaleString()} GNF effectué et réparti avec succès.`,
        details: paiementsEffectues
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Erreur paiement global:", error);
    return NextResponse.json({ 
      error: "Erreur serveur: " + (error as Error).message 
    }, { status: 500 });
  }
}
