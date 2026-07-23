// app/api/admin/salaires/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const safeParseJSON = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

// GET - Liste des salaires avec statut de paiement pour un mois/année
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE" && userRole !== "DIRECTEUR_GENERAL")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const url = new URL(request.url);
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    const result = await query(`
      SELECT 
        p.id as personnel_id,
        p.matricule_personnel as matricule,
        p.type as poste,
        p.departement,
        p.statut,
        p.salaire_base,
        COALESCE(p.prime_mensuelle, 0) as prime_mensuelle,
        (p.salaire_base + COALESCE(p.prime_mensuelle, 0)) as salaire_total,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        CONCAT(u.prenom, ' ', u.nom) as employe,
        ps.id as paiement_id,
        ps.montant as montant_paye,
        ps.statut as statut_paiement,
        ps.date_paiement,
        ps.mode_paiement,
        ps.reference_transaction,
        COALESCE(ps.salaire_base, p.salaire_base, 0) as ps_salaire_base,
        COALESCE(ps.prime_mensuelle, p.prime_mensuelle, 0) as ps_prime_mensuelle,
        COALESCE(ps.prime_responsabilite, 0) as prime_responsabilite,
        COALESCE(ps.prime_craie, 0) as prime_craie,
        COALESCE(ps.retenue_sanction, 0) as retenue_sanction,
        COALESCE(ps.autres_retenues, 0) as autres_retenues,
        COALESCE(ps.details_lignes, '[]'::jsonb) as details_lignes,
        COALESCE(ps.total_brut, 0) as total_brut,
        COALESCE(ps.total_deductions, 0) as total_deductions
      FROM personnels p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      LEFT JOIN paiements_salaires ps ON (
        ps.personnel_id = p.id 
        AND ps.mois = $1 
        AND ps.annee = $2
      )
      WHERE u.est_actif = true
      ORDER BY u.nom ASC, u.prenom ASC
    `, [month, year]);

    const salaires = result.rows.map(row => ({
      personnel_id: row.personnel_id,
      matricule: row.matricule,
      employe: row.employe,
      poste: row.poste,
      departement: row.departement,
      statut_agent: row.statut || 'actif',
      salaire_base: Number(row.ps_salaire_base || row.salaire_base || 0),
      prime_mensuelle: Number(row.ps_prime_mensuelle || row.prime_mensuelle || 0),
      prime_responsabilite: Number(row.prime_responsabilite || 0),
      prime_craie: Number(row.prime_craie || 0),
      retenue_sanction: Number(row.retenue_sanction || 0),
      autres_retenues: Number(row.autres_retenues || 0),
      details_lignes: safeParseJSON(row.details_lignes),
      total_brut: Number(row.total_brut || 0),
      total_deductions: Number(row.total_deductions || 0),
      salaire_total: Number(row.salaire_total || 0),
      paiement_id: row.paiement_id,
      montant_paye: row.montant_paye ? Number(row.montant_paye) : null,
      statut: row.statut_paiement || 'non_paye',
      date_paiement: row.date_paiement ? new Date(row.date_paiement).toISOString().split('T')[0] : null,
      mode_paiement: row.mode_paiement,
      reference_transaction: row.reference_transaction
    }));

    return NextResponse.json(salaires);
  } catch (error) {
    console.error("Erreur API Salaires GET:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Enregistrer ou mettre à jour le paiement d'un salaire
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || (userRole !== "SUPER_ADMIN" && userRole !== "COMPTABLE" && userRole !== "DIRECTEUR_GENERAL")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const {
      personnel_id,
      mois,
      annee,
      salaire_base = 0,
      prime_mensuelle = 0,
      prime_responsabilite = 0,
      prime_craie = 0,
      retenue_sanction = 0,
      autres_retenues = 0,
      details_lignes = [],
      total_brut,
      total_deductions,
      mode_paiement,
      reference_transaction
    } = body;

    if (!personnel_id || !mois || !annee) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const calculatedBrut = total_brut !== undefined ? Number(total_brut) :
      (Number(salaire_base) + Number(prime_mensuelle) + Number(prime_responsabilite) + Number(prime_craie));

    const sumLinesDeductions = Array.isArray(details_lignes)
      ? details_lignes.reduce((acc: number, item: any) => acc + Number(item.montant || 0), 0)
      : 0;

    const calculatedDeductions = total_deductions !== undefined ? Number(total_deductions) :
      (Number(retenue_sanction) + Number(autres_retenues) + sumLinesDeductions);

    const calculatedTotalNet = calculatedBrut - calculatedDeductions;
    const montant = body.montant !== undefined ? Number(body.montant) : calculatedTotalNet;

    // Vérifier si déjà payé -> Si oui, mettre à jour
    const existing = await query(
      "SELECT id FROM paiements_salaires WHERE personnel_id = $1 AND mois = $2 AND annee = $3",
      [personnel_id, mois, annee]
    );

    if (existing.rows.length > 0) {
      await query(`
        UPDATE paiements_salaires
        SET montant = $1, statut = 'paye', mode_paiement = $2, reference_transaction = $3,
            salaire_base = $4, prime_mensuelle = $5, prime_responsabilite = $6, prime_craie = $7,
            retenue_sanction = $8, autres_retenues = $9, details_lignes = $10,
            total_brut = $11, total_deductions = $12, date_paiement = CURRENT_TIMESTAMP, saisie_par = $13
        WHERE id = $14
      `, [
        montant, mode_paiement || 'virement', reference_transaction || null,
        Number(salaire_base), Number(prime_mensuelle), Number(prime_responsabilite), Number(prime_craie),
        Number(retenue_sanction), Number(autres_retenues), JSON.stringify(details_lignes),
        calculatedBrut, calculatedDeductions, userId || null, existing.rows[0].id
      ]);
      return NextResponse.json({ success: true, message: "Paiement mis à jour avec succès" });
    } else {
      await query(`
        INSERT INTO paiements_salaires (
          personnel_id, mois, annee, montant, statut, mode_paiement, reference_transaction,
          salaire_base, prime_mensuelle, prime_responsabilite, prime_craie, retenue_sanction, autres_retenues,
          details_lignes, total_brut, total_deductions, saisie_par
        )
        VALUES ($1, $2, $3, $4, 'paye', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        personnel_id, mois, annee, montant, mode_paiement || 'virement', reference_transaction || null,
        Number(salaire_base), Number(prime_mensuelle), Number(prime_responsabilite), Number(prime_craie),
        Number(retenue_sanction), Number(autres_retenues), JSON.stringify(details_lignes),
        calculatedBrut, calculatedDeductions, userId || null
      ]);
      return NextResponse.json({ success: true, message: "Salaire enregistré avec succès" });
    }
  } catch (error) {
    console.error("Erreur API Salaires POST:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE - Annuler un paiement de salaire
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Non autorisé - SUPER_ADMIN requis" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    await query("DELETE FROM paiements_salaires WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API Salaires DELETE:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}