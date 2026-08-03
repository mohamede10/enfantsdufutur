import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DIRECTEUR_ETUDES") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const classeId = searchParams.get("classe_id");

    if (action === "classes") {
      const res = await query(`
        SELECT id, nom, niveau, annee_scolaire 
        FROM classes 
        WHERE est_actif = true 
        ORDER BY niveau, nom
      `);
      return NextResponse.json(res.rows);
    } 
    
    if (action === "bulletins" && classeId) {
      // 1. Fetch all students in the class
      const elevesRes = await query(`
        SELECT e.id, e.matricule, u.prenom, u.nom, u.photo_url
        FROM eleves e
        JOIN utilisateurs u ON u.id = e.utilisateur_id
        WHERE e.classe_id = $1 AND e.est_inscrit = true
        ORDER BY u.nom, u.prenom
      `, [classeId]);

      if (elevesRes.rows.length === 0) {
        return NextResponse.json([]);
      }

      // 2. Fetch all notes for all students in the class
      const notesRes = await query(`
        SELECT 
          n.eleve_id,
          n.valeur,
          n.coefficient as note_coeff,
          COALESCE(m.nom, 'Général') AS matiere,
          COALESCE(m.coefficient, 1) AS coeff_matiere,
          CONCAT(u.prenom, ' ', u.nom) AS enseignant
        FROM public.notes n
        JOIN public.enseignements en ON en.id = n.enseignement_id
        LEFT JOIN public.matieres m ON m.id = en.matiere_id
        JOIN public.personnels p ON p.id = en.enseignant_id
        JOIN public.utilisateurs u ON u.id = p.utilisateur_id
        WHERE en.classe_id = $1
      `, [classeId]);

      // 3. Aggregate data by student
      const bulletins = elevesRes.rows.map(eleve => {
        const studentNotes = notesRes.rows.filter(n => n.eleve_id === eleve.id);
        
        // Group by matiere
        const matieres: Record<string, any> = {};
        for (const note of studentNotes) {
          if (!matieres[note.matiere]) {
            matieres[note.matiere] = {
              matiere: note.matiere,
              coefficient: note.coeff_matiere,
              enseignant: note.enseignant,
              somme_ponderee: 0,
              somme_coeff: 0,
            };
          }
          matieres[note.matiere].somme_ponderee += parseFloat(note.valeur) * note.note_coeff;
          matieres[note.matiere].somme_coeff += note.note_coeff;
        }

        let totalPondere = 0;
        let totalCoeff = 0;
        const matieresArray = Object.values(matieres).map((m: any) => {
          const moyenne = m.somme_coeff > 0 ? m.somme_ponderee / m.somme_coeff : 0;
          totalPondere += moyenne * m.coefficient;
          totalCoeff += parseInt(m.coefficient);
          return { ...m, moyenne: Math.round(moyenne * 100) / 100 };
        });

        const moyenneGenerale = totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : 0;

        return {
          eleve,
          matieres: matieresArray,
          moyenneGenerale
        };
      });

      // Sort by average (rank calculation)
      bulletins.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);

      // Add ranking
      bulletins.forEach((bulletin, index) => {
        (bulletin as any).rang = index + 1;
        (bulletin as any).totalEleves = bulletins.length;
      });

      // Restore original alphabetical order or keep rank order? Keep alphabetical for the list
      bulletins.sort((a, b) => a.eleve.nom.localeCompare(b.eleve.nom));

      return NextResponse.json(bulletins);
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });

  } catch (error: any) {
    console.error("API /directeur_etudes/bulletins GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
