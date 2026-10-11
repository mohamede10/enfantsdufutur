// app/api/admin/finances/remises/route.ts
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

    const role = (session.user as any).role;
    if (role !== "SUPER_ADMIN" && role !== "COMPTABLE" && role !== "DIRECTEUR_GENERAL") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const url = new URL(request.url);
    const minEnfantsParam = url.searchParams.get("minEnfants");
    const minEnfants = minEnfantsParam ? parseInt(minEnfantsParam) : 2;

    // S'assurer que la table remises_familles existe
    await query(`
      CREATE TABLE IF NOT EXISTS remises_familles (
        id SERIAL PRIMARY KEY,
        parent_id INT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        montant NUMERIC(12, 2) NOT NULL,
        motif TEXT,
        saisie_par INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ⭐ CORRECTION : Comptage propre des enfants sans doublons (UNION + DISTINCT)
    const parentsResult = await query(`
      WITH enfants_uniques AS (
        -- Enfants inscrits
        SELECT DISTINCT lpe.parent_id, lpe.eleve_id::text AS enfant_key
        FROM lien_parent_eleve lpe
        JOIN eleves e ON e.id = lpe.eleve_id
        WHERE e.deleted_at IS NULL

        UNION

        -- Enfants en préinscription
        SELECT DISTINCT p.parent_id, ('pre_' || p.id)::text AS enfant_key
        FROM preinscriptions p
        WHERE p.statut != 'rejete'

        UNION

        -- Enfants en réinscription
        SELECT DISTINCT r.parent_id, ('re_' || r.id)::text AS enfant_key
        FROM reinscriptions r
        WHERE r.statut != 'rejete'
      ),
      compte_enfants AS (
        SELECT parent_id, COUNT(*) AS nb_enfants
        FROM enfants_uniques
        GROUP BY parent_id
      )
      SELECT 
        p.id as parent_id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        COALESCE(ce.nb_enfants, 0) as nb_enfants,
        COALESCE((SELECT SUM(montant) FROM remises_familles WHERE parent_id = p.id), 0) as total_remises
      FROM parents p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      LEFT JOIN compte_enfants ce ON ce.parent_id = p.id
      WHERE COALESCE(ce.nb_enfants, 0) >= $1
      ORDER BY nb_enfants DESC, u.nom ASC
    `, [minEnfants]);

    const parentsComplets: any[] = [];

    for (const parent of parentsResult.rows) {
      const parentId = parent.parent_id;

      // ⭐ CORRECTION : Frais bruts lus depuis echeances_paiement (préinscriptions + réinscriptions)
      // 1) Échéances liées aux préinscriptions
      const fraisPreinsRes = await query(`
        SELECT COALESCE(SUM(ep.montant), 0) as total
        FROM echeances_paiement ep
        WHERE ep.preinscription_id IN (
          SELECT id FROM preinscriptions WHERE parent_id = $1
        )
        AND ep.type IN ('inscription', 'scolarite', 'reinscription')
      `, [parentId]);
      const scolaritePreins = Number(fraisPreinsRes.rows[0]?.total) || 0;

      // 2) Échéances liées aux réinscriptions
      const fraisReinsRes = await query(`
        SELECT COALESCE(SUM(ep.montant), 0) as total
        FROM echeances_paiement ep
        WHERE ep.reinscription_id IN (
          SELECT id FROM reinscriptions WHERE parent_id = $1
        )
        AND ep.type IN ('inscription', 'scolarite', 'reinscription')
      `, [parentId]);
      const scolariteReins = Number(fraisReinsRes.rows[0]?.total) || 0;

      // 3) Fallback : si aucune échéance, utiliser les montants stockés dans les tables
      let scolariteFallback = 0;
      if (scolaritePreins === 0) {
        const fallbackPreins = await query(`
          SELECT COALESCE(SUM(COALESCE(montant_total_plan, frais_montant, 0)), 0) as total
          FROM preinscriptions
          WHERE parent_id = $1 AND statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);
        scolariteFallback += Number(fallbackPreins.rows[0]?.total) || 0;
      }
      if (scolariteReins === 0) {
        const fallbackReins = await query(`
          SELECT COALESCE(SUM(COALESCE(montant_total_plan, montant_frais, 0)), 0) as total
          FROM reinscriptions
          WHERE parent_id = $1 AND statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);
        scolariteFallback += Number(fallbackReins.rows[0]?.total) || 0;
      }

      const scolariteBrut = scolaritePreins + scolariteReins + scolariteFallback;

      // ⭐ CORRECTION : Services annexes lus depuis les bonnes tables
      // Cantine via preinscription_cantine (source principale)
      const cantineRes = await query(`
        SELECT COALESCE(SUM(pc.prix), 0) as total
        FROM preinscription_cantine pc
        JOIN preinscriptions p ON pc.preinscription_id = p.id
        WHERE p.parent_id = $1
          AND p.statut IN ('valide', 'en_attente', 'partiel')
      `, [parentId]);
      const cantineBrut = Number(cantineRes.rows[0]?.total) || 0;

      // Transport via preinscription_transport
      const transportRes = await query(`
        SELECT COALESCE(SUM(pt.prix), 0) as total
        FROM preinscription_transport pt
        JOIN preinscriptions p ON pt.preinscription_id = p.id
        WHERE p.parent_id = $1
          AND p.statut IN ('valide', 'en_attente', 'partiel')
      `, [parentId]);
      const transportBrut = Number(transportRes.rows[0]?.total) || 0;

      // Fournitures : commandes_fournitures + commandes_librairie
      const fournituresRes = await query(`
        SELECT 
          COALESCE((
            SELECT SUM(cf.quantite * cf.prix_unitaire) 
            FROM commandes_fournitures cf
            JOIN preinscriptions p ON cf.preinscription_id = p.id
            WHERE p.parent_id = $1
          ), 0) +
          COALESCE((
            SELECT SUM(cl.total) 
            FROM commandes_librairie cl
            WHERE cl.parent_id = $1 AND cl.statut = 'valide'
          ), 0) as total
      `, [parentId]);
      const fournituresBrut = Number(fournituresRes.rows[0]?.total) || 0;

      const totalServices = cantineBrut + transportBrut + fournituresBrut;

      // ⭐ CORRECTION : Total payé unifié
      const paiementsRes = await query(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM (
          SELECT id, montant FROM paiements
          WHERE statut IN ('valide', 'paye')
            AND eleve_id IN (SELECT eleve_id FROM lien_parent_eleve WHERE parent_id = $1)
          UNION ALL
          SELECT id, montant FROM paiements
          WHERE statut IN ('valide', 'paye')
            AND preinscription_id IN (SELECT id FROM preinscriptions WHERE parent_id = $1)
          UNION ALL
          SELECT id, montant FROM paiements
          WHERE statut IN ('valide', 'paye')
            AND reinscription_id IN (SELECT id FROM reinscriptions WHERE parent_id = $1)
        ) paiements_uniques
      `, [parentId]);
      const totalPaye = Number(paiementsRes.rows[0]?.total) || 0;

      // ⭐ Calcul final
      const totalAPayer = scolariteBrut + totalServices;
      const totalRemises = Number(parent.total_remises) || 0;
      const soldeRestant = Math.max(0, totalAPayer - totalPaye - totalRemises);

      // ⭐ IMPORTANT : Sécuriser tous les champs numériques avec Number() || 0
      parentsComplets.push({
        id: Number(parent.parent_id) || 0,
        nom: parent.nom || "",
        prenom: parent.prenom || "",
        email: parent.email || "",
        telephone: parent.telephone || "",
        nb_enfants: Number(parent.nb_enfants) || 0,
        total_a_payer: Number(totalAPayer) || 0,
        total_paye: Number(totalPaye) || 0,
        total_remises: Number(totalRemises) || 0,
        solde_restant: Number(soldeRestant) || 0
      });
    }

    return NextResponse.json(parentsComplets);
  } catch (error: any) {
    console.error("Erreur GET remises:", error);
    return NextResponse.json({ error: "Erreur serveur: " + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "SUPER_ADMIN" && role !== "COMPTABLE" && role !== "DIRECTEUR_GENERAL") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
    }

    const body = await request.json();
    const { parentId, montant, motif } = body;

    if (!parentId || !montant || montant <= 0) {
      return NextResponse.json({ error: "Parent ID et montant valide requis" }, { status: 400 });
    }

    // S'assurer que la table existe
    await query(`
      CREATE TABLE IF NOT EXISTS remises_familles (
        id SERIAL PRIMARY KEY,
        parent_id INT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        montant NUMERIC(12, 2) NOT NULL,
        motif TEXT,
        saisie_par INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ⭐ CORRECTION MAJEURE : Calculer le solde restant RÉEL du parent avant d'appliquer la remise
    const soldeInfoRes = await query(`
      SELECT 
        -- Scolarité brute (échéances préinscriptions + réinscriptions)
        COALESCE((
          SELECT SUM(ep.montant)
          FROM echeances_paiement ep
          WHERE ep.preinscription_id IN (SELECT id FROM preinscriptions WHERE parent_id = $1)
            AND ep.type IN ('inscription', 'scolarite', 'reinscription')
        ), 0) +
        COALESCE((
          SELECT SUM(ep.montant)
          FROM echeances_paiement ep
          WHERE ep.reinscription_id IN (SELECT id FROM reinscriptions WHERE parent_id = $1)
            AND ep.type IN ('inscription', 'scolarite', 'reinscription')
        ), 0) AS scolarite_brut,

        -- Services bruts (cantine + transport + fournitures + librairie)
        COALESCE((
          SELECT SUM(pc.prix) FROM preinscription_cantine pc
          JOIN preinscriptions p ON pc.preinscription_id = p.id
          WHERE p.parent_id = $1 AND p.statut IN ('valide', 'en_attente', 'partiel')
        ), 0) +
        COALESCE((
          SELECT SUM(pt.prix) FROM preinscription_transport pt
          JOIN preinscriptions p ON pt.preinscription_id = p.id
          WHERE p.parent_id = $1 AND p.statut IN ('valide', 'en_attente', 'partiel')
        ), 0) +
        COALESCE((
          SELECT SUM(cf.quantite * cf.prix_unitaire) FROM commandes_fournitures cf
          JOIN preinscriptions p ON cf.preinscription_id = p.id
          WHERE p.parent_id = $1
        ), 0) +
        COALESCE((
          SELECT SUM(total) FROM commandes_librairie
          WHERE parent_id = $1 AND statut = 'valide'
        ), 0) AS services_brut,

        -- Total déjà payé
        COALESCE((
          SELECT SUM(montant) FROM (
            SELECT montant FROM paiements
            WHERE statut IN ('valide', 'paye')
              AND eleve_id IN (SELECT eleve_id FROM lien_parent_eleve WHERE parent_id = $1)
            UNION ALL
            SELECT montant FROM paiements
            WHERE statut IN ('valide', 'paye')
              AND preinscription_id IN (SELECT id FROM preinscriptions WHERE parent_id = $1)
            UNION ALL
            SELECT montant FROM paiements
            WHERE statut IN ('valide', 'paye')
              AND reinscription_id IN (SELECT id FROM reinscriptions WHERE parent_id = $1)
          ) p
        ), 0) AS total_paye,

        -- Remises déjà accordées
        COALESCE((
          SELECT SUM(montant) FROM remises_familles WHERE parent_id = $1
        ), 0) AS remises_existantes
    `, [parentId]);

    const info = soldeInfoRes.rows[0];
    const scolariteBrut = Number(info.scolarite_brut) || 0;
    const servicesBrut = Number(info.services_brut) || 0;
    const totalBrut = scolariteBrut + servicesBrut;
    const totalPaye = Number(info.total_paye) || 0;
    const remisesExistantes = Number(info.remises_existantes) || 0;

    const soldeRestantReel = Math.max(0, totalBrut - totalPaye - remisesExistantes);

    // ⭐ CORRECTION : Plafonner la remise au solde restant réel
    if (Number(montant) > soldeRestantReel) {
      return NextResponse.json({ 
        error: `La remise (${Number(montant).toLocaleString()} GNF) dépasse le solde restant réel (${soldeRestantReel.toLocaleString()} GNF).`,
        solde_restant_reel: soldeRestantReel
      }, { status: 400 });
    }

    // Insérer la remise
    const insertResult = await query(`
      INSERT INTO remises_familles (parent_id, montant, motif, saisie_par)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [parentId, montant, motif || "Remise Famille Nombreuse", (session.user as any).id || null]);

    // ⭐ CORRECTION MAJEURE : Répartir la remise PROPORTIONNELLEMENT sur les échéances
    // au lieu de la soustraire en masse à chaque préinscription/réinscription
    if (scolariteBrut > 0) {
      const montantRemiseApplique = Math.min(Number(montant), scolariteBrut);
      const facteurReduction = 1 - (montantRemiseApplique / scolariteBrut);

      // Mettre à jour chaque échéance de scolarité proportionnellement
      await query(`
        UPDATE echeances_paiement
        SET montant = GREATEST(0, ROUND(montant * $1::numeric, 2))
        WHERE (
          preinscription_id IN (SELECT id FROM preinscriptions WHERE parent_id = $2)
          OR reinscription_id IN (SELECT id FROM reinscriptions WHERE parent_id = $2)
        )
        AND type IN ('inscription', 'scolarite', 'reinscription')
      `, [facteurReduction, parentId]);
    }

    // ⭐ CORRECTION : Recalculer montant_restant_plan de manière cohérente
    await query(`
      UPDATE preinscriptions p
      SET montant_restant_plan = GREATEST(0, 
        COALESCE((
          SELECT SUM(ep.montant) 
          FROM echeances_paiement ep 
          WHERE ep.preinscription_id = p.id
            AND ep.type IN ('inscription', 'scolarite', 'reinscription')
        ), 0)
        - COALESCE((
          SELECT SUM(pay.montant) 
          FROM paiements pay 
          WHERE pay.preinscription_id = p.id AND pay.statut IN ('valide', 'paye')
        ), 0)
      )
      WHERE p.parent_id = $1
    `, [parentId]);

    await query(`
      UPDATE reinscriptions r
      SET montant_restant_plan = GREATEST(0, 
        COALESCE((
          SELECT SUM(ep.montant) 
          FROM echeances_paiement ep 
          WHERE ep.reinscription_id = r.id
            AND ep.type IN ('inscription', 'scolarite', 'reinscription')
        ), 0)
        - COALESCE((
          SELECT SUM(pay.montant) 
          FROM paiements pay 
          WHERE pay.reinscription_id = r.id AND pay.statut IN ('valide', 'paye')
        ), 0)
      )
      WHERE r.parent_id = $1
    `, [parentId]);

    return NextResponse.json({
      success: true,
      message: `Remise de ${Number(montant).toLocaleString()} GNF appliquée avec succès.`,
      remise: insertResult.rows[0],
      solde_restant_apres: Math.max(0, soldeRestantReel - Number(montant))
    });
  } catch (error: any) {
    console.error("Erreur POST remise:", error);
    return NextResponse.json({ error: "Erreur serveur: " + error.message }, { status: 500 });
  }
}