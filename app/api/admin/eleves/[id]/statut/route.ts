// app/api/admin/eleves/[id]/statut/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "COMPTABLE")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const resolvedParams = await params;
    const eleveId = parseInt(resolvedParams.id);

    if (isNaN(eleveId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await request.json();
    const { statut } = body;

    if (!statut || !["actif", "inactif", "suspendu"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    // Vérifier si l'élève existe
    const checkResult = await query(
      "SELECT id FROM eleves WHERE id = $1",
      [eleveId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    // Mettre à jour le statut
    const updateResult = await query(
      `UPDATE eleves 
       SET est_inscrit = $1, updated_at = NOW() 
       WHERE id = $2
       RETURNING id`,
      [statut === "actif", eleveId]
    );

    return NextResponse.json({
      success: true,
      message: "Statut mis à jour avec succès",
      statut
    });

  } catch (error) {
    console.error("Erreur update statut:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du statut" },
      { status: 500 }
    );
  }
}