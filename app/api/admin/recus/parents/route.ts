// app/api/admin/recus/parents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const annee = searchParams.get("annee") || new Date().getFullYear().toString();

    // Récupérer tous les parents avec leurs statistiques de reçus
    const result = await query(`
      WITH recus_parent AS (
        -- Paiements pré-inscription
        SELECT 
          pa.id as parent_id,
          up.nom,
          up.prenom,
          up.email,
          up.telephone,
          pay.montant,
          pay.date_paiement,
          CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0')) AS numero_recu,
          'paiement' as source,
          pay.id as source_id
        FROM paiements pay
        JOIN preinscriptions p ON pay.preinscription_id = p.id
        JOIN parents pa ON p.parent_id = pa.id
        JOIN utilisateurs up ON pa.utilisateur_id = up.id
        WHERE pay.statut = 'valide'
          AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        
        UNION ALL
        
        -- Paiements réinscription
        SELECT 
          pa.id as parent_id,
          up.nom,
          up.prenom,
          up.email,
          up.telephone,
          pay.montant,
          pay.date_paiement,
          CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0')) AS numero_recu,
          'paiement' as source,
          pay.id as source_id
        FROM paiements pay
        JOIN reinscriptions r ON pay.reinscription_id = r.id
        JOIN parents pa ON r.parent_id = pa.id
        JOIN utilisateurs up ON pa.utilisateur_id = up.id
        WHERE pay.statut = 'valide'
          AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        
        UNION ALL
        
        -- Paiements élèves directs
        SELECT 
          pa.id as parent_id,
          up.nom,
          up.prenom,
          up.email,
          up.telephone,
          pay.montant,
          pay.date_paiement,
          CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0')) AS numero_recu,
          'paiement' as source,
          pay.id as source_id
        FROM paiements pay
        JOIN eleves e ON pay.eleve_id = e.id
        JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
        JOIN parents pa ON lpe.parent_id = pa.id
        JOIN utilisateurs up ON pa.utilisateur_id = up.id
        WHERE pay.statut = 'valide'
          AND pay.preinscription_id IS NULL
          AND pay.reinscription_id IS NULL
          AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        
        UNION ALL
        
        -- Reçus de la table recus (uniquement ceux qui ne sont pas déjà dans les paiements)
        SELECT 
          pa.id as parent_id,
          up.nom,
          up.prenom,
          up.email,
          up.telephone,
          r.montant,
          r.date_paiement,
          r.numero_recu,
          r.source,
          r.paiement_id as source_id
        FROM recus r
        LEFT JOIN preinscriptions p ON r.preinscription_id = p.id
        LEFT JOIN parents pa ON p.parent_id = pa.id
        LEFT JOIN utilisateurs up ON pa.utilisateur_id = up.id
        WHERE EXTRACT(YEAR FROM r.date_paiement) = $1
          AND r.numero_recu IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM paiements pay 
            WHERE pay.id = r.paiement_id
          )
      )
      SELECT 
        parent_id,
        nom,
        prenom,
        email,
        telephone,
        COUNT(*) as total_recus,
        SUM(montant) as total_montant,
        MAX(date_paiement) as dernier_paiement,
        MIN(date_paiement) as premier_paiement,
        jsonb_agg(
          jsonb_build_object(
            'numero_recu', numero_recu,
            'montant', montant,
            'date_paiement', date_paiement,
            'source', source,
            'source_id', source_id
          ) ORDER BY date_paiement DESC
        ) as recus
      FROM recus_parent
      GROUP BY parent_id, nom, prenom, email, telephone
      HAVING COUNT(*) > 0
      ORDER BY total_montant DESC
    `, [annee]);

    // Filtrer par recherche
    let parents = result.rows;
    if (search) {
      const searchLower = search.toLowerCase();
      parents = parents.filter((p: any) =>
        p.nom?.toLowerCase().includes(searchLower) ||
        p.prenom?.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(parents);
  } catch (error) {
    console.error("Erreur API /api/admin/recus/parents:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}