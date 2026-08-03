import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Get personnel_id of the logged in user
    const personnelResult = await query(`
      SELECT p.id 
      FROM personnels p
      WHERE p.utilisateur_id = $1 AND LOWER(p.type) = 'enseignant'
    `, [userId]);

    if (personnelResult.rows.length === 0) {
      return NextResponse.json({ error: "Enseignant non trouvé" }, { status: 404 });
    }
    const enseignantId = personnelResult.rows[0].id;

    // Fetch enseignements
    const result = await query(`
      SELECT e.id, c.nom as classe, COALESCE(m.nom, 'Général') as matiere
      FROM enseignements e
      JOIN classes c ON e.classe_id = c.id
      LEFT JOIN matieres m ON e.matiere_id = m.id
      WHERE e.enseignant_id = $1
      ORDER BY c.nom ASC
    `, [enseignantId]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur GET enseignements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
