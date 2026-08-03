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
    const enseignementId = searchParams.get("enseignement_id");

    if (action === "classes") {
      // Fetch all active classes
      const res = await query(`
        SELECT id, nom, niveau, annee_scolaire 
        FROM classes 
        WHERE est_actif = true 
        ORDER BY niveau, nom
      `);
      return NextResponse.json(res.rows);
    } 
    
    if (action === "enseignements" && classeId) {
      // Fetch enseignements for a class
      const res = await query(`
        SELECT en.id, COALESCE(m.nom, 'Général') as matiere, CONCAT(u.prenom, ' ', u.nom) as enseignant
        FROM enseignements en
        LEFT JOIN matieres m ON m.id = en.matiere_id
        JOIN personnels p ON p.id = en.enseignant_id
        JOIN utilisateurs u ON u.id = p.utilisateur_id
        WHERE en.classe_id = $1
        ORDER BY m.nom
      `, [classeId]);
      return NextResponse.json(res.rows);
    }

    if (action === "eleves_et_notes" && enseignementId && classeId) {
      // Fetch students of the class and their notes for the given enseignement
      const elevesRes = await query(`
        SELECT e.id, e.matricule, u.prenom, u.nom
        FROM eleves e
        JOIN utilisateurs u ON u.id = e.utilisateur_id
        WHERE e.classe_id = $1 AND e.est_inscrit = true
        ORDER BY u.nom, u.prenom
      `, [classeId]);

      const notesRes = await query(`
        SELECT id, eleve_id, valeur, coefficient, type_note, commentaire
        FROM notes
        WHERE enseignement_id = $1
      `, [enseignementId]);

      // Group notes by eleve_id
      const eleves = elevesRes.rows.map(eleve => {
        return {
          ...eleve,
          notes: notesRes.rows.filter(n => n.eleve_id === eleve.id)
        };
      });

      return NextResponse.json(eleves);
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });

  } catch (error: any) {
    console.error("API /directeur_etudes/notes GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DIRECTEUR_ETUDES") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { enseignement_id, notes } = await req.json();

    if (!enseignement_id || !Array.isArray(notes)) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    await query("BEGIN");

    for (const note of notes) {
      if (note.id) {
        // Update existing
        await query(`
          UPDATE notes 
          SET valeur = $1, coefficient = $2, type_note = $3, commentaire = $4, date_saisie = NOW()
          WHERE id = $5 AND enseignement_id = $6
        `, [note.valeur, note.coefficient, note.type_note, note.commentaire, note.id, enseignement_id]);
      } else {
        // Insert new
        await query(`
          INSERT INTO notes (eleve_id, enseignement_id, valeur, coefficient, type_note, commentaire, date_saisie)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [note.eleve_id, enseignement_id, note.valeur, note.coefficient, note.type_note, note.commentaire]);
      }
    }

    await query("COMMIT");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    await query("ROLLBACK");
    console.error("API /directeur_etudes/notes POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
