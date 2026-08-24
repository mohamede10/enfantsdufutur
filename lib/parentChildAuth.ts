// lib/parentChildAuth.ts
// Utilitaire partagé : vérifie que le parent connecté a bien accès à l'élève demandé
// Retourne { parentId, eleveId, classeId } ou null si non autorisé

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function verifyParentChildAccess(eleveIdParam: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const userRole = (session.user as any).role;
  // Accepter PARENT mais aussi SUPER_ADMIN/ADMIN pour le support
  const isParent = userRole === "PARENT";
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "DIRECTEUR_GENERAL", "DIRECTEUR"].includes(userRole);
  if (!isParent && !isAdmin) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 403 }) };
  }

  const eleveId = parseInt(eleveIdParam);
  if (isNaN(eleveId)) {
    return { error: NextResponse.json({ error: "ID enfant invalide" }, { status: 400 }) };
  }

  if (isParent) {
    // Récupérer le parent_id
    const parentRes = await query(
      `SELECT p.id FROM parents p JOIN utilisateurs u ON p.utilisateur_id = u.id WHERE u.email = $1`,
      [session.user?.email]
    );
    if (parentRes.rows.length === 0) {
      return { error: NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 }) };
    }
    const parentId = parentRes.rows[0].id;

    // Vérifier le lien parent-enfant
    const lienRes = await query(
      `SELECT lpe.eleve_id, e.classe_id FROM lien_parent_eleve lpe JOIN eleves e ON e.id = lpe.eleve_id WHERE lpe.parent_id = $1 AND lpe.eleve_id = $2`,
      [parentId, eleveId]
    );
    if (lienRes.rows.length === 0) {
      return { error: NextResponse.json({ error: "Cet enfant ne vous appartient pas" }, { status: 403 }) };
    }
    return { eleveId, classeId: lienRes.rows[0].classe_id, parentId };
  }

  // Admin : accès direct
  const eleveRes = await query(`SELECT id, classe_id FROM eleves WHERE id = $1`, [eleveId]);
  if (eleveRes.rows.length === 0) {
    return { error: NextResponse.json({ error: "Élève introuvable" }, { status: 404 }) };
  }
  return { eleveId, classeId: eleveRes.rows[0].classe_id, parentId: null };
}
