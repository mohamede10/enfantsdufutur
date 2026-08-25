// app/api/admin/transport/inscriptions/route.ts
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
        it.id,
        it.eleve_id,
        it.ligne_id,
        it.est_actif,
        it.solde,
        it.date_inscription,
        it.mois_total,
        it.mois_restants,
        it.montant_mensuel,
        it.montant_total,
        u.nom as eleve_nom,
        u.prenom as eleve_prenom,
        c.nom as classe_nom,
        l.nom as ligne_nom,
        b.immatriculation as bus_immatriculation
      FROM inscriptions_transport it
      JOIN eleves e ON it.eleve_id = e.id
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN lignes_transport l ON it.ligne_id = l.id
      LEFT JOIN bus b ON l.bus_id = b.id
      WHERE it.est_actif = true
      ORDER BY it.date_inscription DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Erreur GET inscriptions transport:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}