// app/api/parent/enfants/[eleveId]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { eleveId } = auth;

  const notesRes = await query(
    `SELECT 
      n.id, n.valeur, n.coefficient, n.type_note, n.date_saisie, n.commentaire,
      m.nom AS matiere, m.coefficient AS coeff_matiere,
      CONCAT(u.prenom, ' ', u.nom) AS enseignant
    FROM notes n
    JOIN enseignements en ON en.id = n.enseignement_id
    JOIN matieres m ON m.id = en.matiere_id
    JOIN personnels p ON p.id = en.enseignant_id
    JOIN utilisateurs u ON u.id = p.utilisateur_id
    WHERE n.eleve_id = $1
    ORDER BY m.nom, n.date_saisie DESC`,
    [eleveId]
  );

  const matieres: Record<string, any> = {};
  for (const note of notesRes.rows) {
    if (!matieres[note.matiere]) {
      matieres[note.matiere] = {
        matiere: note.matiere,
        coefficient: note.coeff_matiere,
        enseignant: note.enseignant,
        notes: [],
        somme_ponderee: 0,
        somme_coeff: 0,
      };
    }
    matieres[note.matiere].notes.push({
      id: note.id,
      valeur: parseFloat(note.valeur),
      coefficient: note.coefficient,
      type_note: note.type_note,
      date_saisie: note.date_saisie,
      commentaire: note.commentaire,
    });
    matieres[note.matiere].somme_ponderee += parseFloat(note.valeur) * note.coefficient;
    matieres[note.matiere].somme_coeff += note.coefficient;
  }

  let totalPondere = 0, totalCoeff = 0;
  const matieresArray = Object.values(matieres).map((m: any) => {
    const moyenne = m.somme_coeff > 0 ? m.somme_ponderee / m.somme_coeff : 0;
    totalPondere += moyenne * m.coefficient;
    totalCoeff += parseInt(m.coefficient);
    return { ...m, moyenne: Math.round(moyenne * 100) / 100 };
  });

  const moyenneGenerale = totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : 0;

  return NextResponse.json({ matieres: matieresArray, moyenneGenerale, totalNotes: notesRes.rows.length });
}
