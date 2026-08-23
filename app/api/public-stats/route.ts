// app/api/public-stats/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1️⃣ Compter les ÉLÈVES
    let totalEleves = 0;
    try {
      const elevesRes = await query("SELECT COUNT(*) as total FROM eleves");
      if (elevesRes.rows.length > 0) {
        totalEleves = parseInt(elevesRes.rows[0].total) || 0;
      }
      console.log("📊 Élèves:", totalEleves);
    } catch (e) {
      console.error("Error querying eleves count:", e);
    }

    // 2️⃣ Compter les PERSONNELS
    let totalPersonnels = 0;
    try {
      const personnelsRes = await query("SELECT COUNT(*) as total FROM personnels");
      if (personnelsRes.rows.length > 0) {
        totalPersonnels = parseInt(personnelsRes.rows[0].total) || 0;
      }
      console.log("📊 Personnels (total):", totalPersonnels);
    } catch (e) {
      console.error("Error querying personnels count:", e);
    }

    // 3️⃣ Compter les ENSEIGNANTS UNIQUEMENT (optionnel)
    let totalEnseignants = 0;
    try {
      const enseignantsRes = await query("SELECT COUNT(*) as total FROM personnels WHERE type = 'enseignant'");
      if (enseignantsRes.rows.length > 0) {
        totalEnseignants = parseInt(enseignantsRes.rows[0].total) || 0;
      }
      console.log("📊 Enseignants uniquement:", totalEnseignants);
    } catch (e) {
      console.error("Error querying enseignants count:", e);
    }

    // 4️⃣ Compter les CLASSES
    let totalClasses = 0;
    try {
      const classesRes = await query("SELECT COUNT(*) as total FROM classes");
      if (classesRes.rows.length > 0) {
        totalClasses = parseInt(classesRes.rows[0].total) || 0;
      }
      console.log("📊 Classes:", totalClasses);
    } catch (e) {
      console.error("Error querying classes count:", e);
    }

    const tauxReussite = 100;

    // ✅ RÉPONSE AVEC TOUTES LES INFOS
    return NextResponse.json({
      students: totalEleves,
      teachers: totalPersonnels,      // ← Total du personnel
      enseignants: totalEnseignants,  // ← Enseignants uniquement
      classes: totalClasses,
      success: tauxReussite
    });
  } catch (error) {
    console.error("Error in public-stats API:", error);
    return NextResponse.json({
      students: 0,
      teachers: 0,
      enseignants: 0,
      classes: 0,
      success: 100
    });
  }
}