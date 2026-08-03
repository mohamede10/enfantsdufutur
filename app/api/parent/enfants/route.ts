// app/api/parent/enfants/route.ts - Version corrigée avec paiements inclus

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userEmail = session.user?.email;

    // 1️⃣ Récupérer les parents du parent connecté
    const parentResult = await query(`
      SELECT id FROM parents WHERE utilisateur_id = (
        SELECT id FROM utilisateurs WHERE email = $1
      )
    `, [userEmail]);

    if (parentResult.rows.length === 0) {
      return NextResponse.json({ error: "Parent non trouvé" }, { status: 404 });
    }

    const parentId = parentResult.rows[0].id;

    // 2️⃣ Récupérer les ÉLÈVES déjà inscrits
    const elevesResult = await query(`
      SELECT 
        e.id,
        e.matricule,
        e.id as eleve_id,
        u.nom,
        u.prenom,
        c.nom as classe_nom,
        c.niveau,
        e.sexe,
        e.date_naissance,
        e.lieu_naissance,
        COALESCE(c.total_versement, c.frais_inscription, 0) as frais_inscription_classe,
        COALESCE(c.reinscription_total_versement, c.total_versement, 0) as frais_reinscription_classe,
        e.photo_url,
        -- ⭐ Calcul des frais optionnels
        COALESCE(
          (SELECT cm.prix_annuel
           FROM cantine_menus cm
           ORDER BY cm.date DESC
           LIMIT 1),
          0
        ) as frais_cantine,
        COALESCE(
          (SELECT SUM(lt.prix_abonnement) 
           FROM lignes_transport lt),
          0
        ) as frais_transport,
        -- ⭐ PAIEMENTS : Inclure ceux liés à l'élève OU à sa pré-inscription
        COALESCE(
          (SELECT SUM(pai.montant) 
           FROM paiements pai
           WHERE (
             pai.eleve_id = e.id 
             OR pai.preinscription_id IN (
               SELECT preinscription_id FROM inscriptions WHERE eleve_id = e.id
             )
             OR pai.reinscription_id IN (
               SELECT id FROM reinscriptions WHERE eleve_id = e.id
             )
           )
           AND pai.statut = 'valide'),
          0
        ) as frais_paye_direct,
        COALESCE(
          (SELECT SUM(eche.montant) 
           FROM echeances_paiement eche
           WHERE eche.preinscription_id IN (
             SELECT preinscription_id FROM inscriptions WHERE eleve_id = e.id
           )
           AND eche.statut = 'paye'),
          0
        ) as frais_paye_echeances,
        TRUE as est_eleve,
        FALSE as est_preinscription,
        'eleve' as type
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      WHERE lpe.parent_id = $1
        AND e.deleted_at IS NULL
      ORDER BY u.nom, u.prenom
    `, [parentId]);

    // 3️⃣ Récupérer les PRÉ-INSCRIPTIONS en attente
    const preinscriptionsResult = await query(`
      SELECT 
        p.id,
        p.numero_dossier as matricule,
        p.id as eleve_id,
        p.enfant_nom as nom,
        p.enfant_prenom as prenom,
        p.classe as classe_nom,
        p.niveau,
        p.sexe,
        p.date_naissance,
        p.lieu_naissance,
        p.frais_montant as frais_inscription_classe,
        0 as frais_reinscription_classe,
        p.photo_url,
        COALESCE(
          (SELECT cm.prix_annuel
           FROM cantine_menus cm
           ORDER BY cm.date DESC
           LIMIT 1),
          0
        ) as frais_cantine,
        0 as frais_transport,
        -- ⭐ Paiements pour les pré-inscriptions
        COALESCE(
          (SELECT SUM(pai.montant) 
           FROM paiements pai
           WHERE pai.preinscription_id = p.id
           AND pai.statut = 'valide'),
          0
        ) as frais_paye_direct,
        COALESCE(
          (SELECT SUM(eche.montant) 
           FROM echeances_paiement eche
           WHERE eche.preinscription_id = p.id
           AND eche.statut = 'paye'),
          0
        ) as frais_paye_echeances,
        FALSE as est_eleve,
        TRUE as est_preinscription,
        'preinscription' as type,
        p.statut,
        p.frais_statut,
        p.montant_total_plan
      FROM preinscriptions p
      WHERE p.parent_id = $1
        AND p.statut = 'en_attente'
      ORDER BY p.date_preinscription DESC
    `, [parentId]);

    // 4️⃣ Récupérer les RÉINSCRIPTIONS
    const reinscriptionsResult = await query(`
      SELECT 
        r.id,
        r.numero_dossier as matricule,
        r.id as eleve_id,
        r.enfant_nom as nom,
        r.enfant_prenom as prenom,
        r.classe_nom as classe_nom,
        r.niveau,
        r.sexe,
        r.date_naissance,
        r.lieu_naissance,
        r.montant_frais as frais_inscription_classe,
        r.montant_frais as frais_reinscription_classe,
        r.photo_url,
        COALESCE(
          (SELECT cm.prix_annuel
           FROM cantine_menus cm
           ORDER BY cm.date DESC
           LIMIT 1),
          0
        ) as frais_cantine,
        0 as frais_transport,
        -- ⭐ Paiements pour les réinscriptions
        COALESCE(
          (SELECT SUM(pai.montant) 
           FROM paiements pai
           WHERE pai.reinscription_id = r.id
           AND pai.statut = 'valide'),
          0
        ) as frais_paye_direct,
        COALESCE(
          (SELECT SUM(eche.montant) 
           FROM echeances_paiement eche
           WHERE eche.reinscription_id = r.id
           AND eche.statut = 'paye'),
          0
        ) as frais_paye_echeances,
        FALSE as est_eleve,
        TRUE as est_preinscription,
        'reinscription' as type,
        r.statut,
        r.frais_statut,
        r.montant_total_plan
      FROM reinscriptions r
      WHERE r.parent_id = $1
        AND r.statut = 'en_attente'
      ORDER BY r.date_reinscription DESC
    `, [parentId]);

    // 5️⃣ Combiner tous les résultats
    const tousLesEnfants = [...elevesResult.rows, ...preinscriptionsResult.rows, ...reinscriptionsResult.rows];

    // 6️⃣ Calculer les frais pour chaque enfant
    const enfantsAvecFrais = tousLesEnfants.map((enfant: any) => {
      const fraisInscription = Number(enfant.frais_inscription_classe) || 0;
      const fraisReinscription = Number(enfant.frais_reinscription_classe) || 0;
      
      // Pour les pré-inscriptions, utiliser le montant de la pré-inscription
      const montantTotal = enfant.est_preinscription 
        ? Number(enfant.montant_total_plan) || fraisInscription
        : (fraisReinscription > 0 ? fraisReinscription : fraisInscription);

      // Calculer le total payé
      const totalPaye = Number(enfant.frais_paye_direct) + Number(enfant.frais_paye_echeances);
      const reste = Math.max(0, montantTotal - totalPaye);

      return {
        ...enfant,
        frais_montant: montantTotal,
        frais_paye: totalPaye,
        frais_reste: reste,
        details_frais: {
          inscription: fraisInscription,
          reinscription: fraisReinscription,
          total: montantTotal,
          paye: totalPaye,
          reste: reste
        }
      };
    });

    console.log(`📋 Enfants trouvés: ${enfantsAvecFrais.length} (${elevesResult.rows.length} élèves, ${preinscriptionsResult.rows.length} pré-inscriptions)`);

    return NextResponse.json(enfantsAvecFrais);

  } catch (error) {
    console.error("Erreur GET enfants:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}