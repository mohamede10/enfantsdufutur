// app/api/parent/enfants/[id]/profil/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eleveId: string }> }
) {
  try {
    const { eleveId: eleveIdParam } = await params;
    const auth = await verifyParentChildAccess(eleveIdParam);
    if ("error" in auth) return auth.error;

    const { eleveId, type, parentId, statut } = auth;

    // ═══════════════════════════════════════════════════════
    // CAS 1 : PRÉ-INSCRIPTION → Récupérer les infos du dossier
    // ═══════════════════════════════════════════════════════
    if (type === "preinscription") {
      const preinsRes = await query(
        `SELECT 
          p.id,
          p.numero_dossier AS matricule,
          p.enfant_prenom AS prenom,
          p.enfant_nom AS nom,
          p.date_naissance,
          p.lieu_naissance,
          p.sexe,
          p.classe AS classe_nom,
          p.niveau AS classe_niveau,
          NULL AS salle,
          p.photo_url,
          p.statut,
          p.frais_statut,
          p.date_preinscription,
          NULL AS email,
          NULL AS telephone,
          NULL AS annee_scolaire,
          'preinscription' AS source
        FROM preinscriptions p
        WHERE p.id = $1 AND p.parent_id = $2`,
        [eleveId, parentId]
      );

      if (preinsRes.rows.length === 0) {
        return NextResponse.json({ error: "Pré-inscription introuvable" }, { status: 404 });
      }

      return NextResponse.json({
        profil: preinsRes.rows[0],
        type: "preinscription",
        message: "Votre enfant est en pré-inscription. Certaines informations seront complétées après validation.",
      });
    }

    // ═══════════════════════════════════════════════════════
    // CAS 2 : RÉINSCRIPTION → Récupérer les infos du dossier
    // ═══════════════════════════════════════════════════════
    if (type === "reinscription") {
      const reinsRes = await query(
        `SELECT 
          r.id,
          r.numero_dossier AS matricule,
          r.enfant_prenom AS prenom,
          r.enfant_nom AS nom,
          r.date_naissance,
          r.lieu_naissance,
          r.sexe,
          r.classe_nom,
          r.niveau AS classe_niveau,
          NULL AS salle,
          r.photo_url,
          r.statut,
          r.frais_statut,
          r.date_reinscription AS date_preinscription,
          COALESCE(ue.email, NULL) AS email,
          COALESCE(ue.telephone, NULL) AS telephone,
          an.libelle AS annee_scolaire,
          'reinscription' AS source
        FROM reinscriptions r
        LEFT JOIN eleves e ON r.eleve_id = e.id
        LEFT JOIN utilisateurs ue ON e.utilisateur_id = ue.id
        LEFT JOIN classes c ON r.classe_id = c.id
        LEFT JOIN annees_scolaires an ON c.annee_scolaire_id = an.id
        WHERE r.id = $1 AND r.parent_id = $2`,
        [eleveId, parentId]
      );

      if (reinsRes.rows.length === 0) {
        return NextResponse.json({ error: "Réinscription introuvable" }, { status: 404 });
      }

      return NextResponse.json({
        profil: reinsRes.rows[0],
        type: "reinscription",
      });
    }

    // ═══════════════════════════════════════════════════════
    // CAS 3 : ÉLÈVE INSCRIT → Récupérer le profil complet
    // ═══════════════════════════════════════════════════════
    const result = await query(
      `SELECT 
        e.id,
        e.matricule,
        e.date_naissance,
        e.sexe,
        u.prenom,
        u.nom,
        u.email,
        u.telephone,
        u.photo_url,
        c.id AS classe_id,
        c.nom AS classe_nom,
        c.niveau AS classe_niveau,
        c.salle,
        an.libelle AS annee_scolaire,
        an.id AS annee_scolaire_id,
        'eleve' AS source
      FROM eleves e
      JOIN utilisateurs u ON u.id = e.utilisateur_id
      LEFT JOIN classes c ON c.id = e.classe_id
      LEFT JOIN annees_scolaires an ON an.id = c.annee_scolaire_id
      WHERE e.id = $1`,
      [eleveId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      profil: result.rows[0],
      type: "eleve",
    });

  } catch (error: any) {
    console.error("API /parent/enfants/[eleveId]/profil error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}