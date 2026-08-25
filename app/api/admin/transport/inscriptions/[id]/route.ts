// app/api/admin/transport/inscriptions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { mois, montantMensuel, montantTotal } = body;

    await query(`
      UPDATE inscriptions_transport 
      SET 
        mois_total = $1,
        mois_restants = $1,
        montant_mensuel = $2,
        montant_total = $3,
        solde = $4
      WHERE id = $5
    `, [mois, montantMensuel, montantTotal, montantTotal, id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur PUT inscription transport:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    // Désactiver (soft delete)
    await query(`
      UPDATE inscriptions_transport 
      SET est_actif = false 
      WHERE id = $1
    `, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE inscription transport:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}