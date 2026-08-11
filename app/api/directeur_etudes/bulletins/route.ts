// app/api/directeur_etudes/bulletins/route.ts
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
        SELECT id, nom, niveau 
        FROM classes 
        ORDER BY niveau, nom
      `);
      return NextResponse.json(res.rows);
    } 
    
    if (action === "bulletins" && classeId) {
      // 1. Récupérer tous les élèves de la classe
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

      // 2. Récupérer toutes les notes des élèves de la classe
      const notesRes = await query(`
        SELECT 
          n.eleve_id,
          n.valeur,
          n.coefficient as note_coeff,
          COALESCE(m.nom, 'Général') AS matiere,
          COALESCE(m.coefficient, 1) AS coeff_matiere,
          COALESCE(CONCAT(u.prenom, ' ', u.nom), 'Non assigné') AS enseignant,
          n.note_sur
        FROM public.notes n
        JOIN public.enseignements en ON en.id = n.enseignement_id
        LEFT JOIN public.matieres m ON m.id = en.matiere_id
        LEFT JOIN public.personnels p ON p.id = en.enseignant_id
        LEFT JOIN public.utilisateurs u ON u.id = p.utilisateur_id
        WHERE en.classe_id = $1
      `, [classeId]);

      // 3. Calculer les statistiques de la classe
      const statsRes = await query(`
        WITH class_stats AS (
          SELECT 
            e.id as eleve_id,
            AVG(n.valeur) as moyenne_eleve
          FROM eleves e
          JOIN notes n ON n.eleve_id = e.id
          JOIN enseignements en ON en.id = n.enseignement_id
          WHERE e.classe_id = $1
          GROUP BY e.id
        )
        SELECT 
          COUNT(DISTINCT cs.eleve_id) as effectif,
          AVG(cs.moyenne_eleve) as moyenne_classe,
          MAX(cs.moyenne_eleve) as meilleure_moyenne,
          MIN(cs.moyenne_eleve) as plus_faible_moyenne
        FROM class_stats cs
      `, [classeId]);

      const stats = statsRes.rows[0] || { effectif: 0, moyenne_classe: 0, meilleure_moyenne: 0, plus_faible_moyenne: 0 };

      // 4. Agréger les données par élève
      const bulletins = elevesRes.rows.map(eleve => {
        const studentNotes = notesRes.rows.filter(n => n.eleve_id === eleve.id);
        
        // Grouper par matière
        const matieres: Record<string, any> = {};
        for (const note of studentNotes) {
          if (!matieres[note.matiere]) {
            matieres[note.matiere] = {
              matiere: note.matiere,
              coefficient: note.coeff_matiere,
              enseignant: note.enseignant || 'Non assigné',
              somme_ponderee: 0,
              somme_coeff: 0,
              note_sur: note.note_sur || 20,
            };
          }
          // Calculer la moyenne pondérée en fonction du barème
          const valeurNormalisee = (parseFloat(note.valeur) / (note.note_sur || 20)) * 20;
          matieres[note.matiere].somme_ponderee += valeurNormalisee * note.note_coeff;
          matieres[note.matiere].somme_coeff += note.note_coeff;
        }

        let totalPondere = 0;
        let totalCoeff = 0;
        const matieresArray = Object.values(matieres).map((m: any) => {
          const moyenne = m.somme_coeff > 0 ? m.somme_ponderee / m.somme_coeff : 0;
          const moyenneArrondie = Math.round(moyenne * 100) / 100;
          totalPondere += moyenneArrondie * m.coefficient;
          totalCoeff += parseInt(m.coefficient);
          return { 
            ...m, 
            moyenne: moyenneArrondie,
            moyenneCoeff: Math.round(moyenneArrondie * m.coefficient * 100) / 100,
            mention: getMention(moyenneArrondie)
          };
        });

        const moyenneGenerale = totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : 0;

        return {
          eleve,
          matieres: matieresArray,
          moyenneGenerale,
          totalPoints: Math.round(totalPondere * 100) / 100,
          stats
        };
      });

      // 5. Trier par moyenne pour le classement
      bulletins.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);

      // 6. Ajouter le classement et les statistiques
      bulletins.forEach((bulletin, index) => {
        (bulletin as any).rang = index + 1;
        (bulletin as any).totalEleves = bulletins.length;
        (bulletin as any).stats = stats;
      });

      // 7. Restaurer l'ordre alphabétique
      bulletins.sort((a, b) => a.eleve.nom.localeCompare(b.eleve.nom));

      return NextResponse.json(bulletins);
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });

  } catch (error: any) {
    console.error("API /directeur_etudes/bulletins GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Fonction pour obtenir la mention
function getMention(moyenne: number): string {
  if (moyenne >= 8) return "TRES BIEN";
  if (moyenne >= 7) return "BIEN";
  if (moyenne >= 6) return "ASSEZ BIEN";
  if (moyenne >= 5) return "PASSABLE";
  return "INSUFFISANT";
}