// app/api/parent/transport/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifierParentEnfant } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Email utilisateur non trouvé" }, { status: 400 });
    }

    // ⭐ Récupérer l'enfantId depuis l'URL si fourni
    const url = new URL(request.url);
    const enfantIdParam = url.searchParams.get("enfantId");
    const enfantId = enfantIdParam ? parseInt(enfantIdParam) : null;

    // ⭐⭐⭐ SÉCURITÉ : Si enfantId fourni, vérifier qu'il appartient au parent ⭐⭐⭐
    if (enfantId) {
      const { autorise } = await verifierParentEnfant(userEmail, enfantId, 'eleves');
      if (!autorise) {
        return NextResponse.json(
          { error: "Accès refusé : cet enfant ne vous appartient pas" },
          { status: 403 }
        );
      }
    }

    // ⭐ Récupérer les enfants inscrits du parent connecté
    let elevesQuery = `
      SELECT 
        e.id,
        e.matricule,
        u.nom,
        u.prenom,
        c.nom as classe_nom,
        it.id as inscription_transport_id,
        it.est_actif as transport_actif,
        it.montant_mensuel,
        it.montant_total,
        it.mois_total,
        it.mois_restants,
        it.solde,
        it.date_debut,
        lt.id as ligne_id,
        lt.nom as ligne_nom,
        lt.horaire_matin,
        lt.horaire_soir,
        lt.prix_abonnement,
        b.immatriculation,
        b.chauffeur_nom,
        b.chauffeur_tel,
        b.capacite,
        'eleve' as source
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN inscriptions_transport it ON e.id = it.eleve_id AND it.est_actif = true
      LEFT JOIN lignes_transport lt ON it.ligne_id = lt.id
      LEFT JOIN bus b ON lt.bus_id = b.id
      JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      JOIN parents p ON lpe.parent_id = p.id
      JOIN utilisateurs pu ON p.utilisateur_id = pu.id
      WHERE pu.email = $1 AND e.deleted_at IS NULL
    `;
    const elevesParams: any[] = [userEmail];

    if (enfantId) {
      elevesQuery += ` AND e.id = $2`;
      elevesParams.push(enfantId);
    }

    elevesQuery += ` ORDER BY e.id`;

    const elevesResult = await query(elevesQuery, elevesParams);

    // ⭐ Récupérer les pré-inscriptions du parent
    let preinscriptionsQuery = `
      SELECT 
        pr.id,
        pr.numero_dossier as matricule,
        pr.enfant_nom as nom,
        pr.enfant_prenom as prenom,
        pr.classe as classe_nom,
        pt.id as inscription_transport_id,
        (pt.id IS NOT NULL) as transport_actif,
        pt.prix as montant_total,
        pt.ligne_id,
        lt.nom as ligne_nom,
        lt.horaire_matin,
        lt.horaire_soir,
        lt.prix_abonnement,
        b.immatriculation,
        b.chauffeur_nom,
        b.chauffeur_tel,
        b.capacite,
        'preinscription' as source
      FROM preinscriptions pr
      JOIN parents par ON pr.parent_id = par.id
      JOIN utilisateurs pu ON par.utilisateur_id = pu.id
      LEFT JOIN preinscription_transport pt ON pt.preinscription_id = pr.id
      LEFT JOIN lignes_transport lt ON pt.ligne_id = lt.id
      LEFT JOIN bus b ON lt.bus_id = b.id
      WHERE pu.email = $1 
        AND pr.statut IN ('en_attente', 'valide', 'partiel')
    `;
    const preinscParams: any[] = [userEmail];

    if (enfantId) {
      preinscriptionsQuery += ` AND pr.id = $2`;
      preinscParams.push(enfantId);
    }

    preinscriptionsQuery += ` ORDER BY pr.id`;

    const preinscriptionsResult = await query(preinscriptionsQuery, preinscParams);

    const tousEnfants = [...elevesResult.rows, ...preinscriptionsResult.rows];

    // Formater les données
    const enfantsData = tousEnfants.map((e: any) => ({
      id: e.id,
      matricule: e.matricule,
      nom: e.nom,
      prenom: e.prenom,
      classe: e.classe_nom,
      inscritTransport: e.transport_actif === true,
      ligne: e.ligne_nom,
      ligneId: e.ligne_id,
      arret: "Arrêt principal",
      heureMatin: e.horaire_matin ? String(e.horaire_matin).substring(0, 5) : null,
      heureSoir: e.horaire_soir ? String(e.horaire_soir).substring(0, 5) : null,
      chauffeur: e.chauffeur_nom,
      chauffeurTel: e.chauffeur_tel,
      immatriculation: e.immatriculation,
      capacite: e.capacite,
      prixAbonnement: parseFloat(e.prix_abonnement) || 0,
      montantTotal: parseFloat(e.montant_total) || 0,
      solde: parseFloat(e.solde) || 0,
      moisTotal: e.mois_total,
      moisRestants: e.mois_restants,
      source: e.source || 'eleve',
      statut: e.source === 'preinscription' ? 'en_attente' : 'inscrit'
    }));

    // ⭐ Récupérer les lignes de transport disponibles (pour abonnement)
    const lignesResult = await query(`
      SELECT 
        lt.id,
        lt.nom,
        lt.horaire_matin,
        lt.horaire_soir,
        lt.prix_abonnement,
        b.immatriculation,
        b.chauffeur_nom,
        b.chauffeur_tel,
        b.capacite
      FROM lignes_transport lt
      LEFT JOIN bus b ON lt.bus_id = b.id
      ORDER BY lt.nom
    `);

    const lignesData = lignesResult.rows.map((l: any) => ({
      id: l.id,
      nom: l.nom,
      horaireMatin: l.horaire_matin ? String(l.horaire_matin).substring(0, 5) : null,
      horaireSoir: l.horaire_soir ? String(l.horaire_soir).substring(0, 5) : null,
      prixAbonnement: parseFloat(l.prix_abonnement) || 0,
      immatriculation: l.immatriculation,
      chauffeur: l.chauffeur_nom,
      chauffeurTel: l.chauffeur_tel,
      capacite: l.capacite
    }));

    // ⭐ Position du bus (simulée pour le moment)
    const busPosition = {
      latitude: 9.5092,
      longitude: -13.7122,
      vitesse: 35,
      derniereMiseAJour: new Date().toISOString(),
      retard: 0
    };

    return NextResponse.json({
      enfants: enfantsData,
      lignes: lignesData,
      busPosition
    });

  } catch (error) {
    console.error("Erreur GET transport:", error);
    return NextResponse.json({
      error: "Erreur serveur: " + (error instanceof Error ? error.message : "Erreur inconnue")
    }, { status: 500 });
  }
}