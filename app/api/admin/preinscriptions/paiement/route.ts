// app/api/admin/preinscriptions/paiement/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ⭐ Fonction pour générer le numéro de reçu
async function generateRecuNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { preinscriptionId, montant, modePaiement, reference } = body;

    if (!preinscriptionId || !montant || !modePaiement) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    // ⭐ Récupérer les informations complètes de la pré-inscription
    const preinscriptionResult = await query(`
      SELECT 
        p.id,
        p.montant_total_plan,
        p.montant_restant_plan,
        p.frais_statut,
        p.parent_id,
        p.enfant_nom,
        p.enfant_prenom,
        p.classe,
        u.nom as parent_nom,
        u.prenom as parent_prenom,
        u.email as parent_email,
        u.telephone as parent_telephone
      FROM preinscriptions p
      JOIN parents pa ON p.parent_id = pa.id
      JOIN utilisateurs u ON pa.utilisateur_id = u.id
      WHERE p.id = $1
    `, [preinscriptionId]);

    if (preinscriptionResult.rows.length === 0) {
      return NextResponse.json({ error: "Pré-inscription non trouvée" }, { status: 404 });
    }

    const preinscription = preinscriptionResult.rows[0];
    const montantTotal = Number(preinscription.montant_total_plan) || 0;
    const montantRestant = Number(preinscription.montant_restant_plan) || 0;

    // Vérifier que le montant ne dépasse pas le restant
    if (montant > montantRestant) {
      return NextResponse.json({ 
        error: `Le montant (${montant.toLocaleString()} GNF) dépasse le solde restant (${montantRestant.toLocaleString()} GNF)` 
      }, { status: 400 });
    }

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Calculer le nouveau restant
      const nouveauRestant = montantRestant - montant;
      const nouveauStatut = nouveauRestant === 0 ? 'paye' : 'partiel';

      // 2. Mettre à jour la pré-inscription
      const updateResult = await query(`
        UPDATE preinscriptions 
        SET 
          frais_montant = COALESCE(frais_montant, 0) + $1,
          montant_restant_plan = $2,
          frais_statut = $3,
          frais_mode_paiement = $4,
          frais_reference = $5,
          frais_date_paiement = NOW()
        WHERE id = $6 
        RETURNING *
      `, [montant, nouveauRestant, nouveauStatut, modePaiement, reference || null, preinscriptionId]);

      // 3. Insérer le paiement dans la table paiements
      const paiementResult = await query(`
        INSERT INTO paiements (
          preinscription_id,
          montant,
          type_frais,
          mode_paiement,
          reference_transaction,
          statut,
          date_paiement,
          mois,
          annee,
          saisie_par
        ) VALUES (
          $1,
          $2,
          'inscription',
          $3,
          $4,
          'valide',
          CURRENT_DATE,
          EXTRACT(MONTH FROM CURRENT_DATE),
          EXTRACT(YEAR FROM CURRENT_DATE),
          $5
        )
        RETURNING id, date_paiement
      `, [
        preinscriptionId,
        montant,
        modePaiement,
        reference || null,
        parseInt((session.user as any).id)
      ]);

      const paiement = paiementResult.rows[0];

      // 4. ⭐⭐⭐ GÉNÉRER LE REÇU ⭐⭐⭐
      const numeroRecu = await generateRecuNumber();

      // Vérifier les colonnes de la table recus
      const columnsResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'recus'
      `);
      const columnNames = columnsResult.rows.map((r: any) => r.column_name);

      // Construire la requête d'insertion
      let recuQuery = `
        INSERT INTO recus (
          numero_recu,
          paiement_id,
          preinscription_id,
          enfant_nom,
          parent_nom,
          montant,
          type_frais,
          mode_paiement,
          date_paiement,
          reference,
          source
      `;

      if (columnNames.includes('montant_total')) {
        recuQuery += `, montant_total`;
      }
      if (columnNames.includes('reste_a_payer')) {
        recuQuery += `, reste_a_payer`;
      }
      if (columnNames.includes('classe_nom')) {
        recuQuery += `, classe_nom`;
      }
      if (columnNames.includes('eleve_id')) {
        recuQuery += `, eleve_id`;
      }

      recuQuery += `) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11`;

      if (columnNames.includes('montant_total')) {
        recuQuery += `, $12`;
      }
      if (columnNames.includes('reste_a_payer')) {
        recuQuery += `, $13`;
      }
      if (columnNames.includes('classe_nom')) {
        recuQuery += `, $14`;
      }
      if (columnNames.includes('eleve_id')) {
        recuQuery += `, $15`;
      }

      recuQuery += `) RETURNING *`;

      const recuParams = [
        numeroRecu,
        paiement.id,
        preinscriptionId,
        `${preinscription.enfant_prenom || ''} ${preinscription.enfant_nom || ''}`.trim(),
        `${preinscription.parent_prenom || ''} ${preinscription.parent_nom || ''}`.trim(),
        montant,
        'inscription',
        modePaiement,
        paiement.date_paiement,
        reference || `ADM-${preinscriptionId}-${Date.now().toString().slice(-6)}`,
        'admin_preinscription'
      ];

      if (columnNames.includes('montant_total')) {
        recuParams.push(montantTotal);
      }
      if (columnNames.includes('reste_a_payer')) {
        recuParams.push(nouveauRestant);
      }
      if (columnNames.includes('classe_nom')) {
        recuParams.push(preinscription.classe || '');
      }
      if (columnNames.includes('eleve_id')) {
        recuParams.push(null);
      }

      const recuResult = await query(recuQuery, recuParams);
      const recu = recuResult.rows[0];

      console.log(`✅ Paiement ADMIN de ${montant} GNF enregistré pour la pré-inscription ${preinscriptionId}`);
      console.log(`📊 Nouveau restant: ${nouveauRestant} GNF, Statut: ${nouveauStatut}`);
      console.log(`🧾 Reçu généré: ${numeroRecu}`);

      await query('COMMIT');

      // ⭐ FORMATER LA RÉPONSE AVEC LE REÇU
      const recuData = {
        numero_recu: recu.numero_recu,
        date_paiement: recu.date_paiement.toISOString(),
        enfant: recu.enfant_nom || `${preinscription.enfant_prenom} ${preinscription.enfant_nom}`,
        montant: Number(recu.montant),
        mode_paiement: recu.mode_paiement,
        type_frais: recu.type_frais || 'inscription',
        reference: recu.reference || reference || `ADM-${preinscriptionId}`,
        classe: recu.classe_nom || preinscription.classe || '',
        parent_nom: recu.parent_nom || '',
        parent_email: preinscription.parent_email || '',
        source: recu.source || 'admin_preinscription',
        montant_total: Number(recu.montant_total || montantTotal || 0),
        reste_a_payer: Number(recu.reste_a_payer || nouveauRestant || 0),
        preinscription_id: preinscriptionId,
        paiement_id: paiement.id
      };

      return NextResponse.json({ 
        success: true, 
        message: `Paiement de ${montant.toLocaleString()} GNF enregistré avec succès`,
        data: updateResult.rows[0],
        recu: recuData,
        numero_recu: recu.numero_recu
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Erreur paiement admin:", error);
    return NextResponse.json({ 
      error: "Erreur serveur: " + (error as Error).message 
    }, { status: 500 });
  }
}