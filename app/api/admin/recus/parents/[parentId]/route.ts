// app/api/admin/recus/parents/[parentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ⭐ CORRECTION : params doit être traité comme une Promise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const allowedRoles = ["SUPER_ADMIN", "COMPTABLE", "ADMIN", "DIRECTEUR_GENERAL", "DIRECTEUR"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // ⭐ CORRECTION : Déballer params avec await
    const { parentId } = await params;
    const parentIdInt = parseInt(parentId);

    if (isNaN(parentIdInt)) {
      return NextResponse.json({ error: "ID parent invalide" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const annee = searchParams.get("annee") || new Date().getFullYear().toString();

    console.log(`🔍 Recherche des reçus pour le parent ${parentIdInt}, année ${annee}`);

    // 1. Récupérer les infos du parent
    const parentResult = await query(`
      SELECT 
        p.id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.adresse
      FROM parents p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      WHERE p.id = $1
    `, [parentIdInt]);

    if (parentResult.rows.length === 0) {
      return NextResponse.json({ error: "Parent non trouvé" }, { status: 404 });
    }

    const parent = parentResult.rows[0];

    // 2. Récupérer tous les paiements de pré-inscription du parent
    const paiementsResult = await query(`
      SELECT 
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0')) AS numero_recu,
        pay.date_paiement,
        p.enfant_prenom || ' ' || p.enfant_nom AS enfant,
        pay.montant,
        COALESCE(pay.mode_paiement, 'especes') AS mode_paiement,
        COALESCE(pay.type_frais, 'inscription') AS type_frais,
        COALESCE(pay.reference_transaction, p.numero_dossier) AS reference,
        p.classe AS classe,
        COALESCE(p.montant_total_plan, 0) AS montant_total,
        COALESCE(p.montant_restant_plan, 0) AS reste_a_payer,
        'preinscription' AS source,
        pay.id AS source_id,
        pay.preinscription_id
      FROM paiements pay
      JOIN preinscriptions p ON pay.preinscription_id = p.id
      WHERE pay.statut = 'valide'
        AND p.parent_id = $1
        AND EXTRACT(YEAR FROM pay.date_paiement) = $2
      ORDER BY pay.date_paiement DESC
    `, [parentIdInt, parseInt(annee)]);

    console.log(`📊 ${paiementsResult.rows.length} paiements trouvés pour le parent ${parentIdInt}`);

    // 3. Récupérer les reçus de la table recus pour ce parent
    const recusResult = await query(`
      SELECT 
        r.numero_recu,
        r.date_paiement,
        r.enfant_nom AS enfant,
        r.montant,
        COALESCE(r.mode_paiement, 'especes') AS mode_paiement,
        COALESCE(r.type_frais, 'inscription') AS type_frais,
        r.reference,
        r.classe_nom AS classe,
        COALESCE(r.montant_total, 0) AS montant_total,
        COALESCE(r.reste_a_payer, 0) AS reste_a_payer,
        'recus' AS source,
        r.paiement_id AS source_id,
        r.preinscription_id
      FROM recus r
      LEFT JOIN preinscriptions p ON r.preinscription_id = p.id
      WHERE p.parent_id = $1
        AND EXTRACT(YEAR FROM r.date_paiement) = $2
      ORDER BY r.date_paiement DESC
    `, [parentIdInt, parseInt(annee)]);

    console.log(`📊 ${recusResult.rows.length} reçus trouvés dans la table recus`);

    // 4. Fusionner les résultats et éviter les doublons
    const allRecus = [...paiementsResult.rows, ...recusResult.rows];
    
    // Éliminer les doublons (par montant + date)
    const seen = new Set();
    const uniqueRecus = allRecus.filter((recu: any) => {
      const key = `${recu.montant}-${new Date(recu.date_paiement).toDateString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`✅ ${uniqueRecus.length} reçus uniques après dédoublonnage`);

    // Calculer les totaux
    const totalRecus = uniqueRecus.length;
    const totalMontant = uniqueRecus.reduce((acc, r) => acc + Number(r.montant), 0);
    const totalMontantTotal = uniqueRecus.reduce((acc, r) => acc + Number(r.montant_total || 0), 0);
    const totalReste = uniqueRecus.reduce((acc, r) => acc + Number(r.reste_a_payer || 0), 0);

    return NextResponse.json({
      parent,
      recus: uniqueRecus,
      statistiques: {
        total_recus: totalRecus,
        total_montant: totalMontant,
        total_montant_total: totalMontantTotal,
        total_reste: totalReste
      }
    });
  } catch (error) {
    console.error("Erreur API /api/admin/recus/parents/[parentId]:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + (error as Error).message },
      { status: 500 }
    );
  }
}