// app/api/admin/finances/parents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ⭐ Type pour les échéances avant répartition
interface EcheanceBrute {
  id: number;
  echeance: string;
  type: string;
  montant: number;
  montant_brut?: number;
  remise_appliquee?: number;
  statut: string;
  date_echeance: string | null;
  preinscription_id: number | null;
  reinscription_id: number | null;
  enfant_nom: string | null;
  source_type?: 'scolarite' | 'cantine' | 'transport' | 'fournitures';
}

// ⭐⭐⭐ FONCTION DE RÉPARTITION FIFO ⭐⭐⭐
function repartirPaiementsFIFO(
  totalPaye: number,
  echeances: EcheanceBrute[]
): Array<EcheanceBrute & {
  montant_paye: number;
  reste_a_payer: number;
  statut_calcule: 'paye' | 'partiel' | 'en_attente';
}> {
  const triees = [...echeances].sort((a, b) => {
    const da = a.date_echeance ? new Date(a.date_echeance).getTime() : Infinity;
    const db = b.date_echeance ? new Date(b.date_echeance).getTime() : Infinity;
    if (da !== db) return da - db;
    return a.id - b.id;
  });

  let reste = totalPaye;

  const resultat = triees.map((ech) => {
    const montant = Number(ech.montant) || 0;
    let montantPaye = 0;
    let statutCalcule: 'paye' | 'partiel' | 'en_attente' = 'en_attente';

    if (reste >= montant && montant > 0) {
      montantPaye = montant;
      statutCalcule = 'paye';
      reste -= montant;
    } else if (reste > 0 && montant > 0) {
      montantPaye = reste;
      statutCalcule = 'partiel';
      reste = 0;
    }

    return {
      ...ech,
      montant_paye: montantPaye,
      reste_a_payer: montant - montantPaye,
      statut_calcule: statutCalcule,
    };
  });

  return resultat.sort((a, b) => a.id - b.id);
}

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
    const search = url.searchParams.get("search") || "";

    let sql = `
      SELECT 
        p.id as parent_id,
        u.id as utilisateur_id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.adresse,
        u.photo_url,
        u.est_actif,
        p.profession,
        p.situation_matrimoniale
      FROM parents p
      JOIN utilisateurs u ON p.utilisateur_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search.trim()) {
      sql += ` AND (
        u.nom ILIKE $1 OR 
        u.prenom ILIKE $1 OR 
        u.email ILIKE $1 OR 
        u.telephone ILIKE $1 OR 
        EXISTS (
          SELECT 1 
          FROM lien_parent_eleve lpe 
          JOIN eleves e ON lpe.eleve_id = e.id 
          JOIN utilisateurs ue ON e.utilisateur_id = ue.id 
          WHERE lpe.parent_id = p.id AND (ue.nom ILIKE $1 OR ue.prenom ILIKE $1)
        )
      )`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY u.nom ASC, u.prenom ASC`;

    const parentsResult = await query(sql, params);

    if (parentsResult.rows.length === 0) {
      return NextResponse.json([]);
    }

    const parentsList = parentsResult.rows;

    const parentsFinances = await Promise.all(
      parentsList.map(async (parent) => {
        const parentId = parent.parent_id;

        // ========== 1. ENFANTS INSCRITS ==========
        const elevesResult = await query(`
          SELECT 
            e.id as eleve_id,
            e.matricule,
            u.nom,
            u.prenom,
            c.nom as classe_nom,
            c.niveau,
            c.id as classe_id,
            e.date_naissance,
            e.sexe
          FROM eleves e
          JOIN utilisateurs u ON e.utilisateur_id = u.id
          LEFT JOIN classes c ON e.classe_id = c.id
          JOIN lien_parent_eleve lpe ON e.id = lpe.eleve_id
          WHERE lpe.parent_id = $1 AND e.est_inscrit = true AND e.deleted_at IS NULL
        `, [parentId]);

        // ========== 2. PRÉ-INSCRIPTIONS VALIDÉES ==========
        // ⭐ CORRECTION : prendre aussi les 'valide' et 'partiel', pas seulement 'en_attente'
        const preinsResult = await query(`
          SELECT 
            p.id as preinscription_id,
            p.numero_dossier,
            p.enfant_nom as nom,
            p.enfant_prenom as prenom,
            p.classe as classe_nom,
            p.niveau,
            p.statut,
            p.date_naissance,
            p.montant_total_plan
          FROM preinscriptions p
          WHERE p.parent_id = $1 
            AND p.statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);

        // ========== 3. REMISES ACCORDÉES ==========
        let remiseAccordee = 0;
        try {
          const remiseResult = await query(`
            SELECT COALESCE(SUM(montant), 0) as total_remise
            FROM remises_familles
            WHERE parent_id = $1
          `, [parentId]);
          remiseAccordee = Number(remiseResult.rows[0]?.total_remise) || 0;
        } catch (err) {
          console.warn("⚠️ Table remises_familles non trouvée, remise = 0");
        }

        // ========== 4. SCOLARITÉ BRUTE ==========
        // ⭐ CORRECTION : Utiliser les pré-inscriptions VALIDÉES (pas les élèves inscrits)
        // car les élèves inscrits ont le même montant → risque de doublon
        let scolariteBrut = 0;

        // 4a. Pré-inscriptions validées (exclure les fournitures qui sont dans echeances)
        for (const pre of preinsResult.rows) {
          const planRes = await query(`
            SELECT COALESCE(SUM(ep.montant), 0) as total_scolarite
            FROM echeances_paiement ep
            WHERE ep.preinscription_id = $1
              AND ep.type IN ('inscription', 'scolarite', 'reinscription')
          `, [pre.preinscription_id]);
          
          const totalScolarite = Number(planRes.rows[0]?.total_scolarite) || 0;
          
          if (totalScolarite > 0) {
            scolariteBrut += totalScolarite;
          } else {
            // Fallback : utiliser montant_total_plan si aucune échéance
            scolariteBrut += Number(pre.montant_total_plan) || 0;
          }
        }

        // 4b. Réinscriptions en attente
        const reinscriptionsPendingRes = await query(`
          SELECT r.id, r.montant_total_plan, r.montant_frais
          FROM reinscriptions r
          WHERE r.parent_id = $1 
            AND r.statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);
        for (const r of reinscriptionsPendingRes.rows) {
          scolariteBrut += Number(r.montant_total_plan) || Number(r.montant_frais) || 0;
        }

        // ========== 5. CANTINE BRUTE (CORRIGÉ) ==========
        // ⭐ CORRECTION : lire depuis preinscription_cantine (pas inscriptions_cantine)
        const cantineRes = await query(`
          SELECT COALESCE(SUM(pc.prix), 0) as total_cantine
          FROM preinscription_cantine pc
          JOIN preinscriptions p ON pc.preinscription_id = p.id
          WHERE p.parent_id = $1
            AND p.statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);
        const cantineBrut = Number(cantineRes.rows[0]?.total_cantine) || 0;

        // ========== 6. TRANSPORT BRUT (CORRIGÉ) ==========
        // ⭐ CORRECTION : lire depuis preinscription_transport (pas inscriptions_transport)
        const transportRes = await query(`
          SELECT COALESCE(SUM(pt.prix), 0) as total_transport
          FROM preinscription_transport pt
          JOIN preinscriptions p ON pt.preinscription_id = p.id
          WHERE p.parent_id = $1
            AND p.statut IN ('valide', 'en_attente', 'partiel')
        `, [parentId]);
        const transportBrut = Number(transportRes.rows[0]?.total_transport) || 0;

        // ========== 7. FOURNITURES BRUTES ==========
        const fournituresRes = await query(`
          SELECT 
            COALESCE(
              (SELECT SUM(cf.quantite * cf.prix_unitaire) 
               FROM commandes_fournitures cf
               JOIN preinscriptions p ON cf.preinscription_id = p.id
               WHERE p.parent_id = $1), 0
            ) +
            COALESCE(
              (SELECT SUM(cl.total) 
               FROM commandes_librairie cl
               WHERE cl.parent_id = $1 AND cl.statut = 'valide'), 0
            ) as total_fournitures
        `, [parentId]);
        const fournituresBrut = Number(fournituresRes.rows[0]?.total_fournitures) || 0;

        // ========== 8. TOTAL PAYÉ ==========
        const paiementsResult = await query(`
          SELECT COALESCE(SUM(montant), 0) as total_paye
          FROM (
            SELECT p.id, p.montant
            FROM paiements p
            WHERE p.statut IN ('valide', 'paye')
              AND p.eleve_id IN (
                SELECT eleve_id FROM lien_parent_eleve WHERE parent_id = $1
              )
            UNION ALL
            SELECT p.id, p.montant
            FROM paiements p
            WHERE p.statut IN ('valide', 'paye')
              AND p.preinscription_id IN (
                SELECT id FROM preinscriptions WHERE parent_id = $1
              )
            UNION ALL
            SELECT p.id, p.montant
            FROM paiements p
            WHERE p.statut IN ('valide', 'paye')
              AND p.reinscription_id IN (
                SELECT id FROM reinscriptions WHERE parent_id = $1
              )
          ) paiements_uniques
        `, [parentId]);

        const totalPaye = Number(paiementsResult.rows[0]?.total_paye) || 0;

        const depensesBrutes = scolariteBrut + cantineBrut + transportBrut + fournituresBrut;
        const totalNet = Math.max(0, depensesBrutes - remiseAccordee);
        const soldeRestant = Math.max(0, totalNet - totalPaye);

        // ========== 9. ÉCHÉANCES SCOLAIRITÉ ==========
        // ⭐ CORRECTION : exclure les fournitures (déjà comptées dans commandes_fournitures)
        const echeancesRes = await query(`
          SELECT 
            ep.id,
            ep.echeance,
            ep.type,
            ep.montant,
            ep.statut,
            ep.date_echeance,
            ep.preinscription_id,
            ep.reinscription_id,
            COALESCE(p.enfant_prenom || ' ' || p.enfant_nom, r.enfant_prenom || ' ' || r.enfant_nom) as enfant_nom
          FROM echeances_paiement ep
          LEFT JOIN preinscriptions p ON ep.preinscription_id = p.id
          LEFT JOIN reinscriptions r ON ep.reinscription_id = r.id
          WHERE ep.preinscription_id IN (
            SELECT id FROM preinscriptions WHERE parent_id = $1
          )
          OR ep.reinscription_id IN (
            SELECT id FROM reinscriptions WHERE parent_id = $1
          )
          ORDER BY ep.id ASC
        `, [parentId]);

        const echeancesScolarite: EcheanceBrute[] = echeancesRes.rows
          .filter((e: any) => e.type !== 'fournitures')  // ⭐ EXCLURE les fournitures
          .map((e: any) => ({
            id: e.id,
            echeance: e.echeance,
            type: e.type,
            montant: Number(e.montant) || 0,
            statut: e.statut,
            date_echeance: e.date_echeance,
            preinscription_id: e.preinscription_id,
            reinscription_id: e.reinscription_id,
            enfant_nom: e.enfant_nom,
            source_type: 'scolarite',
          }));

        // ========== 10. CANTINE ÉCHÉANCES (CORRIGÉ) ==========
        // ⭐ CORRECTION : lire depuis preinscription_cantine
        let echeancesCantine: EcheanceBrute[] = [];
        try {
          const cantineEchRes = await query(`
            SELECT 
              pc.id,
              pc.prix as montant,
              pc.created_at as date_creation,
              p.id as preinscription_id,
              p.enfant_prenom || ' ' || p.enfant_nom as enfant_nom
            FROM preinscription_cantine pc
            JOIN preinscriptions p ON pc.preinscription_id = p.id
            WHERE p.parent_id = $1
              AND p.statut IN ('valide', 'en_attente', 'partiel')
              AND pc.prix > 0
          `, [parentId]);

          echeancesCantine = cantineEchRes.rows.map((e: any) => ({
            id: -e.id,
            echeance: 'Frais de cantine',
            type: 'cantine',
            montant: Number(e.montant) || 0,
            statut: 'en_attente',
            date_echeance: e.date_creation,
            preinscription_id: e.preinscription_id,
            reinscription_id: null,
            enfant_nom: e.enfant_nom,
            source_type: 'cantine',
          }));
        } catch (err) {
          console.warn("⚠️ Erreur cantine:", err);
        }

        // ========== 11. TRANSPORT ÉCHÉANCES (CORRIGÉ) ==========
        // ⭐ CORRECTION : lire depuis preinscription_transport
        let echeancesTransport: EcheanceBrute[] = [];
        try {
          const transportEchRes = await query(`
            SELECT 
              pt.id,
              pt.prix as montant,
              pt.created_at as date_creation,
              p.id as preinscription_id,
              p.enfant_prenom || ' ' || p.enfant_nom as enfant_nom
            FROM preinscription_transport pt
            JOIN preinscriptions p ON pt.preinscription_id = p.id
            WHERE p.parent_id = $1
              AND p.statut IN ('valide', 'en_attente', 'partiel')
              AND pt.prix > 0
          `, [parentId]);

          echeancesTransport = transportEchRes.rows.map((e: any) => ({
            id: -100000 - e.id,
            echeance: 'Frais de transport',
            type: 'transport',
            montant: Number(e.montant) || 0,
            statut: 'en_attente',
            date_echeance: e.date_creation,
            preinscription_id: e.preinscription_id,
            reinscription_id: null,
            enfant_nom: e.enfant_nom,
            source_type: 'transport',
          }));
        } catch (err) {
          console.warn("⚠️ Erreur transport:", err);
        }

        // ========== 12. FOURNITURES ÉCHÉANCES ==========
        let echeancesFournitures: EcheanceBrute[] = [];
        try {
          const fournEchRes = await query(`
            SELECT 
              cf.id,
              (cf.quantite * cf.prix_unitaire) as montant,
              cf.created_at as date_creation,
              p.id as preinscription_id,
              p.enfant_prenom || ' ' || p.enfant_nom as enfant_nom
            FROM commandes_fournitures cf
            JOIN preinscriptions p ON cf.preinscription_id = p.id
            WHERE p.parent_id = $1
          `, [parentId]);

          echeancesFournitures = fournEchRes.rows.map((e: any) => ({
            id: -200000 - e.id,
            echeance: 'Fournitures scolaires',
            type: 'fournitures',
            montant: Number(e.montant) || 0,
            statut: 'en_attente',
            date_echeance: e.date_creation,
            preinscription_id: e.preinscription_id,
            reinscription_id: null,
            enfant_nom: e.enfant_nom,
            source_type: 'fournitures',
          }));
        } catch (err) {
          console.warn("⚠️ Erreur fournitures:", err);
        }

        // ========== 13. FUSION DE TOUTES LES ÉCHÉANCES ==========
        const toutesEcheances: EcheanceBrute[] = [
          ...echeancesScolarite,
          ...echeancesCantine,
          ...echeancesTransport,
          ...echeancesFournitures,
        ];

        // ========== 14. RÉPARTITION DE LA REMISE SUR LES SERVICES (PRORATA) ==========
        const totauxBrutsParService: Record<string, number> = {
          scolarite: scolariteBrut,
          cantine: cantineBrut,
          transport: transportBrut,
          fournitures: fournituresBrut,
        };

        const remiseParService: Record<string, number> = {
          scolarite: depensesBrutes > 0 ? (scolariteBrut / depensesBrutes) * remiseAccordee : 0,
          cantine: depensesBrutes > 0 ? (cantineBrut / depensesBrutes) * remiseAccordee : 0,
          transport: depensesBrutes > 0 ? (transportBrut / depensesBrutes) * remiseAccordee : 0,
          fournitures: depensesBrutes > 0 ? (fournituresBrut / depensesBrutes) * remiseAccordee : 0,
        };

        const echeancesAvecRemise: EcheanceBrute[] = toutesEcheances.map((ech) => {
          const st = ech.source_type || 'scolarite';
          const totalServiceBrut = totauxBrutsParService[st] || 0;
          const remiseService = remiseParService[st] || 0;

          const partEcheance = totalServiceBrut > 0 ? ech.montant / totalServiceBrut : 0;
          const remiseEcheance = remiseService * partEcheance;
          const montantNet = Math.max(0, ech.montant - remiseEcheance);

          return {
            ...ech,
            montant_brut: ech.montant,
            remise_appliquee: remiseEcheance,
            montant: montantNet,
          };
        });

        // ========== 15. DEBUG LOG ==========
        console.log(`[DEBUG FIFO] Parent ${parent.prenom} ${parent.nom}:`, {
          depensesBrutes,
          remiseAccordee,
          totalNet,
          totalPaye,
          nbEcheances: echeancesAvecRemise.length,
          scolarite: {
            count: echeancesScolarite.length,
            montant: scolariteBrut,
          },
          cantine: {
            count: echeancesCantine.length,
            montant: cantineBrut,
          },
          transport: {
            count: echeancesTransport.length,
            montant: transportBrut,
          },
          fournitures: {
            count: echeancesFournitures.length,
            montant: fournituresBrut,
          },
          remiseParService,
        });

        // ========== 16. APPLICATION FIFO SUR LES MONTANTS NETS ==========
        const montantARepartir = Math.min(totalNet, totalPaye);
        const echeancesReparties = repartirPaiementsFIFO(montantARepartir, echeancesAvecRemise);

        // ========== 17. CALCUL DES BREAKDOWNS PAR SERVICE ==========
        const sumBy = (
          sourceType: string,
          field: 'montant' | 'montant_paye' | 'reste_a_payer' | 'montant_brut' | 'remise_appliquee'
        ) =>
          echeancesReparties
            .filter((e) => e.source_type === sourceType)
            .reduce((acc, e) => acc + Number((e as any)[field] || 0), 0);

        const services_breakdown = {
          scolarite: {
            brut: sumBy('scolarite', 'montant_brut'),
            remise: sumBy('scolarite', 'remise_appliquee'),
            total: sumBy('scolarite', 'montant'),
            paye: sumBy('scolarite', 'montant_paye'),
            reste: sumBy('scolarite', 'reste_a_payer'),
          },
          cantine: {
            brut: sumBy('cantine', 'montant_brut'),
            remise: sumBy('cantine', 'remise_appliquee'),
            total: sumBy('cantine', 'montant'),
            paye: sumBy('cantine', 'montant_paye'),
            reste: sumBy('cantine', 'reste_a_payer'),
          },
          transport: {
            brut: sumBy('transport', 'montant_brut'),
            remise: sumBy('transport', 'remise_appliquee'),
            total: sumBy('transport', 'montant'),
            paye: sumBy('transport', 'montant_paye'),
            reste: sumBy('transport', 'reste_a_payer'),
          },
          fournitures: {
            brut: sumBy('fournitures', 'montant_brut'),
            remise: sumBy('fournitures', 'remise_appliquee'),
            total: sumBy('fournitures', 'montant'),
            paye: sumBy('fournitures', 'montant_paye'),
            reste: sumBy('fournitures', 'reste_a_payer'),
          },
        };

        // ========== 18. ÉCHÉANCES FINALES (scolarité uniquement pour le modal) ==========
        const echeancesFinales = echeancesReparties
          .filter((e) => e.source_type === 'scolarite')
          .map((e) => ({
            id: e.id,
            echeance: e.echeance,
            type: e.type,
            montant: e.montant,
            montant_brut: e.montant_brut,
            remise_appliquee: e.remise_appliquee,
            statut: e.statut_calcule,
            statut_original: e.statut,
            date_echeance: e.date_echeance,
            preinscription_id: e.preinscription_id,
            reinscription_id: e.reinscription_id,
            enfant_nom: e.enfant_nom,
            montant_paye: e.montant_paye,
            reste_a_payer: e.reste_a_payer,
          }));

        return {
          parent_id: parent.parent_id,
          nom: parent.nom,
          prenom: parent.prenom,
          email: parent.email,
          telephone: parent.telephone,
          adresse: parent.adresse,
          profession: parent.profession,
          photo_url: parent.photo_url,
          est_actif: parent.est_actif,
          situation_matrimoniale: parent.situation_matrimoniale,
          enfants_inscrits: elevesResult.rows || [],
          preinscriptions: preinsResult.rows || [],
          totaux: {
            depenses_brutes: depensesBrutes,
            remise_accordee: remiseAccordee,
            total_net: totalNet,
            total_paye: totalPaye,
            solde_restant: soldeRestant,
          },
          services_breakdown,
          echeances: echeancesFinales,
        };
      })
    );

    return NextResponse.json(parentsFinances);
  } catch (error: any) {
    console.error("Erreur API Admin Finances Parents:", error);
    return NextResponse.json(
      { error: "Erreur serveur: " + error.message },
      { status: 500 }
    );
  }
}