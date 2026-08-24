// app/api/parent/enfants/[eleveId]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyParentChildAccess } from "@/lib/parentChildAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eleveId: string }> }) {
  const { eleveId: eleveIdParam } = await params;
  const auth = await verifyParentChildAccess(eleveIdParam);
  if ("error" in auth) return auth.error;

  const { eleveId } = auth;

  try {
    // 1. NOTES avec moyennes par matière
    const notesRes = await query(
      `SELECT 
        m.nom AS matiere, m.coefficient,
        COALESCE(AVG(n.valeur), 0) AS moyenne,
        COUNT(n.id) AS nombre_notes
      FROM notes n
      JOIN enseignements en ON en.id = n.enseignement_id
      JOIN matieres m ON m.id = en.matiere_id
      WHERE n.eleve_id = $1
      GROUP BY m.id, m.nom, m.coefficient
      ORDER BY m.nom`,
      [eleveId]
    );

    // Calculer la moyenne générale
    let totalPondere = 0, totalCoeff = 0;
    const notesData = notesRes.rows.map((row: any) => {
      const moyenne = parseFloat(Number(row.moyenne).toFixed(2));
      const coeff = parseInt(row.coefficient) || 1;
      totalPondere += moyenne * coeff;
      totalCoeff += coeff;
      return { matiere: row.matiere, moyenne, coefficient: coeff, nombre_notes: parseInt(row.nombre_notes) };
    });
    const moyenneGenerale = totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : 0;

    // 2. PRÉSENCES
    const presencesRes = await query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN statut = 'present' THEN 1 ELSE 0 END) AS presents,
        SUM(CASE WHEN statut = 'absent' THEN 1 ELSE 0 END) AS absents,
        SUM(CASE WHEN statut = 'retard' THEN 1 ELSE 0 END) AS retards,
        SUM(CASE WHEN statut = 'justifie' THEN 1 ELSE 0 END) AS justifies
      FROM presences
      WHERE eleve_id = $1`,
      [eleveId]
    );
    const presences = presencesRes.rows[0] || { total: 0, presents: 0, absents: 0, retards: 0, justifies: 0 };

    // 3. FRAIS DE BASE
    const fraisRes = await query(
      `SELECT 
        COALESCE(c.frais_inscription, 0) AS frais_inscription,
        COALESCE(c.reinscription_total_versement, c.total_versement, 0) AS frais_reinscription
      FROM eleves e
      LEFT JOIN classes c ON e.classe_id = c.id
      WHERE e.id = $1`,
      [eleveId]
    );
    const fraisInscription = Number(fraisRes.rows[0]?.frais_inscription) || 0;
    const fraisReinscription = Number(fraisRes.rows[0]?.frais_reinscription) || 0;

    // Montant pré-inscription
    const preinscriptionRes = await query(
      `SELECT pre.montant_total_plan
       FROM inscriptions i
       LEFT JOIN preinscriptions pre ON i.preinscription_id = pre.id
       WHERE i.eleve_id = $1 AND i.statut = 'active'
       LIMIT 1`,
      [eleveId]
    );
    const montantPreinscription = Number(preinscriptionRes.rows[0]?.montant_total_plan) || 0;
    const fraisBase = montantPreinscription > 0 ? montantPreinscription :
                     (fraisReinscription > 0 ? fraisReinscription : fraisInscription);

    // 4. TRANSPORT
    let transport = 0;
    const transportRes = await query(
      `SELECT lt.prix_abonnement FROM inscriptions_transport it
       LEFT JOIN lignes_transport lt ON it.ligne_id = lt.id
       WHERE it.eleve_id = $1 AND it.est_actif = true LIMIT 1`,
      [eleveId]
    );
    if (transportRes.rows.length > 0 && transportRes.rows[0].prix_abonnement) {
      transport = Number(transportRes.rows[0].prix_abonnement);
    } else {
      const preTransportRes = await query(
        `SELECT pt.prix FROM preinscription_transport pt
         JOIN inscriptions i ON i.preinscription_id = pt.preinscription_id
         WHERE i.eleve_id = $1 LIMIT 1`,
        [eleveId]
      );
      if (preTransportRes.rows.length > 0) transport = Number(preTransportRes.rows[0].prix) || 0;
    }

    // 5. CANTINE
    let cantine = 0;
    const cantineRes = await query(
      `SELECT cm.prix_annuel FROM inscriptions_cantine ic
       LEFT JOIN cantine_menus cm ON cm.id = (SELECT id FROM cantine_menus ORDER BY date DESC LIMIT 1)
       WHERE ic.eleve_id = $1 AND ic.est_actif = true LIMIT 1`,
      [eleveId]
    );
    if (cantineRes.rows.length > 0 && cantineRes.rows[0].prix_annuel) {
      cantine = Number(cantineRes.rows[0].prix_annuel);
    } else {
      const preCantineRes = await query(
        `SELECT pc.prix FROM preinscription_cantine pc
         JOIN inscriptions i ON i.preinscription_id = pc.preinscription_id
         WHERE i.eleve_id = $1 LIMIT 1`,
        [eleveId]
      );
      if (preCantineRes.rows.length > 0) cantine = Number(preCantineRes.rows[0].prix) || 0;
    }

    // 6. FOURNITURES
    let fournitures = 0;
    const fournituresRes = await query(
      `SELECT COALESCE(SUM(cf.quantite * cf.prix_unitaire), 0) AS total
       FROM commandes_fournitures cf
       JOIN preinscriptions p ON cf.preinscription_id = p.id
       JOIN inscriptions i ON i.preinscription_id = p.id
       WHERE i.eleve_id = $1`,
      [eleveId]
    );
    fournitures = Number(fournituresRes.rows[0]?.total) || 0;

    const total_frais_general = fraisBase + transport + cantine + fournitures;

    // 7. PAIEMENTS
    const paiementsDirectRes = await query(
      `SELECT COALESCE(SUM(montant), 0) AS total_direct, COUNT(*) AS nombre_direct,
        COALESCE(json_agg(json_build_object(
          'montant', montant, 'type_frais', type_frais,
          'mode_paiement', mode_paiement, 'date_paiement', date_paiement,
          'reference_transaction', reference_transaction
        ) ORDER BY date_paiement DESC), '[]'::json) AS details
       FROM paiements WHERE eleve_id = $1 AND statut = 'valide'`,
      [eleveId]
    );
    const totalDirect = Number(paiementsDirectRes.rows[0]?.total_direct) || 0;
    const nombreDirect = Number(paiementsDirectRes.rows[0]?.nombre_direct) || 0;
    const detailsDirect = paiementsDirectRes.rows[0]?.details || [];

    // Echeances payées
    const preinscriptionIdRes = await query(
      `SELECT preinscription_id FROM inscriptions WHERE eleve_id = $1 AND statut = 'active' LIMIT 1`,
      [eleveId]
    );
    let totalEcheances = 0;
    let nombreEcheances = 0;
    if (preinscriptionIdRes.rows.length > 0 && preinscriptionIdRes.rows[0].preinscription_id) {
      const echeancesRes = await query(
        `SELECT COALESCE(SUM(montant), 0) AS total, COUNT(*) AS nombre
         FROM echeances_paiement WHERE preinscription_id = $1 AND statut = 'paye'`,
        [preinscriptionIdRes.rows[0].preinscription_id]
      );
      totalEcheances = Number(echeancesRes.rows[0]?.total) || 0;
      nombreEcheances = Number(echeancesRes.rows[0]?.nombre) || 0;
    }

    const total_paye = totalDirect + totalEcheances;
    const nombre_paiements = nombreDirect + nombreEcheances;
    const solde_restant = Math.max(0, total_frais_general - total_paye);
    const montant_a_payer = total_frais_general;

    return NextResponse.json({
      notes: notesData,
      moyenneGenerale,
      presences,
      paiements: {
        total_paye,
        nombre_paiements,
        details: detailsDirect
      },
      frais_inscription: fraisInscription,
      transport,
      cantine,
      fournitures,
      scolarite: 0,
      total_frais_general,
      montant_a_payer,
      solde_restant
    });
  } catch (error) {
    console.error("Erreur stats enfant:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
