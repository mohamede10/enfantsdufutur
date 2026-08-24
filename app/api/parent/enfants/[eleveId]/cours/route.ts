// app/api/parent/enfants/[eleveId]/cours/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { classeId } = auth;

  const leconsRes = await query(
    `SELECT 
      l.id, l.titre, l.description, l.contenu, l.fichier_url, l.video_url, l.date_publication,
      COALESCE(m.nom, 'Général') AS matiere,
      COALESCE(m.id, 0) AS matiere_id,
      CONCAT(u.prenom, ' ', u.nom) AS enseignant
    FROM lecons l
    JOIN enseignements en ON en.id = l.enseignement_id
    LEFT JOIN matieres m ON m.id = en.matiere_id
    JOIN personnels p ON p.id = en.enseignant_id
    JOIN utilisateurs u ON u.id = p.utilisateur_id
    WHERE en.classe_id = $1
    ORDER BY matiere, l.date_publication DESC`,
    [classeId]
  );

  const parMatiere: Record<string, any> = {};
  for (const l of leconsRes.rows) {
    if (!parMatiere[l.matiere_id]) {
      parMatiere[l.matiere_id] = { matiere: l.matiere, enseignant: l.enseignant, lecons: [] };
    }
    parMatiere[l.matiere_id].lecons.push({
      id: l.id, titre: l.titre, description: l.description,
      contenu: l.contenu, fichier_url: l.fichier_url,
      video_url: l.video_url, date_publication: l.date_publication,
    });
  }

  return NextResponse.json({ lecons: leconsRes.rows, parMatiere: Object.values(parMatiere), total: leconsRes.rows.length });
}
