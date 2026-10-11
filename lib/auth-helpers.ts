// lib/parentChildAuth.ts
// Utilitaire partagé : vérifie que le parent connecté a bien accès à l'élève demandé
// Gère : élèves inscrits, préinscriptions ET réinscriptions
// Retourne { parentId, eleveId, classeId, type, statut } ou { error }

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

interface AccessResult {
  eleveId?: number;
  classeId?: number | null;
  parentId?: number | null;
  type?: "eleve" | "preinscription" | "reinscription";
  statut?: string | null;
  estValide?: boolean;
  error?: NextResponse;
}

export async function verifyParentChildAccess(
  eleveIdParam: string
): Promise<AccessResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const userRole = (session.user as any).role;
  const isParent = userRole === "PARENT";
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "DIRECTEUR_GENERAL", "DIRECTEUR", "COMPTABLE"].includes(userRole);

  if (!isParent && !isAdmin) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 403 }) };
  }

  const eleveId = parseInt(eleveIdParam);
  if (isNaN(eleveId)) {
    return { error: NextResponse.json({ error: "ID enfant invalide" }, { status: 400 }) };
  }

  // ═══════════════════════════════════════════════════════
  // CAS ADMIN : Accès direct à tout
  // ═══════════════════════════════════════════════════════
  if (isAdmin) {
    // Essayer élève réel
    const eleveRes = await query(
      `SELECT id, classe_id, 'eleve' as type, 'valide' as statut 
       FROM eleves WHERE id = $1`,
      [eleveId]
    );
    if (eleveRes.rows.length > 0) {
      return {
        eleveId,
        classeId: eleveRes.rows[0].classe_id,
        parentId: null,
        type: "eleve",
        statut: "valide",
        estValide: true,
      };
    }

    // Essayer préinscription
    const preinsRes = await query(
      `SELECT id, NULL as classe_id, 'preinscription' as type, statut 
       FROM preinscriptions WHERE id = $1`,
      [eleveId]
    );
    if (preinsRes.rows.length > 0) {
      return {
        eleveId,
        classeId: null,
        parentId: preinsRes.rows[0].parent_id,
        type: "preinscription",
        statut: preinsRes.rows[0].statut,
        estValide: preinsRes.rows[0].statut === "valide",
      };
    }

    // Essayer réinscription
    const reinsRes = await query(
      `SELECT id, classe_id, 'reinscription' as type, statut 
       FROM reinscriptions WHERE id = $1`,
      [eleveId]
    );
    if (reinsRes.rows.length > 0) {
      return {
        eleveId,
        classeId: reinsRes.rows[0].classe_id,
        parentId: reinsRes.rows[0].parent_id,
        type: "reinscription",
        statut: reinsRes.rows[0].statut,
        estValide: true,
      };
    }

    return { error: NextResponse.json({ error: "Élève introuvable" }, { status: 404 }) };
  }

  // ═══════════════════════════════════════════════════════
  // CAS PARENT : Vérifier que l'enfant lui appartient
  // ═══════════════════════════════════════════════════════

  // 1️⃣ Récupérer le parent_id
  const parentRes = await query(
    `SELECT p.id FROM parents p 
     JOIN utilisateurs u ON p.utilisateur_id = u.id 
     WHERE u.email = $1`,
    [session.user?.email]
  );
  if (parentRes.rows.length === 0) {
    return { error: NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 }) };
  }
  const parentId = parentRes.rows[0].id;

  // 2️⃣ Vérifier ÉLÈVE INSCRIT (via lien_parent_eleve)
  const lienRes = await query(
    `SELECT lpe.eleve_id, e.classe_id
     FROM lien_parent_eleve lpe 
     JOIN eleves e ON e.id = lpe.eleve_id 
     WHERE lpe.parent_id = $1 AND lpe.eleve_id = $2`,
    [parentId, eleveId]
  );

  if (lienRes.rows.length > 0) {
    return {
      eleveId,
      classeId: lienRes.rows[0].classe_id,
      parentId,
      type: "eleve",
      statut: "valide",
      estValide: true,
    };
  }

  // 3️⃣ Vérifier PRÉ-INSCRIPTION
  //    ⭐ L'enfant peut ne pas encore être un "élève" enregistré
  const preinsRes = await query(
    `SELECT p.id, p.parent_id, p.statut, p.classe
     FROM preinscriptions p
     WHERE p.parent_id = $1 AND p.id = $2
     LIMIT 1`,
    [parentId, eleveId]
  );

  if (preinsRes.rows.length > 0) {
    return {
      eleveId,
      classeId: null, // Pas encore assigné à une classe réelle
      parentId,
      type: "preinscription",
      statut: preinsRes.rows[0].statut,
      estValide: preinsRes.rows[0].statut === "valide",
    };
  }

  // 4️⃣ Vérifier RÉINSCRIPTION
  const reinsRes = await query(
    `SELECT r.id, r.parent_id, r.statut, r.classe_id, r.eleve_id
     FROM reinscriptions r
     WHERE r.parent_id = $1 AND (r.id = $2 OR r.eleve_id = $2)
     LIMIT 1`,
    [parentId, eleveId]
  );

  if (reinsRes.rows.length > 0) {
    return {
      eleveId: reinsRes.rows[0].eleve_id || eleveId,
      classeId: reinsRes.rows[0].classe_id,
      parentId,
      type: "reinscription",
      statut: reinsRes.rows[0].statut,
      estValide: true,
    };
  }

  // 5️⃣ Vérifier via le lien inscriptions → preinscriptions (élève déjà validé)
  const inscriptionRes = await query(
    `SELECT i.eleve_id, e.classe_id, 'eleve' as type, 'valide' as statut
     FROM inscriptions i
     JOIN eleves e ON e.id = i.eleve_id
     WHERE i.parent_id = $1 AND i.eleve_id = $2
     LIMIT 1`,
    [parentId, eleveId]
  );

  if (inscriptionRes.rows.length > 0) {
    // Ajouter le lien permanent pour la prochaine fois
    try {
      await query(
        `INSERT INTO lien_parent_eleve (parent_id, eleve_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [parentId, eleveId]
      );
    } catch (_) {}

    return {
      eleveId,
      classeId: inscriptionRes.rows[0].classe_id,
      parentId,
      type: "eleve",
      statut: "valide",
      estValide: true,
    };
  }

  // ❌ Aucun accès trouvé
  console.warn(
    `⚠️ Accès refusé : parent ${parentId} (${session.user?.email}) → élève/préinscription ${eleveId}`
  );
  return {
    error: NextResponse.json(
      { error: "Cet enfant ne vous appartient pas ou n'existe pas" },
      { status: 403 }
    ),
  };
}

/**
 * Helper : Retourne uniquement les données de l'élève (sans NextResponse)
 * Utile pour les cas où on veut juste valider sans gérer la réponse
 */
export async function getAccessInfo(eleveIdParam: string) {
  const result = await verifyParentChildAccess(eleveIdParam);
  if (result.error) {
    return { authorized: false, ...result };
  }
  return { authorized: true, ...result };
}