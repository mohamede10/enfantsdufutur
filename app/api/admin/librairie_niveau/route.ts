// app/api/admin/librairie_niveau/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Récupérer tous les articles avec niveaux_cibles
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const result = await query(`
      SELECT id, nom, description, prix_unitaire, quantite_stock, categorie, image_url, niveaux_cibles
      FROM articles_librairie
      ORDER BY categorie, nom
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur GET librairie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Créer un article
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { nom, description, prix_unitaire, quantite_stock, categorie, image_url, niveaux_cibles } = body;

    if (!nom || !prix_unitaire) {
      return NextResponse.json({ error: "Nom et prix unitaire requis" }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO articles_librairie (nom, description, prix_unitaire, quantite_stock, categorie, image_url, niveaux_cibles)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [nom, description || null, prix_unitaire, quantite_stock || 0, categorie || 'fourniture', image_url || null, niveaux_cibles || null]);

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Erreur POST librairie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT - Modifier un article
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { id, nom, description, prix_unitaire, quantite_stock, categorie, image_url, niveaux_cibles } = body;

    if (!id || !nom || !prix_unitaire) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    await query(`
      UPDATE articles_librairie
      SET nom = $1, description = $2, prix_unitaire = $3, quantite_stock = $4, categorie = $5, image_url = $6, niveaux_cibles = $7
      WHERE id = $8
    `, [nom, description || null, prix_unitaire, quantite_stock || 0, categorie || 'fourniture', image_url || null, niveaux_cibles || null, id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur PUT librairie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE - Supprimer un article
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await query("DELETE FROM articles_librairie WHERE id = $1", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE librairie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}