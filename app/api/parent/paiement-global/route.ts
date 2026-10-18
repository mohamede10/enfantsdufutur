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
    const { montant, modePaiement, reference, parentId: requestedParentId } = body;

    let parentId: number | null = null;

    if (userRole === "SUPER_ADMIN" || userRole === "COMPTABLE" || userRole === "DIRECTEUR_GENERAL") {
      if (requestedParentId) {
        parentId = parseInt(requestedParentId);
      }
    }

    if (!parentId) {
      const parentCheck = await query(
        `SELECT p.id FROM parents p JOIN utilisateurs u ON p.utilisateur_id = u.id WHERE u.email = $1`,
        [session.user?.email]
      );
      if (parentCheck.rows.length > 0) {
        parentId = parentCheck.rows[0].id;
      }
    }

    if (!parentId) {
      return NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 });
    }

    const montantTotal = Number(montant);
    if (!montantTotal || montantTotal <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    if (!modePaiement) {
      return NextResponse.json({ error: "Mode de paiement requis" }, { status: 400 });
    }

    const userId = (session.user as any).id || null;

    await query('BEGIN');

    try {
      let restantADistribuer = montantTotal;

      // ======================================================
      // 1. Récupérer TOUTES les échéances impayées (FIFO)
      //    pour toutes les préinscriptions/réinscriptions du parent
      // ======================================================
      const echeancesResult = await query(`
        SELECT 
          ep.id,
          ep.echeance,
          ep.type,
          ep.montant,
          ep.statut,
          ep.date_echeance,
          ep.preinscription_id,
          ep.reinscription_id,
          COALESCE(pre.enfant_prenom || ' ' || pre.enfant_nom, rein.enfant_prenom || ' ' || rein.enfant_nom) as enfant_nom
        FROM echeances_paiement ep
        LEFT JOIN preinscriptions pre ON ep.preinscription_id = pre.id
        LEFT JOIN reinscriptions rein ON ep.reinscription_id = rein.id
        WHERE ep.statut IN ('en_attente', 'partiel')
          AND (
            ep.preinscription_id IN (
              SELECT id FROM preinscriptions WHERE parent_id = $1 AND statut IN ('en_attente', 'valide', 'partiel')
            )
            OR ep.reinscription_id IN (
              SELECT id FROM reinscriptions WHERE parent_id = $1 AND statut IN ('en_attente', 'valide', 'partiel')
            )
          )
        ORDER BY ep.date_echeance ASC NULLS LAST, ep.id ASC
      `, [parentId]);

      const echeances = echeancesResult.rows;

      // FIFO : distribuer le montant sur les échéances dans l'ordre chronologique
      const echeancesPayees: number[] = [];
      const echeancesPartielles: { id: number; montantPaye: number }[] = [];

      for (const ech of echeances) {
        if (restantADistribuer <= 0) break;

        const montantEcheance = Number(ech.montant) || 0;
        if (montantEcheance <= 0) continue;

        const montantApplique = Math.min(restantADistribuer, montantEcheance);
        const nouveauStatut = montantApplique >= montantEcheance ? 'paye' : 'partiel';

        // Insérer un paiement pour cette échéance
        const paiRef = reference || `GLB-ECH-${ech.id}`;
        await query(`
          INSERT INTO paiements (
            preinscription_id,
            reinscription_id,
            montant,
            type_frais,
            mode_paiement,
            reference_transaction,
            statut,
            date_paiement,
            mois,
            annee,
            saisie_par
          ) VALUES ($1, $2, $3, $4, $5, $6, 'valide', CURRENT_DATE,
            EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), $7)
        `, [
          ech.preinscription_id || null,
          ech.reinscription_id || null,
          montantApplique,
          ech.type || 'inscription',
          modePaiement,
          paiRef,
          userId
        ]);

        // Mettre à jour le statut de l'échéance
        if (nouveauStatut === 'paye') {
          await query(`
            UPDATE echeances_paiement 
            SET statut = 'paye',
                date_paiement = CURRENT_DATE,
                reference_transaction = $2,
                mode_paiement = $3,
                updated_at = NOW()
            WHERE id = $1
          `, [ech.id, paiRef, modePaiement]);
          echeancesPayees.push(ech.id);
        } else {
          // Partiel : réduire le montant restant de l'échéance
          await query(`
            UPDATE echeances_paiement 
            SET statut = 'partiel',
                montant = montant - $2,
                updated_at = NOW()
            WHERE id = $1
          `, [ech.id, montantApplique]);
          echeancesPartielles.push({ id: ech.id, montantPaye: montantApplique });
        }

        restantADistribuer -= montantApplique;
      }

      // ======================================================
      // 2. Si surplus (plus que toutes les échéances), enregistrer comme avance
      // ======================================================
      if (restantADistribuer > 0) {
        const preCheck = await query(`
          SELECT id FROM preinscriptions 
          WHERE parent_id = $1 AND statut IN ('en_attente', 'valide', 'partiel')
          ORDER BY id DESC LIMIT 1
        `, [parentId]);

        const reinCheck = await query(`
          SELECT id FROM reinscriptions
          WHERE parent_id = $1 AND statut IN ('en_attente', 'valide', 'partiel')
          ORDER BY id DESC LIMIT 1
        `, [parentId]);

        const preinscriptionId = preCheck.rows[0]?.id || null;
        const reinscriptionId = !preinscriptionId ? (reinCheck.rows[0]?.id || null) : null;

        const eleveCheck = await query(`
          SELECT e.id as eleve_id FROM eleves e
          JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
          WHERE lpe.parent_id = $1 LIMIT 1
        `, [parentId]);
        const eleveId = eleveCheck.rows[0]?.eleve_id || null;

        await query(`
          INSERT INTO paiements (
            preinscription_id, reinscription_id, eleve_id,
            montant, type_frais, mode_paiement, reference_transaction,
            statut, date_paiement, mois, annee, saisie_par
          ) VALUES ($1, $2, $3, $4, 'scolarite', $5, $6, 'valide', CURRENT_DATE,
            EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), $7)
        `, [
          preinscriptionId,
          reinscriptionId,
          eleveId,
          restantADistribuer,
          modePaiement,
          reference || `GLB-EXTRA-${parentId}`,
          userId
        ]);
      }

      // ======================================================
      // 3. Mettre à jour le statut des preinscriptions/réinscriptions
      // ======================================================
      const preinscriptionIds = [...new Set(echeances
        .filter((e: any) => e.preinscription_id)
        .map((e: any) => Number(e.preinscription_id))
      )];

      for (const preId of preinscriptionIds) {
        const restantRes = await query(`
          SELECT COUNT(*) as nb_restant,
            COALESCE(SUM(montant), 0) as montant_restant
          FROM echeances_paiement 
          WHERE preinscription_id = $1 AND statut IN ('en_attente', 'partiel')
        `, [preId]);

        const nbRestant = Number(restantRes.rows[0]?.nb_restant) || 0;
        const montantRestant = Number(restantRes.rows[0]?.montant_restant) || 0;

        await query(`
          UPDATE preinscriptions
          SET montant_restant_plan = $1,
              frais_statut = CASE WHEN $2 = 0 THEN 'paye' ELSE 'partiel' END,
              updated_at = NOW()
          WHERE id = $3
        `, [montantRestant, nbRestant, preId]);
      }

      const reinscriptionIds = [...new Set(echeances
        .filter((e: any) => e.reinscription_id)
        .map((e: any) => Number(e.reinscription_id))
      )];

      for (const reinId of reinscriptionIds) {
        const restantRes = await query(`
          SELECT COUNT(*) as nb_restant,
            COALESCE(SUM(montant), 0) as montant_restant
          FROM echeances_paiement 
          WHERE reinscription_id = $1 AND statut IN ('en_attente', 'partiel')
        `, [reinId]);

        const nbRestant = Number(restantRes.rows[0]?.nb_restant) || 0;
        const montantRestant = Number(restantRes.rows[0]?.montant_restant) || 0;

        await query(`
          UPDATE reinscriptions
          SET montant_restant_plan = $1,
              frais_statut = CASE WHEN $2 = 0 THEN 'paye' ELSE 'partiel' END,
              updated_at = NOW()
          WHERE id = $3
        `, [montantRestant, nbRestant, reinId]);
      }

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Paiement global de ${montantTotal.toLocaleString()} GNF enregistré avec succès`,
        echeancesPayees: echeancesPayees.length,
        echeancesPartielles: echeancesPartielles.length,
        surplus: restantADistribuer > 0 ? restantADistribuer : 0
      });

    } catch (error) {
      await query('ROLLBACK');
      console.error("Erreur transaction paiement global:", error);
      throw error;
    }
  } catch (error) {
    console.error("Erreur paiement global:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}
