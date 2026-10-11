// app/api/eleve/profil/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    let eleveId: number | null = null;

    // ═══════════════════════════════════════════════════════
    // CAS 1 : ÉLÈVE connecté → son propre profil
    // ═══════════════════════════════════════════════════════
    if (userRole === "ELEVE") {
      const eleveRes = await query(
        `SELECT id FROM public.eleves WHERE utilisateur_id = $1`,
        [userId]
      );

      if (eleveRes.rows.length === 0) {
        return NextResponse.json({ error: "Profil élève introuvable" }, { status: 404 });
      }
      eleveId = eleveRes.rows[0].id;
    }

    // ═══════════════════════════════════════════════════════
    // CAS 2 : PARENT connecté → doit passer ?eleveId=xxx
    // ═══════════════════════════════════════════════════════
    else if (userRole === "PARENT") {
      const eleveIdParam = req.nextUrl.searchParams.get("eleveId");

      if (!eleveIdParam) {
        return NextResponse.json(
          { error: "Paramètre eleveId requis pour un parent" },
          { status: 400 }
        );
      }

      const targetEleveId = parseInt(eleveIdParam);
      if (isNaN(targetEleveId)) {
        return NextResponse.json({ error: "ID élève invalide" }, { status: 400 });
      }

      // Récupérer le parent_id
      const parentRes = await query(
        `SELECT p.id FROM parents p
         JOIN utilisateurs u ON p.utilisateur_id = u.id
         WHERE u.email = $1`,
        [session.user?.email]
      );

      if (parentRes.rows.length === 0) {
        return NextResponse.json({ error: "Parent introuvable" }, { status: 404 });
      }
      const parentId = parentRes.rows[0].id;

      // Vérifier le lien (élève OU préinscription OU réinscription)
      const lienRes = await query(
        `SELECT 1 FROM lien_parent_eleve WHERE parent_id = $1 AND eleve_id = $2
         UNION
         SELECT 1 FROM preinscriptions WHERE parent_id = $1 AND id = $2
         UNION
         SELECT 1 FROM reinscriptions WHERE parent_id = $1 AND (id = $2 OR eleve_id = $2)
         LIMIT 1`,
        [parentId, targetEleveId]
      );

      if (lienRes.rows.length === 0) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      eleveId = targetEleveId;
    } else {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    if (!eleveId) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }

    // ═══════════════════════════════════════════════════════
    // Récupérer le profil (commun aux 2 cas)
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
        an.id AS annee_scolaire_id
      FROM public.eleves e
      JOIN public.utilisateurs u ON u.id = e.utilisateur_id
      LEFT JOIN public.classes c ON c.id = e.classe_id
      LEFT JOIN public.annees_scolaires an ON an.id = c.annee_scolaire_id
      WHERE e.id = $1`,
      [eleveId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Profil élève introuvable" }, { status: 404 });
    }

    return NextResponse.json({ profil: result.rows[0] });

  } catch (error: any) {
    console.error("API /eleve/profil error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}