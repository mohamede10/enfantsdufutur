// app/api/parent/enfants/[eleveId]/examens/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { eleveId } = auth;

  const examensRes = await query(
    `SELECT 
      ex.id, ex.titre, ex.duree_minutes, ex.date_debut, ex.date_fin, ex.est_actif, ex.fichier_url,
      COALESCE(m.nom, 'Sans matière') AS matiere,
      CONCAT(u.prenom, ' ', u.nom) AS enseignant,
      COUNT(DISTINCT q.id) AS nb_questions,
      COALESCE(SUM(q.points), 0) AS total_points,
      COUNT(DISTINCT r.id) AS nb_reponses_eleve
    FROM examens ex
    INNER JOIN examens_eleves ee ON ee.examen_id = ex.id AND ee.eleve_id = $1
    JOIN enseignements en ON en.id = ex.enseignement_id
    LEFT JOIN matieres m ON m.id = en.matiere_id
    JOIN personnels p ON p.id = en.enseignant_id
    JOIN utilisateurs u ON u.id = p.utilisateur_id
    LEFT JOIN questions_qcm q ON q.examen_id = ex.id
    LEFT JOIN reponses_eleves_qcm r ON r.examen_id = ex.id AND r.eleve_id = $1
    WHERE ex.est_actif = true
    GROUP BY ex.id, ex.titre, ex.duree_minutes, ex.date_debut, ex.date_fin, ex.est_actif, ex.fichier_url, m.nom, u.prenom, u.nom
    ORDER BY ex.date_debut DESC NULLS LAST`,
    [eleveId]
  );

  const examens = examensRes.rows.map((e) => ({
    ...e,
    deja_passe: parseInt(e.nb_reponses_eleve) > 0,
    nb_questions: parseInt(e.nb_questions) || 0,
    total_points: parseInt(e.total_points) || 0,
  }));

  return NextResponse.json({ examens });
}
