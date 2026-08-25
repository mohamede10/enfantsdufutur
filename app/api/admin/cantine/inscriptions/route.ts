// app/api/admin/cantine/inscriptions/route.ts
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
        ic.id,
        ic.eleve_id,
        ic.est_actif,
        ic.solde,
        ic.date_inscription,
        ic.mois_total,
        ic.mois_restants,
        ic.montant_mensuel,
        ic.montant_total,
        u.nom as eleve_nom,
        u.prenom as eleve_prenom,
        c.nom as classe_nom
      FROM inscriptions_cantine ic
      JOIN eleves e ON ic.eleve_id = e.id
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      WHERE ic.est_actif = true
      ORDER BY ic.date_inscription DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}