// app/api/parent/recus/route.ts
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

    const userEmail = session.user?.email;

    // Récupérer le parent_id
    const parentResult = await query(
      `SELECT p.id FROM parents p JOIN utilisateurs u ON p.utilisateur_id = u.id WHERE u.email = $1`,
      [userEmail]
    );

    if (parentResult.rows.length === 0) {
      return NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 });
    }

    const parentId = parentResult.rows[0].id;

    // ─────────────────────────────────────────────────────────────────
    // 1. Paiements liés à une PRÉ-INSCRIPTION (preinscription_id non null)
    //    → insérés par paiement-global, paiement-echeance, paiement-preinscription
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
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN preinscriptions p ON pay.preinscription_id = p.id
      WHERE p.parent_id = $1
        AND pay.statut = 'valide'
        AND pay.preinscription_id IS NOT NULL
      ORDER BY pay.date_paiement DESC
    `, [parentId]);

    // ─────────────────────────────────────────────────────────────────
    // 2. Paiements liés à une RÉINSCRIPTION (reinscription_id non null)
    //    → insérés par paiement-global, paiement-echeance, paiement-reinscription
    // ─────────────────────────────────────────────────────────────────
    const paiReinsResult = await query(`
      SELECT
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0'))              AS numero_recu,
        pay.date_paiement                                            AS date_paiement,
        COALESCE(ue.prenom || ' ' || ue.nom, r.enfant_prenom || ' ' || r.enfant_nom) AS enfant,
        pay.montant                                                  AS montant,
        COALESCE(pay.mode_paiement, 'especes')                      AS mode_paiement,
        COALESCE(pay.type_frais, 'reinscription')                   AS type_frais,
        COALESCE(pay.reference_transaction, CONCAT('REIN-', r.id))  AS reference,
        COALESCE(c.nom, r.classe_nom)                               AS classe,
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN reinscriptions r ON pay.reinscription_id = r.id
      LEFT JOIN eleves e ON r.eleve_id = e.id
      LEFT JOIN utilisateurs ue ON e.utilisateur_id = ue.id
      LEFT JOIN classes c ON r.classe_id = c.id
      WHERE r.parent_id = $1
        AND pay.statut = 'valide'
        AND pay.reinscription_id IS NOT NULL
      ORDER BY pay.date_paiement DESC
    `, [parentId]);

    // ─────────────────────────────────────────────────────────────────
    // 3. Paiements directs liés à un ÉLÈVE (eleve_id non null, sans preinscription ni réinscription)
    //    → insérés par paiement-global quand surplus imputé sur élève
    // ─────────────────────────────────────────────────────────────────
    const paiEleveResult = await query(`
      SELECT
        CONCAT('REC-PAY-', LPAD(pay.id::text, 5, '0'))              AS numero_recu,
        pay.date_paiement                                            AS date_paiement,
        u.prenom || ' ' || u.nom                                    AS enfant,
        pay.montant                                                  AS montant,
        COALESCE(pay.mode_paiement, 'especes')                      AS mode_paiement,
        COALESCE(pay.type_frais, 'scolarite')                       AS type_frais,
        COALESCE(pay.reference_transaction, CONCAT('PAY-', pay.id)) AS reference,
        c.nom                                                        AS classe,
        'paiement'                                                   AS source,
        pay.id                                                       AS source_id
      FROM paiements pay
      JOIN eleves e ON pay.eleve_id = e.id
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      WHERE lpe.parent_id = $1
        AND pay.statut = 'valide'
        AND pay.eleve_id IS NOT NULL
        AND pay.preinscription_id IS NULL
        AND pay.reinscription_id IS NULL
      ORDER BY pay.date_paiement DESC
    `, [parentId]);

    // ─────────────────────────────────────────────────────────────────
    // 4. Reçus de pré-inscriptions entièrement payées via frais_statut
    //    (cas paiement-preinscription qui met frais_statut = 'paye' sans insérer dans paiements)
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
        'preinscription'                               AS source,
        p.id                                           AS source_id
      FROM preinscriptions p
      WHERE p.parent_id = $1
        AND p.frais_statut = 'paye'
        AND p.frais_date_paiement IS NOT NULL
        -- Exclure celles déjà couvertes par un paiement dans la table paiements
        AND NOT EXISTS (
          SELECT 1 FROM paiements pay
          WHERE pay.preinscription_id = p.id AND pay.statut = 'valide'
        )
      ORDER BY p.frais_date_paiement DESC
    `, [parentId]);

    // ─────────────────────────────────────────────────────────────────
    // 5. Reçus de réinscriptions entièrement payées via frais_statut
    // ─────────────────────────────────────────────────────────────────
    const reinscriptionsResult = await query(`
      SELECT
        CONCAT('REC-RI-', LPAD(r.id::text, 5, '0'))        AS numero_recu,
        r.frais_date_paiement                               AS date_paiement,
        COALESCE(ue.prenom || ' ' || ue.nom, r.enfant_prenom || ' ' || r.enfant_nom) AS enfant,
        r.montant_total                                     AS montant,
        COALESCE(r.frais_mode_paiement, 'especes')          AS mode_paiement,
        'Frais de réinscription'                            AS type_frais,
        COALESCE(r.frais_reference, CONCAT('REIN-', r.id)) AS reference,
        COALESCE(c.nom, r.classe_nom)                       AS classe,
        'reinscription'                                     AS source,
        r.id                                                AS source_id
      FROM reinscriptions r
      LEFT JOIN eleves e ON r.eleve_id = e.id
      LEFT JOIN utilisateurs ue ON e.utilisateur_id = ue.id
      LEFT JOIN classes c ON r.classe_id = c.id
      WHERE r.parent_id = $1
        AND r.frais_statut = 'paye'
        AND r.frais_date_paiement IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM paiements pay
          WHERE pay.reinscription_id = r.id AND pay.statut = 'valide'
        )
      ORDER BY r.frais_date_paiement DESC
    `, [parentId]);

    // Fusionner toutes les sources et trier par date décroissante
    const allRecus = [
      ...paiPreinsResult.rows,
      ...paiReinsResult.rows,
      ...paiEleveResult.rows,
      ...preinscriptionsResult.rows,
      ...reinscriptionsResult.rows,
    ].sort((a, b) => {
      const dateA = new Date(a.date_paiement).getTime();
      const dateB = new Date(b.date_paiement).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(allRecus);
  } catch (error) {
    console.error("Erreur API /api/parent/recus:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
