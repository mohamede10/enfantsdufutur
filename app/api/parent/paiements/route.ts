// app/api/parent/paiements/route.ts pour historiques 
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const preinscriptionId = searchParams.get("preinscriptionId");

    if (!preinscriptionId) {
      return NextResponse.json({ error: "ID de pré-inscription requis" }, { status: 400 });
    }

    // Récupérer tous les paiements pour cette pré-inscription
    const result = await query(`
      SELECT 
        id,
        montant,
        mode_paiement,
        date_paiement,
        reference_transaction as reference,
        type_frais
      FROM paiements
      WHERE preinscription_id = $1
        AND statut = 'valide'
      ORDER BY date_paiement ASC
    `, [parseInt(preinscriptionId)]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur historique paiements:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}