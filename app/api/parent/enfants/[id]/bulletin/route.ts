// app/api/parent/enfants/[eleveId]/bulletin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { eleveId } = auth;

  const eleveRes = await query(
    `SELECT e.id, e.matricule, c.nom AS classe_nom, c.niveau,
            u.prenom, u.nom, an.libelle AS annee_scolaire
     FROM eleves e
     JOIN utilisateurs u ON u.id = e.utilisateur_id
     LEFT JOIN classes c ON c.id = e.classe_id
     LEFT JOIN annees_scolaires an ON an.id = c.annee_scolaire_id
     WHERE e.id = $1`,
    [eleveId]
  );

  if (eleveRes.rows.length === 0) {
    return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
  }
  const eleve = eleveRes.rows[0];

  const notesRes = await query(
    `SELECT 
      m.id AS matiere_id, m.nom AS matiere, m.coefficient AS coeff_matiere,
      n.valeur, n.coefficient AS coeff_note, n.type_note, n.date_saisie, n.commentaire,
      CONCAT(u.prenom, ' ', u.nom) AS enseignant
    FROM notes n
    JOIN enseignements en ON en.id = n.enseignement_id
    JOIN matieres m ON m.id = en.matiere_id
    JOIN personnels p ON p.id = en.enseignant_id
    JOIN utilisateurs u ON u.id = p.utilisateur_id
    WHERE n.eleve_id = $1
    ORDER BY m.nom, n.type_note, n.date_saisie`,
    [eleveId]
  );

  const matieresMap: Record<string, any> = {};
  for (const row of notesRes.rows) {
    const key = row.matiere_id;
    if (!matieresMap[key]) {
      matieresMap[key] = { matiere: row.matiere, coefficient: parseInt(row.coeff_matiere), enseignant: row.enseignant, devoirs: [], compositions: [], examens_notes: [] };
    }
    const noteObj = { valeur: parseFloat(row.valeur), coefficient: parseInt(row.coeff_note), date: row.date_saisie, commentaire: row.commentaire };
    if (row.type_note === "devoir") matieresMap[key].devoirs.push(noteObj);
    else if (row.type_note === "composition") matieresMap[key].compositions.push(noteObj);
    else matieresMap[key].examens_notes.push(noteObj);
  }

  let totalMoyennePonderee = 0, totalCoeff = 0;
  const lignesBulletin = Object.values(matieresMap).map((m: any) => {
    const allNotes = [...m.devoirs, ...m.compositions, ...m.examens_notes];
    const somme = allNotes.reduce((acc: number, n: any) => acc + n.valeur * n.coefficient, 0);
    const sommCoeff = allNotes.reduce((acc: number, n: any) => acc + n.coefficient, 0);
    const moyenne = sommCoeff > 0 ? Math.round((somme / sommCoeff) * 100) / 100 : 0;
    totalMoyennePonderee += moyenne * m.coefficient;
    totalCoeff += m.coefficient;
    const appreciation = moyenne >= 16 ? "Très Bien" : moyenne >= 14 ? "Bien" : moyenne >= 12 ? "Assez Bien" : moyenne >= 10 ? "Passable" : "Insuffisant";
    return { ...m, moyenne, appreciation, nbNotes: allNotes.length };
  });

  const moyenneGenerale = totalCoeff > 0 ? Math.round((totalMoyennePonderee / totalCoeff) * 100) / 100 : 0;
  const mentionGenerale = moyenneGenerale >= 16 ? "Très Bien" : moyenneGenerale >= 14 ? "Bien" : moyenneGenerale >= 12 ? "Assez Bien" : moyenneGenerale >= 10 ? "Passable" : "Insuffisant";

  return NextResponse.json({
    eleve: { nom: `${eleve.prenom} ${eleve.nom}`, prenom: eleve.prenom, matricule: eleve.matricule, classe: eleve.classe_nom, niveau: eleve.niveau, annee_scolaire: eleve.annee_scolaire },
    lignes: lignesBulletin,
    moyenneGenerale,
    mentionGenerale,
    totalCoeff,
  });
}
