// app/api/parent/paiement-libre/route.ts

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
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "PARENT" && userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { preinscriptionId, montant, modePaiement, reference, type } = body;

    if (!preinscriptionId || !montant || montant <= 0 || !modePaiement) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    // Récupérer l'ID de l'utilisateur connecté
    const userResult = await query(`
      SELECT id FROM utilisateurs WHERE email = $1
    `, [session.user.email]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // ⭐ Récupérer la pré-inscription avec les infos de l'élève et du parent
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

    // Vérifier les droits
    if (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE") {
      const parentCheck = await query(`
        SELECT p.id 
        FROM parents p
        WHERE p.id = $1 AND p.utilisateur_id = $2
      `, [preinscription.parent_id, userId]);

      if (parentCheck.rows.length === 0) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }
    }

    if (montant > montantRestant) {
      return NextResponse.json({ 
        error: `Le montant (${montant.toLocaleString()} GNF) dépasse le solde restant (${montantRestant.toLocaleString()} GNF)` 
      }, { status: 400 });
    }

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Mettre à jour le montant restant
      const nouveauRestant = montantRestant - montant;
      await query(`
        UPDATE preinscriptions 
        SET montant_restant_plan = $1
        WHERE id = $2
      `, [nouveauRestant, preinscriptionId]);

      // 2. Mettre à jour le statut
      let nouveauStatut = 'partiel';
      if (nouveauRestant === 0) {
        nouveauStatut = 'paye';
      }
      
      await query(`
        UPDATE preinscriptions 
        SET frais_statut = $1
        WHERE id = $2
      `, [nouveauStatut, preinscriptionId]);

      // 3. Insérer le paiement avec retour de l'ID
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
      `, [preinscriptionId, montant, modePaiement, reference || null, userId]);

      const paiement = paiementResult.rows[0];

      // 4. ⭐⭐⭐ GÉNÉRER LE REÇU AVEC MONTANT TOTAL ET RESTANT ⭐⭐⭐
      const numeroRecu = await generateRecuNumber();

      const recuResult = await query(`
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
          source,
          montant_total,
          reste_a_payer,
          eleve_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        numeroRecu,
        paiement.id,
        preinscriptionId,
        `${preinscription.enfant_prenom || ''} ${preinscription.enfant_nom || ''}`.trim(),
        `${preinscription.parent_prenom || ''} ${preinscription.parent_nom || ''}`.trim(),
        montant,
        'inscription',
        modePaiement,
        paiement.date_paiement,
        `PRE-${preinscriptionId}-${Date.now().toString().slice(-6)}`,
        'preinscription',
        montantTotal,
        nouveauRestant,
        null // eleve_id (pas encore créé)
      ]);

      const recu = recuResult.rows[0];

      console.log(`✅ Paiement de ${montant} GNF enregistré pour la pré-inscription ${preinscriptionId}`);
      console.log(`📊 Nouveau restant: ${nouveauRestant} GNF, Statut: ${nouveauStatut}`);
      console.log(`🧾 Reçu généré: ${numeroRecu}`);

      await query('COMMIT');

      // ⭐ FORMATER LA RÉPONSE AVEC TOUTES LES DONNÉES DU REÇU
      const recuData = {
        numero_recu: recu.numero_recu,
        date_paiement: recu.date_paiement.toISOString(),
        enfant: recu.enfant_nom || `${preinscription.enfant_prenom} ${preinscription.enfant_nom}`,
        montant: Number(recu.montant),
        mode_paiement: recu.mode_paiement,
        type_frais: recu.type_frais || 'inscription',
        reference: recu.reference || `PRE-${preinscriptionId}`,
        classe: preinscription.classe || '',
        parent_nom: recu.parent_nom || '',
        parent_email: preinscription.parent_email || '',
        source: recu.source || 'preinscription',
        // ⭐ CHAMPS IMPORTANTS POUR L'AFFICHAGE
        montant_total: Number(recu.montant_total || montantTotal || 0),
        reste_a_payer: Number(recu.reste_a_payer || nouveauRestant || 0),
        preinscription_id: preinscriptionId,
        paiement_id: paiement.id
      };

      return NextResponse.json({
        success: true,
        message: `Paiement de ${montant.toLocaleString()} GNF effectué avec succès`,
        montant_paye: montant,
        restant: nouveauRestant,
        statut: nouveauStatut,
        est_termine: nouveauRestant === 0,
        recu: recuData,
        numero_recu: recu.numero_recu
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Erreur paiement libre:", error);
    return NextResponse.json({ 
      error: "Erreur serveur: " + (error as Error).message 
    }, { status: 500 });
  }
}