// app/api/paiements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Fonction pour générer le numéro de reçu
async function generateRecuNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Récupérer le dernier numéro de reçu
  const result = await query(`
    SELECT numero_recu FROM recus 
    WHERE numero_recu LIKE $1 
    ORDER BY id DESC LIMIT 1
  `, [`RECU-${year}${month}-%`]);

  if (result.rows.length === 0) {
    return `RECU-${year}${month}-0001`;
  }

  const lastNumber = result.rows[0].numero_recu;
  const sequence = parseInt(lastNumber.split('-')[2]) + 1;
  const paddedSequence = String(sequence).padStart(4, '0');
  
  return `RECU-${year}${month}-${paddedSequence}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eleveId = searchParams.get("eleveId");

  let paiements;
  if (eleveId) {
    paiements = await query(`
      SELECT 
        p.*,
        u.nom as enfant_nom,
        u.prenom as enfant_prenom,
        c.nom as classe_nom,
        pu.nom as parent_nom,
        pu.prenom as parent_prenom,
        r.numero_recu,
        r.id as recu_id
      FROM paiements p
      LEFT JOIN eleves e ON p.eleve_id = e.id
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      LEFT JOIN parents pa ON lpe.parent_id = pa.id
      LEFT JOIN utilisateurs pu ON pa.utilisateur_id = pu.id
      LEFT JOIN recus r ON p.id = r.paiement_id
      WHERE p.eleve_id = $1
      ORDER BY p.date_paiement DESC
    `, [parseInt(eleveId)]);
  } else {
    paiements = await query(`
      SELECT 
        p.*,
        u.nom as enfant_nom,
        u.prenom as enfant_prenom,
        c.nom as classe_nom,
        pu.nom as parent_nom,
        pu.prenom as parent_prenom,
        r.numero_recu,
        r.id as recu_id
      FROM paiements p
      LEFT JOIN eleves e ON p.eleve_id = e.id
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      LEFT JOIN parents pa ON lpe.parent_id = pa.id
      LEFT JOIN utilisateurs pu ON pa.utilisateur_id = pu.id
      LEFT JOIN recus r ON p.id = r.paiement_id
      ORDER BY p.date_paiement DESC
    `);
  }

  return NextResponse.json(paiements.rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  if (userRole !== "COMPTABLE" && userRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

   try {
    const body = await req.json();
    const { 
      eleveId, 
      montant, 
      typeFrais, 
      modePaiement, 
      referenceTransaction,
      preinscriptionId,
      reinscriptionId,
      mois,
      annee
    } = body;

    // Vérifier si l'élève existe
    const eleveCheck = await query(`
      SELECT 
        e.id,
        u.nom as enfant_nom,
        u.prenom as enfant_prenom,
        c.nom as classe_nom,
        c.frais_inscription as frais_total,  -- ⭐ Récupérer le montant total
        pu.nom as parent_nom,
        pu.prenom as parent_prenom,
        pu.email as parent_email,
        pu.telephone as parent_telephone
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      LEFT JOIN parents pa ON lpe.parent_id = pa.id
      LEFT JOIN utilisateurs pu ON pa.utilisateur_id = pu.id
      WHERE e.id = $1
    `, [eleveId]);

    if (eleveCheck.rows.length === 0) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const eleve = eleveCheck.rows[0];

    // ⭐ Récupérer le total déjà payé pour cet élève
    const totalPayeResult = await query(`
      SELECT COALESCE(SUM(montant), 0) as total_paye
      FROM paiements
      WHERE eleve_id = $1 AND statut = 'valide'
    `, [eleveId]);

    const totalDejaPaye = totalPayeResult.rows[0].total_paye || 0;
    const montantTotal = eleve.frais_total || 0;
    const nouveauTotalPaye = totalDejaPaye + montant;
    const resteApresPaiement = Math.max(0, montantTotal - nouveauTotalPaye);

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Créer le paiement
      const paiementResult = await query(`
        INSERT INTO paiements (
          eleve_id, montant, type_frais, mode_paiement, 
          reference_transaction, saisie_par, preinscription_id, reinscription_id,
          mois, annee, statut, date_paiement
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'valide', NOW())
        RETURNING id, date_paiement
      `, [
        eleveId, 
        montant, 
        typeFrais, 
        modePaiement, 
        referenceTransaction,
        parseInt((session.user as any).id),
        preinscriptionId || null,
        reinscriptionId || null,
        mois || null,
        annee || null
      ]);

      const paiement = paiementResult.rows[0];

      // 2. Générer le numéro de reçu
      const numeroRecu = await generateRecuNumber();

      // 3. Créer le reçu avec le montant total et le reste à payer
      const recuResult = await query(`
        INSERT INTO recus (
          numero_recu, paiement_id, eleve_id, preinscription_id, reinscription_id,
          enfant_nom, parent_nom, montant, type_frais, mode_paiement,
          date_paiement, reference, source,
          montant_total, reste_a_payer  -- ⭐ NOUVEAUX CHAMPS
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        numeroRecu,
        paiement.id,
        eleveId,
        preinscriptionId || null,
        reinscriptionId || null,
        `${eleve.enfant_prenom || ''} ${eleve.enfant_nom || ''}`.trim(),
        `${eleve.parent_prenom || ''} ${eleve.parent_nom || ''}`.trim(),
        montant,
        typeFrais,
        modePaiement,
        paiement.date_paiement,
        `PAY-${paiement.id}`,
        'paiement',
        montantTotal,        // ⭐ Montant total à payer
        resteApresPaiement   // ⭐ Reste à payer après ce paiement
      ]);

      await query('COMMIT');

      const recu = recuResult.rows[0];

      // Formater la réponse pour le composant RecuPaiement
      const recuData = {
        numero_recu: recu.numero_recu,
        date_paiement: recu.date_paiement.toISOString(),
        enfant: recu.enfant_nom || `${eleve.enfant_prenom} ${eleve.enfant_nom}`,
        montant: recu.montant,
        mode_paiement: recu.mode_paiement,
        type_frais: recu.type_frais,
        reference: recu.reference,
        classe: eleve.classe_nom || '',
        parent_nom: recu.parent_nom || '',
        parent_email: eleve.parent_email || '',
        source: recu.source || 'paiement',
        // ⭐ NOUVEAUX CHAMPS
        montant_total: Number(recu.montant_total) || 0,
        reste_a_payer: Number(recu.reste_a_payer) || 0
      };

      return NextResponse.json({
        success: true,
        paiement: paiement,
        recu: recuData,
        numero_recu: recu.numero_recu
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error("Erreur paiement:", error);
    return NextResponse.json(
      { error: "Erreur lors du paiement: " + (error as Error).message },
      { status: 500 }
    );
  }
}