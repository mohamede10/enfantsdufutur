// app/api/admin/enseignants/[id]/assignations/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ⭐ GET - Récupérer les classes assignées
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const enseignantId = parseInt(id);

    if (isNaN(enseignantId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const result = await query(`
      SELECT 
        c.id,
        c.nom,
        c.niveau
      FROM enseignements e
      JOIN classes c ON e.classe_id = c.id
      WHERE e.enseignant_id = $1
      AND e.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE est_active = true)
      ORDER BY c.niveau, c.nom
    `, [enseignantId]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur GET assignations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ⭐ POST - AJOUTER UNIQUEMENT les nouvelles classes (SANS SUPPRIMER)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE" && userRole !== "DIRECTEUR_GENERAL") {
      return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
    }

    const { id } = await params;
    const enseignantId = parseInt(id);

    if (isNaN(enseignantId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await request.json();
    const { classeIds } = body;

    if (!classeIds || !Array.isArray(classeIds)) {
      return NextResponse.json({ error: "Liste de classes requise" }, { status: 400 });
    }

    // Récupérer l'année scolaire active
    const anneeResult = await query(`
      SELECT id FROM annees_scolaires WHERE est_active = true LIMIT 1
    `);
    
    if (anneeResult.rows.length === 0) {
      return NextResponse.json({ error: "Aucune année scolaire active" }, { status: 400 });
    }
    
    const anneeScolaireId = anneeResult.rows[0].id;

    // Vérifier que l'enseignant existe
    const enseignantResult = await query(`
      SELECT id FROM personnels WHERE id = $1 AND (type = 'enseignant' OR type = 'ENSEIGNANT')
    `, [enseignantId]);
    
    if (enseignantResult.rows.length === 0) {
      return NextResponse.json({ error: "Enseignant non trouvé" }, { status: 404 });
    }

    // ⭐⭐⭐ SOLUTION : NE PAS SUPPRIMER, AJOUTER UNIQUEMENT ⭐⭐⭐
    let addedCount = 0;
    let alreadyExistsCount = 0;
    const results = [];

    for (const classeId of classeIds) {
      // Vérifier si l'assignation existe déjà
      const existing = await query(`
        SELECT id FROM enseignements 
        WHERE enseignant_id = $1 AND classe_id = $2 AND annee_scolaire_id = $3
      `, [enseignantId, classeId, anneeScolaireId]);

      if (existing.rows.length > 0) {
        alreadyExistsCount++;
        results.push({
          classeId,
          status: 'already_exists',
          message: 'Déjà assignée'
        });
        continue;
      }

      // Ajouter la nouvelle assignation
      await query(`
        INSERT INTO enseignements (enseignant_id, classe_id, annee_scolaire_id)
        VALUES ($1, $2, $3)
      `, [enseignantId, classeId, anneeScolaireId]);
      
      addedCount++;
      results.push({
        classeId,
        status: 'added',
        message: 'Assignée avec succès'
      });
    }

    await query('COMMIT');

    const message = addedCount > 0 
      ? `${addedCount} classe(s) assignée(s) avec succès${alreadyExistsCount > 0 ? `, ${alreadyExistsCount} déjà assignée(s)` : ''}`
      : "Aucune nouvelle classe à assigner";

    return NextResponse.json({ 
      success: true, 
      message,
      addedCount,
      alreadyExistsCount,
      total: classeIds.length,
      results
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error("Erreur POST assignations:", error);
    return NextResponse.json({ error: "Erreur serveur: " + (error as Error).message }, { status: 500 });
  }
}

// ⭐ DELETE - Supprimer une assignation spécifique (avec gestion des dépendances)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE") {
      return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
    }

    const { id } = await params;
    const enseignantId = parseInt(id);

    if (isNaN(enseignantId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const classeId = searchParams.get("classeId");

    if (!classeId) {
      return NextResponse.json({ error: "ID de classe requis" }, { status: 400 });
    }

    // Récupérer l'année scolaire active
    const anneeResult = await query(`
      SELECT id FROM annees_scolaires WHERE est_active = true LIMIT 1
    `);
    const anneeScolaireId = anneeResult.rows[0]?.id;

    // ⭐ Vérifier si l'assignation a des leçons avant de supprimer
    const leconsCheck = await query(`
      SELECT COUNT(*) as count 
      FROM lecons l
      JOIN enseignements e ON l.enseignement_id = e.id
      WHERE e.enseignant_id = $1 AND e.classe_id = $2 AND e.annee_scolaire_id = $3
    `, [enseignantId, parseInt(classeId), anneeScolaireId]);

    if (parseInt(leconsCheck.rows[0]?.count) > 0) {
      return NextResponse.json({ 
        error: "Impossible de supprimer cette assignation car elle contient des leçons" 
      }, { status: 400 });
    }

    await query(`
      DELETE FROM enseignements 
      WHERE enseignant_id = $1 AND classe_id = $2 AND annee_scolaire_id = $3
    `, [enseignantId, parseInt(classeId), anneeScolaireId]);

    return NextResponse.json({ 
      success: true, 
      message: "Assignation supprimée avec succès" 
    });
  } catch (error) {
    console.error("Erreur DELETE assignations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}