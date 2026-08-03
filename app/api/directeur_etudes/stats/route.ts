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

    // Classes actives
    const classesRes = await query(`SELECT COUNT(*) as count FROM classes WHERE est_actif = true`);
    
    // Notes saisies
    const notesRes = await query(`SELECT COUNT(*) as count FROM notes`);
    
    // Élèves inscrits
    const elevesRes = await query(`SELECT COUNT(*) as count FROM eleves WHERE est_inscrit = true`);
    
    // Élèves avec au moins une note (proxy pour bulletins potentiels)
    const bulletinsRes = await query(`SELECT COUNT(DISTINCT eleve_id) as count FROM notes`);

    return NextResponse.json({
      classesActives: parseInt(classesRes.rows[0].count) || 0,
      notesSaisies: parseInt(notesRes.rows[0].count) || 0,
      elevesInscrits: parseInt(elevesRes.rows[0].count) || 0,
      elevesEvalues: parseInt(bulletinsRes.rows[0].count) || 0,
    });

  } catch (error: any) {
    console.error("API /directeur_etudes/stats GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
