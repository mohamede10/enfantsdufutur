// app/api/admin/transport/lignes/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const result = await query(`
      SELECT 
        l.id,
        l.nom,
        l.prix_abonnement,
        b.immatriculation as bus_immatriculation
      FROM lignes_transport l
      LEFT JOIN bus b ON l.bus_id = b.id
      ORDER BY l.nom
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur GET lignes transport:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}