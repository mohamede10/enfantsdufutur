// app/api/reinscription/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    const body = await request.json();
    const { parent, parentId, enfants, type, ...rest } = body;

    const isReinscription = type === "reinscription";

    // Récupérer ou créer le parent
    let parentIdFinal = parentId;

    if (!parentIdFinal && parent) {
      // Vérifier si le parent existe déjà
      const existingParent = await query(`
        SELECT p.id 
        FROM parents p
        JOIN utilisateurs u ON p.utilisateur_id = u.id
        WHERE u.email = $1
      `, [parent.email]);

      if (existingParent.rows.length > 0) {
        parentIdFinal = existingParent.rows[0].id;
      } else {
        // ⭐ CRÉER L'UTILISATEUR PARENT AVEC MOT DE PASSE
        const hashedPassword = await bcrypt.hash(parent.password, 10);
        
        // D'abord créer l'utilisateur principal (père)
        const userResult = await query(`
          INSERT INTO utilisateurs (
            email, password, prenom, nom, telephone, adresse, role
          ) VALUES ($1, $2, $3, $4, $5, $6, 'PARENT')
          RETURNING id
        `, [
          parent.email, 
          hashedPassword, 
          parent.perePrenom, 
          parent.pereNom, 
          parent.perePhone, 
          parent.adresse || null
        ]);

        const userId = userResult.rows[0].id;

        // Créer le parent
        const parentResult = await query(`
          INSERT INTO parents (utilisateur_id, profession)
          VALUES ($1, $2)
          RETURNING id
        `, [userId, parent.pereProfession || null]);

        parentIdFinal = parentResult.rows[0].id;

        // Si la mère est renseignée, l'ajouter comme deuxième parent
        if (parent.mereNom || parent.merePrenom) {
          // ⭐ GÉNÉRER UN EMAIL UNIQUE POUR LA MÈRE
          // On utilise le nom et prénom de la mère pour créer un email, avec un timestamp pour éviter les collisions
          const mereEmail = `mere_${parent.merePrenom.toLowerCase()}.${parent.mereNom.toLowerCase()}_${Date.now()}@temp.com`;
          
          // Créer un compte pour la mère avec cet email unique
          const mereUserResult = await query(`
            INSERT INTO utilisateurs (
              email, password, prenom, nom, telephone, role
            ) VALUES ($1, $2, $3, $4, $5, 'PARENT')
            RETURNING id
          `, [
            mereEmail, // email unique
            hashedPassword, // même mot de passe que le père (ou on pourrait en générer un autre)
            parent.merePrenom, 
            parent.mereNom, 
            parent.merePhone || null
          ]);

          const mereUserId = mereUserResult.rows[0].id;

          await query(`
            INSERT INTO parents (utilisateur_id, profession)
            VALUES ($1, $2)
          `, [mereUserId, parent.mereProfession || null]);
        }
      }
    }

    // Récupérer l'année scolaire active
    const anneeScolaire = await query(`
      SELECT id FROM annees_scolaires WHERE est_active = true
    `);
    const anneeScolaireId = anneeScolaire.rows[0]?.id || null;

    const reinscriptions = [];

    // Traiter chaque enfant
    for (const enfant of enfants) {
      // Récupérer la classe choisie
      const classeInfo = await query(`
        SELECT 
          id,
          nom,
          niveau,
          reinscription_total_versement,
          total_versement,
          frais_inscription
        FROM classes 
        WHERE nom = $1
      `, [enfant.classe]);

      if (classeInfo.rows.length === 0) {
        console.error(`❌ Classe non trouvée: ${enfant.classe}`);
        continue;
      }

      const classe = classeInfo.rows[0];
      const classeId = classe.id;

      // Calculer le montant des frais de réinscription
      const montantFrais = Number(classe.reinscription_total_versement) || 
                          Number(classe.total_versement) || 
                          Number(classe.frais_inscription) || 
                          500000;

      // ⭐ GÉNÉRER UN NUMÉRO DE DOSSIER UNIQUE (AMÉLIORÉ)
      const currentYear = new Date().getFullYear();
      const maxDossierResult = await query(`
        SELECT MAX(CAST(SUBSTRING(numero_dossier FROM POSITION('-' IN numero_dossier) + 1) AS INTEGER)) as max_num
        FROM reinscriptions
        WHERE numero_dossier LIKE $1
      `, [`R${currentYear}-%`]);
      const maxNum = maxDossierResult.rows[0]?.max_num || 0;
      const nextNum = maxNum + 1;
      const numeroDossier = `R${currentYear}-${nextNum.toString().padStart(4, '0')}`;

      // ⭐ CHERCHER L'ÉLÈVE EXISTANT
      let eleveId = null;
      
      // 1. Rechercher par matricule (le plus fiable)
      if (enfant.matricule) {
        const eleveResult = await query(`
          SELECT id FROM eleves WHERE matricule = $1
        `, [enfant.matricule]);
        if (eleveResult.rows.length > 0) {
          eleveId = eleveResult.rows[0].id;
          console.log(`✅ Élève trouvé par matricule: ${enfant.matricule}`);
        }
      }

      // 2. Si non trouvé, chercher par parent + identité (recherche robuste)
      if (!eleveId && parentIdFinal) {
        const eleveResult = await query(`
          SELECT e.id
          FROM eleves e
          JOIN lien_parent_eleve l ON e.id = l.eleve_id
          JOIN utilisateurs u ON e.utilisateur_id = u.id
          WHERE l.parent_id = $1
            AND TRIM(u.nom) ILIKE TRIM($2)
            AND TRIM(u.prenom) ILIKE TRIM($3)
            AND e.date_naissance = $4
        `, [parentIdFinal, enfant.nom, enfant.prenom, enfant.dateNaissance]);
        
        if (eleveResult.rows.length > 0) {
          eleveId = eleveResult.rows[0].id;
          console.log(`✅ Élève trouvé par parent + identité: ${enfant.prenom} ${enfant.nom}`);
        }
      }

      // 3. Si toujours pas trouvé, chercher par nom/prénom/date (moins fiable)
      if (!eleveId) {
        const eleveResult = await query(`
          SELECT e.id 
          FROM eleves e
          JOIN utilisateurs u ON e.utilisateur_id = u.id
          WHERE TRIM(u.nom) ILIKE TRIM($1) 
            AND TRIM(u.prenom) ILIKE TRIM($2) 
            AND e.date_naissance = $3
        `, [enfant.nom, enfant.prenom, enfant.dateNaissance]);
        if (eleveResult.rows.length > 0) {
          eleveId = eleveResult.rows[0].id;
          console.log(`✅ Élève trouvé par nom/prénom/date: ${enfant.prenom} ${enfant.nom}`);
        }
      }

      // 4. Si toujours pas trouvé, créer un nouvel élève
      if (!eleveId) {
        console.log(`🆕 Création d'un nouvel élève: ${enfant.prenom} ${enfant.nom}`);
        
        // ⭐ GÉNÉRER UN MOT DE PASSE PAR DÉFAUT POUR L'ÉLÈVE
        const defaultPassword = "eleve123";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Créer l'utilisateur pour l'élève avec un mot de passe
        const eleveUserResult = await query(`
          INSERT INTO utilisateurs (
            nom, prenom, email, password, role
          ) VALUES ($1, $2, $3, $4, 'ELEVE')
          RETURNING id
        `, [
          enfant.nom, 
          enfant.prenom, 
          `eleve_${Date.now()}@temp.com`, 
          hashedPassword
        ]);

        const eleveUserId = eleveUserResult.rows[0].id;

        // ⭐ GÉNÉRER UN MATRICULE UNIQUE
        const getNextMatricule = async (year: number) => {
          const result = await query(`
            SELECT MAX(CAST(SUBSTRING(matricule, 5) AS INTEGER)) as max_num
            FROM eleves
            WHERE matricule LIKE $1
          `, [`${year}%`]);
          const maxNum = result.rows[0]?.max_num || 0;
          const nextNum = maxNum + 1;
          return `${year}${nextNum.toString().padStart(4, '0')}`;
        };

        const matricule = enfant.matricule ? enfant.matricule : await getNextMatricule(currentYear);

        // Créer l'élève
        const eleveResult = await query(`
          INSERT INTO eleves (
            utilisateur_id,
            matricule,
            date_naissance,
            lieu_naissance,
            sexe,
            classe_id,
            photo_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          eleveUserId,
          matricule,
          enfant.dateNaissance,
          enfant.lieuNaissance || null,
          enfant.sexe,
          classeId,
          enfant.photoUrl || null
        ]);

        eleveId = eleveResult.rows[0].id;

        // Lier l'élève au parent
        await query(`
          INSERT INTO lien_parent_eleve (parent_id, eleve_id)
          VALUES ($1, $2)
        `, [parentIdFinal, eleveId]);
        
        console.log(`✅ Nouvel élève créé avec ID: ${eleveId}, matricule: ${matricule}`);
      }

      // ⭐ VÉRIFIER QUE L'ÉLÈVE EST BIEN LIÉ AU PARENT
      const linkCheck = await query(`
        SELECT 1 FROM lien_parent_eleve 
        WHERE parent_id = $1 AND eleve_id = $2
      `, [parentIdFinal, eleveId]);

      if (linkCheck.rows.length === 0) {
        await query(`
          INSERT INTO lien_parent_eleve (parent_id, eleve_id)
          VALUES ($1, $2)
        `, [parentIdFinal, eleveId]);
        console.log(`✅ Lien parent-élève créé: parent=${parentIdFinal}, eleve=${eleveId}`);
      }

      // ⭐ CRÉER LA RÉINSCRIPTION
      const result = await query(`
        INSERT INTO reinscriptions (
          eleve_id,
          parent_id,
          annee_scolaire_id,
          classe_id,
          montant_frais,
          statut,
          numero_dossier,
          enfant_nom,
          enfant_prenom,
          date_naissance,
          lieu_naissance,
          sexe,
          niveau,
          classe_nom,
          photo_url,
          acte_naissance_url,
          bulletin_url,
          montant_total_plan,
          montant_restant_plan,
          parent_nom,
          parent_prenom,
          parent_email,
          parent_telephone
        ) VALUES (
          $1, $2, $3, $4, $5, 'en_attente', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        RETURNING id
      `, [
        eleveId,
        parentIdFinal,
        anneeScolaireId,
        classeId,
        montantFrais,
        numeroDossier,
        enfant.nom,
        enfant.prenom,
        enfant.dateNaissance,
        enfant.lieuNaissance || null,
        enfant.sexe,
        enfant.niveau,
        enfant.classe,
        enfant.photoUrl || null,
        enfant.acteNaissanceUrl || null,
        enfant.bulletinUrl || null,
        rest.montant_total || montantFrais,
        rest.montant_total || montantFrais,
        parent?.pereNom || null,
        parent?.perePrenom || null,
        parent?.email || null,
        parent?.perePhone || null
      ]);

      const reinscriptionId = result.rows[0].id;
      console.log(`✅ Réinscription créée avec ID: ${reinscriptionId}`);

      // ⭐ CRÉER LES ÉCHÉANCES DE PAIEMENT
      const premier = Number(classe.reinscription_premier_versement) || Number(classe.premier_versement) || 0;
      const deuxieme = Number(classe.reinscription_deuxieme_versement) || Number(classe.deuxieme_versement) || 0;
      const troisieme = Number(classe.reinscription_troisieme_versement) || Number(classe.troisieme_versement) || 0;

      if (premier > 0) {
        await query(`
          INSERT INTO echeances_paiement (
            reinscription_id, type, echeance, montant, date_echeance, statut
          ) VALUES ($1, 'reinscription', '1er_versement', $2, CURRENT_DATE, 'en_attente')
        `, [reinscriptionId, premier]);
        console.log(`✅ Échéance 1er versement créée: ${premier} GNF`);
      }

      if (deuxieme > 0) {
        await query(`
          INSERT INTO echeances_paiement (
            reinscription_id, type, echeance, montant, date_echeance, statut
          ) VALUES ($1, 'reinscription', '2eme_versement', $2, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '6 months', 'en_attente')
        `, [reinscriptionId, deuxieme]);
        console.log(`✅ Échéance 2ème versement créée: ${deuxieme} GNF`);
      }

      if (troisieme > 0) {
        await query(`
          INSERT INTO echeances_paiement (
            reinscription_id, type, echeance, montant, date_echeance, statut
          ) VALUES ($1, 'reinscription', '3eme_versement', $2, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '8 months', 'en_attente')
        `, [reinscriptionId, troisieme]);
        console.log(`✅ Échéance 3ème versement créée: ${troisieme} GNF`);
      }

      // Créer les échéances pour les services optionnels
      if (rest.transport && rest.transport.length > 0) {
        for (const t of rest.transport) {
          await query(`
            INSERT INTO echeances_paiement (
              reinscription_id, type, echeance, montant, date_echeance, statut
            ) VALUES ($1, 'transport', $2, $3, CURRENT_DATE, 'en_attente')
          `, [reinscriptionId, t.nom || 'transport', t.prix || 0]);
          console.log(`✅ Échéance transport créée: ${t.nom} - ${t.prix} GNF`);
        }
      }

      if (rest.cantine && rest.cantine.length > 0) {
        for (const c of rest.cantine) {
          await query(`
            INSERT INTO echeances_paiement (
              reinscription_id, type, echeance, montant, date_echeance, statut
            ) VALUES ($1, 'cantine', $2, $3, CURRENT_DATE, 'en_attente')
          `, [reinscriptionId, c.nom || 'cantine', c.prix || 0]);
          console.log(`✅ Échéance cantine créée: ${c.nom} - ${c.prix} GNF`);
        }
      }

      if (rest.fournitures_commande && rest.fournitures_commande.length > 0) {
        for (const f of rest.fournitures_commande) {
          const montantTotal = (f.quantite || 1) * (f.prix_unitaire || 0);
          if (montantTotal > 0) {
            await query(`
              INSERT INTO echeances_paiement (
                reinscription_id, type, echeance, montant, date_echeance, statut
              ) VALUES ($1, 'fournitures', $2, $3, CURRENT_DATE, 'en_attente')
            `, [reinscriptionId, f.nom || 'fournitures', montantTotal]);
            console.log(`✅ Échéance fournitures créée: ${f.nom} - ${montantTotal} GNF`);
          }
        }
      }

      reinscriptions.push({
        id: reinscriptionId,
        numero_dossier: numeroDossier,
        enfant_nom: enfant.nom,
        enfant_prenom: enfant.prenom,
        classe: enfant.classe,
        statut: 'en_attente',
        montant_frais: montantFrais
      });
    }

    return NextResponse.json({
      success: true,
      message: `${reinscriptions.length} réinscription(s) créée(s) avec succès`,
      reinscriptions
    });

  } catch (error) {
    console.error("Erreur API Réinscription:", error);
    return NextResponse.json({
      success: false,
      message: "Erreur lors de la création de la réinscription: " + (error as Error).message
    }, { status: 500 });
  }
}