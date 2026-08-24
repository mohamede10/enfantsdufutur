// app/api/admin/recus/route.ts
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
    const mois = searchParams.get("mois") || "";
    const annee = searchParams.get("annee") || new Date().getFullYear().toString();
    const parentId = searchParams.get("parentId") || "";

    const params: any[] = [annee];
    if (mois) params.push(mois);

    const moisFilter = mois ? `AND EXTRACT(MONTH FROM pay.date_paiement) = $${params.indexOf(mois) + 1}` : "";
    const parentFilter = parentId ? `AND pa.id = ${parseInt(parentId)}` : "";
    const searchFilter = search
      ? `AND (
          LOWER(pay_enfant) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR
          LOWER(parent_nom_str) LIKE LOWER('%${search.replace(/'/g, "''")}%')
        )`
      : "";

    // ─────────────────────────────────────────────────────────────────
    // 1. Paiements liés à une PRÉ-INSCRIPTION (avec preinscription_id)
    //    Couvre paiement-global, paiement-preinscription, paiement-echeance
    // ─────────────────────────────────────────────────────────────────
    const paiPreinsResult = await query(`
      SELECT
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0'))              AS numero_recu,
        pay.date_paiement                                            AS date_paiement,
        p.enfant_prenom || ' ' || p.enfant_nom                      AS enfant,
        pay.montant                                                  AS montant,
        COALESCE(pay.mode_paiement, 'especes')                      AS mode_paiement,
        COALESCE(pay.type_frais, 'inscription')                     AS type_frais,
        COALESCE(pay.reference_transaction, p.numero_dossier, CONCAT('PAY-', pay.id)) AS reference,
        p.classe                                                     AS classe,
        up.prenom || ' ' || up.nom                                  AS parent_nom,
        up.email                                                     AS parent_email,
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN preinscriptions p ON pay.preinscription_id = p.id
      JOIN parents pa ON p.parent_id = pa.id
      JOIN utilisateurs up ON pa.utilisateur_id = up.id
      WHERE pay.statut = 'valide'
        AND pay.preinscription_id IS NOT NULL
        AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        ${mois ? `AND EXTRACT(MONTH FROM pay.date_paiement) = $2` : ""}
        ${parentId ? `AND pa.id = ${parseInt(parentId)}` : ""}
        ${search ? `AND (
          LOWER(p.enfant_nom || ' ' || p.enfant_prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR
          LOWER(up.nom || ' ' || up.prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%')
        )` : ""}
      ORDER BY pay.date_paiement DESC
    `, mois ? [annee, mois] : [annee]);

    // ─────────────────────────────────────────────────────────────────
    // 2. Paiements liés à une RÉINSCRIPTION (avec reinscription_id)
    // ─────────────────────────────────────────────────────────────────
    const paiReinsResult = await query(`
      SELECT
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0'))              AS numero_recu,
        pay.date_paiement                                            AS date_paiement,
        COALESCE(ue.prenom || ' ' || ue.nom, r.enfant_prenom || ' ' || r.enfant_nom) AS enfant,
        pay.montant                                                  AS montant,
        COALESCE(pay.mode_paiement, 'especes')                      AS mode_paiement,
        COALESCE(pay.type_frais, 'reinscription')                   AS type_frais,
        COALESCE(pay.reference_transaction, CONCAT('REIN-', r.id)) AS reference,
        COALESCE(c.nom, r.classe_nom)                               AS classe,
        up.prenom || ' ' || up.nom                                  AS parent_nom,
        up.email                                                     AS parent_email,
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN reinscriptions r ON pay.reinscription_id = r.id
      LEFT JOIN eleves e ON r.eleve_id = e.id
      LEFT JOIN utilisateurs ue ON e.utilisateur_id = ue.id
      LEFT JOIN classes c ON r.classe_id = c.id
      JOIN parents pa ON r.parent_id = pa.id
      JOIN utilisateurs up ON pa.utilisateur_id = up.id
      WHERE pay.statut = 'valide'
        AND pay.reinscription_id IS NOT NULL
        AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        ${mois ? `AND EXTRACT(MONTH FROM pay.date_paiement) = $2` : ""}
        ${parentId ? `AND pa.id = ${parseInt(parentId)}` : ""}
        ${search ? `AND (
          LOWER(COALESCE(ue.nom || ' ' || ue.prenom, r.enfant_nom)) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR
          LOWER(up.nom || ' ' || up.prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%')
        )` : ""}
      ORDER BY pay.date_paiement DESC
    `, mois ? [annee, mois] : [annee]);

    // ─────────────────────────────────────────────────────────────────
    // 3. Paiements directs sur un ÉLÈVE (sans preinscription ni réinscription)
    // ─────────────────────────────────────────────────────────────────
    const paiEleveResult = await query(`
      SELECT
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0'))              AS numero_recu,
        pay.date_paiement                                            AS date_paiement,
        ue.prenom || ' ' || ue.nom                                  AS enfant,
        pay.montant                                                  AS montant,
        COALESCE(pay.mode_paiement, 'especes')                      AS mode_paiement,
        COALESCE(pay.type_frais, 'scolarite')                       AS type_frais,
        COALESCE(pay.reference_transaction, CONCAT('PAY-', pay.id)) AS reference,
        c.nom                                                        AS classe,
        up.prenom || ' ' || up.nom                                  AS parent_nom,
        up.email                                                     AS parent_email,
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN eleves e ON pay.eleve_id = e.id
      JOIN utilisateurs ue ON e.utilisateur_id = ue.id
      LEFT JOIN classes c ON e.classe_id = c.id
      JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      JOIN parents pa ON lpe.parent_id = pa.id
      JOIN utilisateurs up ON pa.utilisateur_id = up.id
      WHERE pay.statut = 'valide'
        AND pay.eleve_id IS NOT NULL
        AND pay.preinscription_id IS NULL
        AND pay.reinscription_id IS NULL
        AND EXTRACT(YEAR FROM pay.date_paiement) = $1
        ${mois ? `AND EXTRACT(MONTH FROM pay.date_paiement) = $2` : ""}
        ${parentId ? `AND pa.id = ${parseInt(parentId)}` : ""}
        ${search ? `AND (
          LOWER(ue.nom || ' ' || ue.prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR
          LOWER(up.nom || ' ' || up.prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%')
        )` : ""}
      ORDER BY pay.date_paiement DESC
    `, mois ? [annee, mois] : [annee]);

    // ─────────────────────────────────────────────────────────────────
    // 4. Pré-inscriptions payées via frais_statut (sans paiement direct)
    //    → cas anciens paiements non tracés dans la table paiements
    // ─────────────────────────────────────────────────────────────────
    const preinscriptionsResult = await query(`
      SELECT
        CONCAT('REC-PI-', LPAD(p.id::text, 5, '0'))   AS numero_recu,
        p.frais_date_paiement                          AS date_paiement,
        p.enfant_prenom || ' ' || p.enfant_nom         AS enfant,
        p.frais_montant                                AS montant,
        COALESCE(p.frais_mode_paiement, 'especes')     AS mode_paiement,
        'Frais de pré-inscription'                     AS type_frais,
        COALESCE(p.frais_reference, p.numero_dossier)  AS reference,
        p.classe                                       AS classe,
        up.prenom || ' ' || up.nom                    AS parent_nom,
        up.email                                       AS parent_email,
        'preinscription'                               AS source,
        p.id                                           AS source_id
      FROM preinscriptions p
      JOIN parents pa ON p.parent_id = pa.id
      JOIN utilisateurs up ON pa.utilisateur_id = up.id
      WHERE p.frais_statut = 'paye'
        AND p.frais_date_paiement IS NOT NULL
        AND EXTRACT(YEAR FROM p.frais_date_paiement) = $1
        ${mois ? `AND EXTRACT(MONTH FROM p.frais_date_paiement) = $2` : ""}
        ${parentId ? `AND pa.id = ${parseInt(parentId)}` : ""}
        AND NOT EXISTS (
          SELECT 1 FROM paiements pay WHERE pay.preinscription_id = p.id AND pay.statut = 'valide'
        )
        ${search ? `AND (
          LOWER(p.enfant_nom || ' ' || p.enfant_prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR
          LOWER(up.nom || ' ' || up.prenom) LIKE LOWER('%${search.replace(/'/g, "''")}%')
        )` : ""}
      ORDER BY p.frais_date_paiement DESC
    `, mois ? [annee, mois] : [annee]);

    // Fusionner et trier par date décroissante
    const allRecus = [
      ...paiPreinsResult.rows,
      ...paiReinsResult.rows,
      ...paiEleveResult.rows,
      ...preinscriptionsResult.rows,
    ].sort((a, b) => {
      const dateA = new Date(a.date_paiement).getTime();
      const dateB = new Date(b.date_paiement).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(allRecus);
  } catch (error) {
    console.error("Erreur API /api/admin/recus:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
