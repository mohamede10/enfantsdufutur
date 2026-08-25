// app/api/admin/cantine/inscrire/route.ts
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
    const allowedRoles = ["SUPER_ADMIN", "COMPTABLE", "ADMIN_CANTINE"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { eleveId, mois, montantMensuel, montantTotal } = body;

    if (!eleveId || !mois || !montantMensuel) {
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

    const eleve = eleveCheck.rows[0];

    // Vérifier si l'élève est déjà inscrit
    const existingInscription = await query(`
      SELECT id FROM inscriptions_cantine 
      WHERE eleve_id = $1 AND est_actif = true
    `, [eleveId]);

    if (existingInscription.rows.length > 0) {
      return NextResponse.json({ 
        error: "Cet élève est déjà inscrit à la cantine" 
      }, { status: 400 });
    }

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Créer l'inscription
      const result = await query(`
        INSERT INTO inscriptions_cantine (
          eleve_id,
          est_actif,
          solde,
          date_inscription,
          mois_total,
          mois_restants,
          montant_mensuel,
          montant_total
        ) VALUES ($1, true, $2, NOW(), $3, $3, $4, $5)
        RETURNING id
      `, [eleveId, montantTotal, mois, montantMensuel, montantTotal]);

      const inscriptionId = result.rows[0].id;

      // 2. Créer le paiement
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
          'cantine',
          'especes',
          'valide',
          NOW(),
          EXTRACT(MONTH FROM NOW()),
          EXTRACT(YEAR FROM NOW()),
          $3
        )
      `, [eleveId, montantTotal, parseInt((session.user as any).id)]);

      // 3. Ajouter le menu cantine par défaut si besoin
      // Récupérer ou créer un menu cantine
      const menuResult = await query(`
        SELECT id FROM cantine_menus ORDER BY id DESC LIMIT 1
      `);

      if (menuResult.rows.length > 0) {
        const menuId = menuResult.rows[0].id;
        // Ajouter l'élève au menu du jour
        await query(`
          INSERT INTO reserves_cantine (eleve_id, date, est_present, date_reservation)
          VALUES ($1, CURRENT_DATE, true, CURRENT_DATE)
        `, [eleveId]);
      }

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `${eleve.prenom} ${eleve.nom} inscrit à la cantine pour ${mois} mois`,
        inscriptionId: inscriptionId
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Erreur inscription cantine:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}