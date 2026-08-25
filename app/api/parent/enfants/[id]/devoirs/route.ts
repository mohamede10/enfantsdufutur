// app/api/parent/enfants/[eleveId]/devoirs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { eleveId, classeId } = auth;

  const devoirsRes = await query(
    `SELECT 
      d.id, d.titre, d.description, d.fichier_url, d.date_limite, d.date_publication,
      '' AS matiere,
      CONCAT(u.prenom, ' ', u.nom) AS enseignant,
      sd.id AS soumission_id, sd.date_soumission,
      sd.note AS note_soumission, sd.commentaire AS commentaire_soumission, sd.est_retard
    FROM devoirs d
    JOIN enseignements en ON en.id = d.enseignement_id
    JOIN personnels p ON p.id = en.enseignant_id
    JOIN utilisateurs u ON u.id = p.utilisateur_id
    LEFT JOIN soumissions_devoirs sd ON sd.devoir_id = d.id AND sd.eleve_id = $1
    WHERE en.classe_id = $2
      AND en.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE est_active = true)
    ORDER BY d.date_limite ASC`,
    [eleveId, classeId]
  );

  const now = new Date();
  const devoirs = devoirsRes.rows.map((d) => {
    const dateLimite = new Date(d.date_limite);
    const statut = d.soumission_id ? "soumis" : dateLimite < now ? "en_retard" : "a_rendre";
    const joursRestants = Math.ceil((dateLimite.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...d, statut, joursRestants };
  });

  return NextResponse.json({ devoirs });
}
