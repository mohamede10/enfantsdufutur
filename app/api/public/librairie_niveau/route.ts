import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        id,
        nom,
        prix_unitaire,
        quantite_stock,
        niveaux_cibles
      FROM articles_librairie
      WHERE niveaux_cibles IS NOT NULL AND array_length(niveaux_cibles, 1) > 0
      ORDER BY nom ASC
    `);

    const articles = result.rows.map(r => ({
      id: r.id,
      nom: r.nom || "Article sans nom",
      prix_unitaire: Number(r.prix_unitaire) || 0,
      quantite_stock: Number(r.quantite_stock) || 0,
      niveaux_cibles: r.niveaux_cibles || [],
    }));

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Erreur API publique librairie_niveau:", error);
    return NextResponse.json([], { status: 200 });
  }
}