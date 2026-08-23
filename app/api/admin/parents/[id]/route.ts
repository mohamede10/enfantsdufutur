// app/api/admin/parents/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ⭐ CORRECTION : Ajout de l'interface pour les params avec Promise
interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "SUPER_ADMIN" && role !== "DIRECTEUR_GENERAL" && role !== "COMPTABLE") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
    }

    // ⭐ CORRECTION : Déballer params avec await
    const { id } = await params;
    
    // ⭐ Vérifier que l'ID est valide
    const parentId = parseInt(id);
    
    // ⭐ Si l'ID n'est pas un nombre valide, retourner une erreur
    if (isNaN(parentId) || parentId <= 0) {
      return NextResponse.json(
        { error: "ID de parent invalide" },
        { status: 400 }
      );
    }

    // Récupérer le parent
    const parentResult = await query(`
      SELECT 
        p.id,
        p.utilisateur_id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.adresse,
        u.photo_url,
        p.profession,
        p.situation_matrimoniale,
        u.created_at,
        u.est_actif
      FROM parents p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      WHERE p.id = $1
    `, [parentId]);

    if (parentResult.rows.length === 0) {
      return NextResponse.json({ error: "Parent non trouvé" }, { status: 404 });
    }

    const parent = parentResult.rows[0];

    // Récupérer les enfants avec plus de détails
    const enfantsResult = await query(`
      SELECT 
        e.id,
        e.matricule,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.photo_url,
        e.date_naissance,
        e.lieu_naissance,
        e.sexe,
        e.date_inscription,
        e.est_inscrit,
        c.nom as classe_nom,
        c.niveau,
        c.id as classe_id,
        c.frais_inscription,
        l.lien as lien_parent
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      JOIN lien_parent_eleve l ON l.eleve_id = e.id
      WHERE l.parent_id = $1
      ORDER BY u.nom, u.prenom
    `, [parentId]);

    // Récupérer les pré-inscriptions du parent
    const preinscriptionsResult = await query(`
      SELECT 
        p.id,
        p.numero_dossier,
        p.enfant_nom,
        p.enfant_prenom,
        p.date_naissance,
        p.niveau,
        p.classe,
        p.statut,
        p.frais_statut,
        p.frais_montant,
        p.date_preinscription,
        p.montant_total_plan,
        p.montant_restant_plan
      FROM preinscriptions p
      WHERE p.parent_id = $1
      ORDER BY p.date_preinscription DESC
    `, [parentId]);

    return NextResponse.json({
      ...parent,
      situation_matrimoniale: parent.situation_matrimoniale
        ? (typeof parent.situation_matrimoniale === 'string'
            ? JSON.parse(parent.situation_matrimoniale)
            : parent.situation_matrimoniale)
        : null,
      enfants: enfantsResult.rows || [],
      preinscriptions: preinscriptionsResult.rows || [],
    });
  } catch (error) {
    console.error("Erreur récupération parent:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ⭐ MÉTHODE DELETE - Supprimer un parent et tous ses enfants
export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const role = (session.user as any).role;
    // Seuls SUPER_ADMIN et DIRECTEUR_GENERAL peuvent supprimer
    if (role !== "SUPER_ADMIN" && role !== "DIRECTEUR_GENERAL") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
    }

    const { id } = await params;
    const parentId = parseInt(id);

    if (isNaN(parentId) || parentId <= 0) {
      return NextResponse.json(
        { error: "ID de parent invalide" },
        { status: 400 }
      );
    }

    // Vérifier que le parent existe
    const parentCheck = await query(`
      SELECT 
        p.id, 
        p.utilisateur_id,
        u.nom,
        u.prenom,
        u.email
      FROM parents p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      WHERE p.id = $1
    `, [parentId]);

    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ error: "Parent non trouvé" }, { status: 404 });
    }

    const parent = parentCheck.rows[0];

    // Démarrer une transaction
    await query('BEGIN');

    try {
      // 1. Récupérer tous les IDs des enfants du parent
      const enfantsResult = await query(`
        SELECT eleve_id FROM lien_parent_eleve WHERE parent_id = $1
      `, [parentId]);
      
      const enfantIds = enfantsResult.rows.map(row => row.eleve_id);

      // 2. Supprimer les données liées aux pré-inscriptions
      await query(`
        DELETE FROM commandes_fournitures 
        WHERE preinscription_id IN (
          SELECT id FROM preinscriptions WHERE parent_id = $1
        )
      `, [parentId]);

      await query(`
        DELETE FROM echeances_paiement 
        WHERE preinscription_id IN (
          SELECT id FROM preinscriptions WHERE parent_id = $1
        )
      `, [parentId]);

      await query(`
        DELETE FROM paiements 
        WHERE preinscription_id IN (
          SELECT id FROM preinscriptions WHERE parent_id = $1
        )
      `, [parentId]);

      await query(`
        DELETE FROM preinscriptions WHERE parent_id = $1
      `, [parentId]);

      // 3. Supprimer les données liées aux réinscriptions
      await query(`
        DELETE FROM echeances_paiement 
        WHERE reinscription_id IN (
          SELECT id FROM reinscriptions WHERE parent_id = $1
        )
      `, [parentId]);

      await query(`
        DELETE FROM paiements 
        WHERE reinscription_id IN (
          SELECT id FROM reinscriptions WHERE parent_id = $1
        )
      `, [parentId]);

      await query(`
        DELETE FROM reinscriptions WHERE parent_id = $1
      `, [parentId]);

      // 4. Supprimer les inscriptions
      await query(`
        DELETE FROM inscriptions WHERE parent_id = $1
      `, [parentId]);

      // ⭐ 5. Supprimer les données des enfants - VERSION CORRIGÉE AVEC BOUCLE
      if (enfantIds.length > 0) {
        for (const enfantId of enfantIds) {
          // Supprimer les présences
          await query(`
            DELETE FROM presences WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les notes
          await query(`
            DELETE FROM notes WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les inscriptions transport
          await query(`
            DELETE FROM inscriptions_transport WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les inscriptions cantine
          await query(`
            DELETE FROM inscriptions_cantine WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les réservations cantine
          await query(`
            DELETE FROM reservations_cantine WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les transactions cantine
          await query(`
            DELETE FROM transactions_cantine WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les participations quiz
          await query(`
            DELETE FROM participations_quiz WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les soumissions de devoirs
          await query(`
            DELETE FROM soumissions_devoirs WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les emprunts bibliothèque
          await query(`
            DELETE FROM emprunts_bibliotheque WHERE eleve_id = $1
          `, [enfantId]);

          // Supprimer les ventes librairie
          await query(`
            DELETE FROM ventes_librairie WHERE eleve_id = $1
          `, [enfantId]);
        }
      }

      // 6. Supprimer les liens parent-enfant
      await query(`
        DELETE FROM lien_parent_eleve WHERE parent_id = $1
      `, [parentId]);

      // 7. Supprimer les enfants et leurs comptes utilisateurs
      for (const enfantId of enfantIds) {
        // Récupérer l'utilisateur_id de l'enfant
        const enfantResult = await query(`
          SELECT utilisateur_id FROM eleves WHERE id = $1
        `, [enfantId]);

        if (enfantResult.rows.length > 0) {
          const utilisateurId = enfantResult.rows[0].utilisateur_id;
          
          // Supprimer l'élève
          await query(`
            DELETE FROM eleves WHERE id = $1
          `, [enfantId]);

          // Supprimer l'utilisateur (élève)
          await query(`
            DELETE FROM utilisateurs WHERE id = $1
          `, [utilisateurId]);
        }
      }

      // 8. Supprimer le parent
      await query(`
        DELETE FROM parents WHERE id = $1
      `, [parentId]);

      // 9. Supprimer l'utilisateur du parent
      await query(`
        DELETE FROM utilisateurs WHERE id = $1
      `, [parent.utilisateur_id]);

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Parent ${parent.prenom} ${parent.nom} et ses ${enfantIds.length} enfant(s) supprimés avec succès`,
        deletedChildren: enfantIds.length
      });

    } catch (error) {
      await query('ROLLBACK');
      console.error("Erreur dans la transaction:", error);
      throw error;
    }
  } catch (error) {
    console.error("Erreur suppression parent:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}