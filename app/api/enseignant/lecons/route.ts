// app/api/enseignant/lecons/route.ts - Version avec champ matière

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ENSEIGNANT") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "ID utilisateur non trouvé" }, { status: 400 });
    }

    const personnelResult = await query(`
      SELECT p.id 
      FROM personnels p
      WHERE p.utilisateur_id = $1 AND LOWER(p.type) = 'enseignant'
    `, [userId]);

    if (personnelResult.rows.length === 0) {
      return NextResponse.json({ error: "Enseignant non trouvé" }, { status: 404 });
    }
    const enseignantId = personnelResult.rows[0].id;

    const result = await query(`
      SELECT 
        l.id, 
        l.titre, 
        l.description, 
        l.fichier_url as fichier, 
        l.video_url, 
        l.date_publication as date,
        c.nom as classe, 
        COALESCE(l.matiere_personnalisee, m.nom, c.nom) as matiere,
        0 as vues
      FROM lecons l
      JOIN enseignements e ON l.enseignement_id = e.id
      JOIN classes c ON e.classe_id = c.id
      LEFT JOIN matieres m ON e.matiere_id = m.id
      WHERE e.enseignant_id = $1
      ORDER BY l.date_publication DESC, l.id DESC
    `, [enseignantId]);

    const lecons = result.rows.map(l => ({
      ...l,
      date: l.date ? new Date(l.date).toISOString().split('T')[0] : null
    }));

    return NextResponse.json(lecons);
  } catch (error) {
    console.error("Erreur GET lecons:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ENSEIGNANT") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const formData = await request.formData();
    const enseignement_id = formData.get("enseignement_id") as string;
    const titre = formData.get("titre") as string;
    const description = formData.get("description") as string;
    const video_url = formData.get("video_url") as string;
    const fichier = formData.get("fichier") as File | null;
    // ⭐ NOUVEAU CHAMP : matière personnalisée
    const matiere_personnalisee = formData.get("matiere") as string;

    if (!enseignement_id || !titre) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const personnelResult = await query(`
      SELECT p.id 
      FROM personnels p
      WHERE p.utilisateur_id = $1 AND LOWER(p.type) = 'enseignant'
    `, [userId]);

    if (personnelResult.rows.length === 0) {
      return NextResponse.json({ error: "Enseignant non trouvé" }, { status: 404 });
    }
    const enseignantId = personnelResult.rows[0].id;

    const enseignementCheck = await query(`
      SELECT id FROM enseignements WHERE id = $1 AND enseignant_id = $2
    `, [enseignement_id, enseignantId]);

    if (enseignementCheck.rows.length === 0) {
      return NextResponse.json({ error: "Cet enseignement ne vous appartient pas" }, { status: 403 });
    }

    let fichier_url = null;
    if (fichier && fichier.size > 0) {
      const bytes = await fichier.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${Date.now()}-${fichier.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "lecons");
      
      try {
        await writeFile(path.join(uploadDir, fileName), buffer);
        fichier_url = `/uploads/lecons/${fileName}`;
      } catch (err) {
        console.error("Erreur écriture fichier:", err);
      }
    }

    // ⭐ INSERT avec le champ matiere_personnalisee
    const result = await query(`
      INSERT INTO lecons (
        enseignement_id, 
        titre, 
        description, 
        fichier_url, 
        video_url, 
        date_publication,
        matiere_personnalisee
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6)
      RETURNING id
    `, [enseignement_id, titre, description || null, fichier_url, video_url || null, matiere_personnalisee || null]);

    return NextResponse.json({ success: true, leconId: result.rows[0].id });
  } catch (error) {
    console.error("Erreur POST lecons:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}