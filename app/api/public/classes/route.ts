// app/api/public/classes/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        id, 
        nom, 
        niveau, 
        frais_inscription,
        total_versement,
        reinscription_total_versement,
        reinscription_premier_versement,
        reinscription_deuxieme_versement,
        reinscription_troisieme_versement
      FROM classes 
      ORDER BY niveau, nom
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur:", error);
    return NextResponse.json([]);
  }
}