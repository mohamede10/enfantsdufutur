// app/api/admin/transport/inscrire/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const allowedRoles = ["SUPER_ADMIN", "COMPTABLE", "ADMIN_TRANSPORT"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { eleveId, ligneId, mois, montantMensuel } = body;

    if (!eleveId || !ligneId || !mois || !montantMensuel) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    // Vérifier que l'élève existe
    const eleveCheck = await query(`
      SELECT e.id, u.nom, u.prenom, c.nom as classe_nom
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      WHERE e.id = $1
    `, [eleveId]);

    if (eleveCheck.rows.length === 0) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    // Vérifier que la ligne existe
    const ligneCheck = await query(`
      SELECT id, prix_abonnement FROM lignes_transport WHERE id = $1
    `, [ligneId]);

    if (ligneCheck.rows.length === 0) {
      return NextResponse.json({ error: "Ligne de transport non trouvée" }, { status: 404 });
    }

    const prixMensuel = montantMensuel || ligneCheck.rows[0].prix_abonnement || 0;
    const moisInt = parseInt(mois);
    const total = prixMensuel * moisInt;

    // Vérifier si l'élève est déjà inscrit activement
    const existing = await query(`
      SELECT id FROM inscriptions_transport 
      WHERE eleve_id = $1 AND est_actif = true
    `, [eleveId]);

    if (existing.rows.length > 0) {
      return NextResponse.json({ 
        error: "Cet élève est déjà inscrit au transport" 
      }, { status: 400 });
    }

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // Créer l'inscription
      const result = await query(`
        INSERT INTO inscriptions_transport (
          eleve_id,
          ligne_id,
          est_actif,
          solde,
          date_inscription,
          mois_total,
          mois_restants,
          montant_mensuel,
          montant_total
        ) VALUES ($1, $2, true, $3, NOW(), $4, $4, $5, $6)
        RETURNING id
      `, [eleveId, ligneId, total, moisInt, prixMensuel, total]);

      const inscriptionId = result.rows[0].id;

      // Créer le paiement
      await query(`
        INSERT INTO paiements (
          eleve_id,
          montant,
          type_frais,
          mode_paiement,
          statut,
          date_paiement,
          mois,
          annee,
          saisie_par
        ) VALUES (
          $1,
          $2,
          'transport',
          'especes',
          'valide',
          NOW(),
          EXTRACT(MONTH FROM NOW()),
          EXTRACT(YEAR FROM NOW()),
          $3
        )
      `, [eleveId, total, parseInt((session.user as any).id)]);

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `${eleveCheck.rows[0].prenom} ${eleveCheck.rows[0].nom} inscrit au transport pour ${moisInt} mois`,
        inscriptionId: inscriptionId
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Erreur inscription transport:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}