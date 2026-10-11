// app/api/parent/cantine/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifierParentEnfant, getEnfantsAutorises } from "@/lib/auth-helpers";

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
    let enfantsQuery = `
      SELECT 
        e.id,
        e.matricule,
        u.nom,
        u.prenom,
        c.nom as classe_nom,
        ic.id as inscription_cantine_id,
        ic.est_actif as cantine_actif,
        ic.solde,
        ic.preferences_alimentaires,
        ic.allergies,
        ic.mois_total,
        ic.mois_restants,
        ic.montant_mensuel,
        ic.montant_total,
        ic.date_inscription,
        'eleve' as source
      FROM eleves e
      JOIN utilisateurs u ON e.utilisateur_id = u.id
      LEFT JOIN classes c ON e.classe_id = c.id
      LEFT JOIN inscriptions_cantine ic ON e.id = ic.eleve_id AND ic.est_actif = true
      JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
      JOIN parents p ON lpe.parent_id = p.id
      JOIN utilisateurs pu ON p.utilisateur_id = pu.id
      WHERE pu.email = $1 AND e.deleted_at IS NULL
    `;
    const enfantsParams: any[] = [userEmail];

    if (enfantId) {
      enfantsQuery += ` AND e.id = $2`;
      enfantsParams.push(enfantId);
    }

    enfantsQuery += ` ORDER BY e.id`;

    const enfantsResult = await query(enfantsQuery, enfantsParams);

    // ⭐ Récupérer les pré-inscriptions avec infos cantine complètes
    // ⭐⭐ EXCLURE celles déjà converties en élève (via inscriptions.preinscription_id)
    let preinscriptionsQuery = `
      SELECT 
        p.id,
        p.numero_dossier as matricule,
        p.enfant_nom as nom,
        p.enfant_prenom as prenom,
        p.classe as classe_nom,
        pc.id as inscription_cantine_id,
        (pc.id IS NOT NULL) as cantine_actif,
        COALESCE(pc.prix, 0) as montant_total,
        COALESCE(pc.prix, 0) as montant_paye,
        0 as solde,
        NULL as preferences_alimentaires,
        NULL as allergies,
        CASE WHEN pc.id IS NOT NULL THEN 9 ELSE 0 END as mois_total,
        CASE WHEN pc.id IS NOT NULL THEN 9 ELSE 0 END as mois_restants,
        CASE WHEN pc.id IS NOT NULL THEN 400000 ELSE 0 END as montant_mensuel,
        p.date_preinscription as date_inscription,
        cm.plat as menu_nom,
        p.statut as preinscription_statut,
        p.frais_statut as paiement_statut,
        'preinscription' as source
      FROM preinscriptions p
      JOIN parents par ON p.parent_id = par.id
      JOIN utilisateurs pu ON par.utilisateur_id = pu.id
      LEFT JOIN preinscription_cantine pc ON pc.preinscription_id = p.id
      LEFT JOIN cantine_menus cm ON cm.id = pc.menu_id
      WHERE pu.email = $1 
        AND p.statut IN ('en_attente', 'valide', 'partiel')
        AND NOT EXISTS (
          SELECT 1 FROM inscriptions i
          WHERE i.preinscription_id = p.id
        )
    `;
    const preinscParams: any[] = [userEmail];

    if (enfantId) {
      preinscriptionsQuery += ` AND p.id = $2`;
      preinscParams.push(enfantId);
    }

    preinscriptionsQuery += ` ORDER BY p.id`;

    const preinscriptionsResult = await query(preinscriptionsQuery, preinscParams);

    const tousEnfants = [...enfantsResult.rows, ...preinscriptionsResult.rows];

    if (tousEnfants.length === 0) {
      return NextResponse.json({
        enfants: [],
        reservations: []
      });
    }

    // Récupérer les réservations (uniquement pour les élèves inscrits)
    const enfantIds = enfantsResult.rows.map((e: any) => e.id).filter(Boolean);
    let reservationsResult = { rows: [] as any[] };

    if (enfantIds.length > 0) {
      reservationsResult = await query(`
        SELECT 
          rc.id,
          rc.eleve_id as enfant_id,
          rc.menu_id as menu_id,
          rc.date,
          rc.statut,
          rc.paye
        FROM reservations_cantine rc
        WHERE rc.eleve_id = ANY($1::int[])
          AND rc.date >= CURRENT_DATE
          AND rc.statut = 'confirmee'
      `, [enfantIds]);
    }

    // ⭐ Formater les données pour le frontend
    const enfantsData = tousEnfants.map((e: any) => ({
      id: e.id,
      matricule: e.matricule,
      nom: e.nom,
      prenom: e.prenom,
      classe: e.classe_nom,
      inscritCantine: e.cantine_actif === true,
      solde: parseFloat(e.solde) || 0,
      preferences: e.preferences_alimentaires
        ? (typeof e.preferences_alimentaires === 'string'
            ? JSON.parse(e.preferences_alimentaires)
            : e.preferences_alimentaires)
        : [],
      allergies: e.allergies
        ? (typeof e.allergies === 'string'
            ? JSON.parse(e.allergies)
            : e.allergies)
        : [],
      menusReserves: reservationsResult.rows.filter((r: any) => r.enfant_id === e.id).length,
      source: e.source || 'eleve',
      statut: e.source === 'preinscription' ? 'en_attente' : 'inscrit',
      moisTotal: Number(e.mois_total) || 0,
      moisRestants: Number(e.mois_restants) || 0,
      montantMensuel: Number(e.montant_mensuel) || 0,
      montantTotal: Number(e.montant_total) || 0,
      // ⭐ NOUVEAU : Montant payé et restant
      montantPaye: Number(e.montant_paye) || 0,
      montantRestant: Math.max(0, (Number(e.montant_total) || 0) - (Number(e.montant_paye) || 0)),
      // ⭐ NOUVEAU : Nom du menu
      menuNom: e.menu_nom || null,
      // ⭐ NOUVEAU : Statut de paiement (partiel, non_paye, paye)
      paiementStatut: e.paiement_statut || null,
      dateInscription: e.date_inscription
        ? (e.date_inscription instanceof Date
            ? e.date_inscription.toISOString().split('T')[0]
            : e.date_inscription)
        : null
    }));

    const reservationsData = reservationsResult.rows.map((r: any) => ({
      id: r.id,
      enfantId: r.enfant_id,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
      menuId: r.menu_id,
      statut: r.statut,
      paye: r.paye
    }));

    return NextResponse.json({
      enfants: enfantsData,
      reservations: reservationsData
    });

  } catch (error) {
    console.error("Erreur GET cantine:", error);
    return NextResponse.json({
      error: "Erreur serveur: " + (error instanceof Error ? error.message : "Erreur inconnue")
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Email utilisateur non trouvé" }, { status: 400 });
    }

    const body = await request.json();
    const { enfantId, menuIds, quantities, total, type } = body;

    if (!enfantId || !menuIds || !quantities || !total) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const { autorise, erreur } = await verifierParentEnfant(userEmail, enfantId, 'eleves');
    if (!autorise) {
      console.error(`⚠️ Tentative d'inscription cantine non autorisée: parent=${userEmail}, enfant=${enfantId}`);
      return NextResponse.json(
        { error: "Accès refusé : cet enfant ne vous appartient pas" },
        { status: 403 }
      );
    }

    const soldeResult = await query(`
      SELECT solde FROM inscriptions_cantine
      WHERE eleve_id = $1 AND est_actif = true
    `, [enfantId]);

    const soldeActuel = soldeResult.rows.length > 0
      ? parseFloat(soldeResult.rows[0].solde) || 0
      : 0;

    if (soldeActuel < total) {
      return NextResponse.json({
        error: `Solde insuffisant. Solde actuel: ${soldeActuel.toLocaleString()} GNF. Montant requis: ${total.toLocaleString()} GNF`
      }, { status: 400 });
    }

    const reservations = [];
    for (const menuId of menuIds) {
      const qty = quantities[menuId];
      if (!qty) continue;

      const menuDate = body.date || new Date().toISOString().split('T')[0];

      for (let i = 0; i < qty; i++) {
        const result = await query(`
          INSERT INTO reservations_cantine (eleve_id, menu_id, date, statut, paye)
          VALUES ($1, $2, $3, 'confirmee', false)
          RETURNING id, eleve_id as enfant_id, menu_id as menu_id, date, statut, paye
        `, [enfantId, parseInt(menuId), menuDate]);

        reservations.push({
          id: result.rows[0].id,
          enfantId: result.rows[0].enfant_id,
          menuId: result.rows[0].menu_id,
          date: result.rows[0].date instanceof Date
            ? result.rows[0].date.toISOString().split('T')[0]
            : result.rows[0].date,
          statut: result.rows[0].statut,
          paye: result.rows[0].paye
        });
      }
    }

    await query(`
      UPDATE inscriptions_cantine
      SET solde = solde - $1
      WHERE eleve_id = $2 AND est_actif = true
    `, [total, enfantId]);

    await query(`
      INSERT INTO transactions_cantine (eleve_id, montant, type, description, date)
      VALUES ($1, $2, 'debit', 'Réservation repas', NOW())
    `, [enfantId, total]);

    const nouveauSolde = soldeActuel - total;

    return NextResponse.json({
      success: true,
      reservations,
      nouveauSolde
    });

  } catch (error) {
    console.error("Erreur POST cantine:", error);
    return NextResponse.json({
      error: "Erreur serveur: " + (error instanceof Error ? error.message : "Erreur inconnue")
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Email utilisateur non trouvé" }, { status: 400 });
    }

    const body = await request.json();
    const { reservationId, enfantId, menuId } = body;

    if (!reservationId || !enfantId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const { autorise } = await verifierParentEnfant(userEmail, enfantId, 'eleves');
    if (!autorise) {
      console.error(`⚠️ Tentative d'annulation non autorisée: parent=${userEmail}, enfant=${enfantId}`);
      return NextResponse.json(
        { error: "Accès refusé : cet enfant ne vous appartient pas" },
        { status: 403 }
      );
    }

    const reservationResult = await query(`
      SELECT date FROM reservations_cantine
      WHERE id = $1 AND eleve_id = $2
    `, [reservationId, enfantId]);

    if (reservationResult.rows.length === 0) {
      return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    }

    const prix = body.montant || 0;

    await query(`
      DELETE FROM reservations_cantine
      WHERE id = $1 AND eleve_id = $2
    `, [reservationId, enfantId]);

    if (prix > 0) {
      await query(`
        UPDATE inscriptions_cantine
        SET solde = solde + $1
        WHERE eleve_id = $2 AND est_actif = true
      `, [prix, enfantId]);

      await query(`
        INSERT INTO transactions_cantine (eleve_id, montant, type, description, date)
        VALUES ($1, $2, 'credit', 'Annulation réservation', NOW())
      `, [enfantId, prix]);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Erreur DELETE cantine:", error);
    return NextResponse.json({
      error: "Erreur serveur: " + (error instanceof Error ? error.message : "Erreur inconnue")
    }, { status: 500 });
  }
}