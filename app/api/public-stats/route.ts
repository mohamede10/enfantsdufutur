// app/api/public-stats/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Valeurs par défaut (à afficher si la base est vide)
    let totalEleves = 1250;
    let totalEnseignants = 85;
    let totalClasses = 32;

    // 1️⃣ Compter les ÉLÈVES
    try {
      const elevesRes = await query("SELECT COUNT(*) as total FROM eleves");
      if (elevesRes.rows.length > 0) {
        const count = parseInt(elevesRes.rows[0].total) || 0;
        if (count > 0) {
          totalEleves = count;
        }
      }
    } catch (e) {
      console.error("Error querying eleves count:", e);
    }

    // 2️⃣ Compter TOUS les PERSONNELS (enseignants + administratifs)
    try {
      const enseignantsRes = await query("SELECT COUNT(*) as total FROM personnels");
      if (enseignantsRes.rows.length > 0) {
        const count = parseInt(enseignantsRes.rows[0].total) || 0;
        if (count > 0) {
          totalEnseignants = count;
        }
      }
    } catch (e) {
      console.error("Error querying personnels count:", e);
    }

    // 3️⃣ Compter les CLASSES
    try {
      const classesRes = await query("SELECT COUNT(*) as total FROM classes");
      if (classesRes.rows.length > 0) {
        const count = parseInt(classesRes.rows[0].total) || 0;
        if (count > 0) {
          totalClasses = count;
        }
      }
    } catch (e) {
      console.error("Error querying classes count:", e);
    }

    return NextResponse.json({
      students: totalEleves,
      teachers: totalEnseignants,
      classes: totalClasses,
      success: 100
    });
  } catch (error) {
    console.error("Error in public-stats API:", error);
    return NextResponse.json({
      students: 1250,
      teachers: 85,
      classes: 32,
      success: 100
    });
  }
}