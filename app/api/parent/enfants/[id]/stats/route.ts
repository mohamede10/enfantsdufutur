// app/api/parent/enfants/[id]/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const eleveId = parseInt(id);
    const userEmail = session.user?.email;

    // Vérifier que l'enfant appartient au parent
    const checkParent = await query(`
      SELECT 1 FROM lien_parent_eleve lpe
      JOIN parents p ON lpe.parent_id = p.id
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      WHERE lpe.eleve_id = $1 AND u.email = $2
    `, [eleveId, userEmail]);

    if (checkParent.rows.length === 0) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // 1. NOTES
    const notes = await query(`
      SELECT 
        m.nom as matiere,
        COALESCE(AVG(n.valeur), 0) as moyenne,
        m.coefficient
      FROM notes n
      JOIN enseignements e ON n.enseignement_id = e.id
      JOIN matieres m ON e.matiere_id = m.id
      WHERE n.eleve_id = $1
      GROUP BY m.id, m.nom, m.coefficient
    `, [eleveId]);

    // 2. PRÉSENCES
    const presences = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'present' THEN 1 ELSE 0 END) as presents,
        SUM(CASE WHEN statut = 'absent' THEN 1 ELSE 0 END) as absents,
        SUM(CASE WHEN statut = 'retard' THEN 1 ELSE 0 END) as retards
      FROM presences
      WHERE eleve_id = $1
    `, [eleveId]);

    // 3. FRAIS - Récupérer depuis la classe
    const classeInfo = await query(`
      SELECT 
        c.total_versement as frais_inscription,
        c.reinscription_total_versement as frais_reinscription,
        c.premier_versement,
        c.deuxieme_versement,
        c.troisieme_versement
      FROM eleves e
      JOIN classes c ON e.classe_id = c.id
      WHERE e.id = $1
    `, [eleveId]);

    const fraisInscription = Number(classeInfo.rows[0]?.frais_inscription) || 0;
    const fraisReinscription = Number(classeInfo.rows[0]?.frais_reinscription) || 0;
    const fraisBase = fraisReinscription > 0 ? fraisReinscription : fraisInscription;

    // 4. SERVICES OPTIONNELS
    let transportTotal = 0;
    const transportQuery = await query(`
      SELECT COALESCE(SUM(lt.prix_abonnement), 0) as total
      FROM inscriptions_transport it
      JOIN lignes_transport lt ON it.ligne_id = lt.id
      WHERE it.eleve_id = $1 AND it.est_actif = true
    `, [eleveId]);
    transportTotal = Number(transportQuery.rows[0]?.total) || 0;

    let cantineTotal = 0;
    const cantineQuery = await query(`
      SELECT COALESCE(SUM(cm.prix_annuel), 0) as total
      FROM inscriptions_cantine ic
      JOIN cantine_menus cm ON cm.id = (
        SELECT id FROM cantine_menus ORDER BY date DESC LIMIT 1
      )
      WHERE ic.eleve_id = $1 AND ic.est_actif = true
    `, [eleveId]);
    cantineTotal = Number(cantineQuery.rows[0]?.total) || 0;

    let fournituresTotal = 0;
    const fournituresQuery = await query(`
      SELECT COALESCE(SUM(cf.quantite * cf.prix_unitaire), 0) as total
      FROM commandes_fournitures cf
      JOIN preinscriptions p ON cf.preinscription_id = p.id
      JOIN inscriptions i ON i.preinscription_id = p.id
      WHERE i.eleve_id = $1
    `, [eleveId]);
    fournituresTotal = Number(fournituresQuery.rows[0]?.total) || 0;

    // 5. TOTAL DES FRAIS
    const totalFraisGeneral = fraisBase + transportTotal + cantineTotal + fournituresTotal;

    // ⭐⭐⭐ 6. PAIEMENTS EFFECTUÉS - CORRECTION MAJEURE ⭐⭐⭐
    // La requête doit récupérer tous les paiements liés à l'élève de manière plus large
    
    // 6a. Récupérer d'abord toutes les pré-inscriptions de l'élève (même via l'historique)
    const preinscriptionsEleve = await query(`
      SELECT DISTINCT p.id as preinscription_id
      FROM preinscriptions p
      WHERE p.parent_id IN (
        SELECT parent_id FROM lien_parent_eleve WHERE eleve_id = $1
      )
      AND p.enfant_nom = (SELECT u.nom FROM eleves e JOIN utilisateurs u ON e.utilisateur_id = u.id WHERE e.id = $1)
      AND p.enfant_prenom = (SELECT u.prenom FROM eleves e JOIN utilisateurs u ON e.utilisateur_id = u.id WHERE e.id = $1)
    `, [eleveId]);

    const preinscriptionIds = preinscriptionsEleve.rows.map(row => row.preinscription_id);

    // 6b. Récupérer toutes les réinscriptions de l'élève
    const reinscriptionsEleve = await query(`
      SELECT id as reinscription_id
      FROM reinscriptions
      WHERE eleve_id = $1
    `, [eleveId]);

    const reinscriptionIds = reinscriptionsEleve.rows.map(row => row.reinscription_id);

    // 6c. Calculer le total des paiements directs
    let totalPayeDirect = 0;

    // Paiements liés directement à l'élève
    const paiementsEleve = await query(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM paiements
      WHERE eleve_id = $1
      AND statut = 'valide'
    `, [eleveId]);
    totalPayeDirect += Number(paiementsEleve.rows[0]?.total) || 0;

    // Paiements liés aux pré-inscriptions de l'élève
    if (preinscriptionIds.length > 0) {
      const placeholders = preinscriptionIds.map((_, i) => `$${i + 2}`).join(', ');
      const paiementsPreinscription = await query(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM paiements
        WHERE preinscription_id IN (${placeholders})
        AND statut = 'valide'
      `, [eleveId, ...preinscriptionIds]);
      totalPayeDirect += Number(paiementsPreinscription.rows[0]?.total) || 0;
    }

    // Paiements liés aux réinscriptions de l'élève
    if (reinscriptionIds.length > 0) {
      const placeholders = reinscriptionIds.map((_, i) => `$${i + 2}`).join(', ');
      const paiementsReinscription = await query(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM paiements
        WHERE reinscription_id IN (${placeholders})
        AND statut = 'valide'
      `, [eleveId, ...reinscriptionIds]);
      totalPayeDirect += Number(paiementsReinscription.rows[0]?.total) || 0;
    }

    // 6d. Paiements via les échéances
    let totalPayeEcheances = 0;

    // Échéances liées aux pré-inscriptions de l'élève
    if (preinscriptionIds.length > 0) {
      const placeholders = preinscriptionIds.map((_, i) => `$${i + 2}`).join(', ');
      const echeancesPreinscription = await query(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM echeances_paiement
        WHERE preinscription_id IN (${placeholders})
        AND statut = 'paye'
      `, [eleveId, ...preinscriptionIds]);
      totalPayeEcheances += Number(echeancesPreinscription.rows[0]?.total) || 0;
    }

    // Échéances liées aux réinscriptions de l'élève
    if (reinscriptionIds.length > 0) {
      const placeholders = reinscriptionIds.map((_, i) => `$${i + 2}`).join(', ');
      const echeancesReinscription = await query(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM echeances_paiement
        WHERE reinscription_id IN (${placeholders})
        AND statut = 'paye'
      `, [eleveId, ...reinscriptionIds]);
      totalPayeEcheances += Number(echeancesReinscription.rows[0]?.total) || 0;
    }

    const totalPaye = totalPayeDirect + totalPayeEcheances;

    // 7. MONTANT À PAYER ET SOLDE
    const montantAPayer = Math.max(0, totalFraisGeneral - totalPaye);
    const soldeRestant = montantAPayer;

    console.log(`📊 Stats pour eleve_id ${eleveId}:`, {
      fraisBase,
      transportTotal,
      cantineTotal,
      fournituresTotal,
      totalFraisGeneral,
      preinscriptionIds,
      reinscriptionIds,
      totalPayeDirect,
      totalPayeEcheances,
      totalPaye,
      montantAPayer,
      soldeRestant
    });

    return NextResponse.json({
      notes: notes.rows || [],
      presences: presences.rows[0] || { total: 0, presents: 0, absents: 0, retards: 0 },
      paiements: {
        total_paye: totalPaye,
        total_paye_direct: totalPayeDirect,
        total_paye_echeances: totalPayeEcheances,
        nombre_paiements: 0,
        details: []
      },
      frais_inscription: fraisInscription,
      frais_reinscription: fraisReinscription,
      transport: transportTotal,
      cantine: cantineTotal,
      fournitures: fournituresTotal,
      scolarite: 0,
      total_frais_general: totalFraisGeneral,
      montant_a_payer: montantAPayer,
      solde_restant: soldeRestant,
      plan_paiement: classeInfo.rows[0] || null,
      pourcentage_paye: totalFraisGeneral > 0 ? Math.round((totalPaye / totalFraisGeneral) * 100) : 0
    });

  } catch (error) {
    console.error("Erreur stats:", error);
    return NextResponse.json({
      error: "Erreur serveur",
      notes: [],
      presences: { total: 0, presents: 0, absents: 0, retards: 0 },
      paiements: {
        total_paye: 0,
        total_paye_direct: 0,
        total_paye_echeances: 0,
        nombre_paiements: 0,
        details: []
      },
      frais_inscription: 0,
      frais_reinscription: 0,
      transport: 0,
      cantine: 0,
      fournitures: 0,
      scolarite: 0,
      total_frais_general: 0,
      montant_a_payer: 0,
      solde_restant: 0,
      plan_paiement: null,
      pourcentage_paye: 0
    }, { status: 500 });
  }
}