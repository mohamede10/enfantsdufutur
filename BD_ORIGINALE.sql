-- ============================================================
-- Schéma public (recréation exacte)
-- ============================================================

-- Type énuméré utilisé dans la table utilisateurs
CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'DIRECTEUR_GENERAL',
    'DIRECTEUR_ETUDES',
    'COMPTABLE',
    'SECRETARIAT',
    'SURVEILLANT',
    'ENSEIGNANT',
    'PARENT',
    'ELEVE',
    'CHAUFFEUR',
    'CANTINE'
);

-- ------------------------------------------------------------
-- Séquences
-- ------------------------------------------------------------
CREATE SEQUENCE public.annees_scolaires_id_seq AS integer START 1;
CREATE SEQUENCE public.annonces_id_seq AS integer START 1;
CREATE SEQUENCE public.articles_librairie_id_seq AS integer START 1;
CREATE SEQUENCE public.avances_salaires_id_seq AS integer START 1;
CREATE SEQUENCE public.budget_previsionnel_id_seq AS integer START 1;
CREATE SEQUENCE public.bus_id_seq AS integer START 1;
CREATE SEQUENCE public.cantine_menus_id_seq AS integer START 1;
CREATE SEQUENCE public.categories_depenses_id_seq AS integer START 1;
CREATE SEQUENCE public.categories_quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.classes_id_seq AS integer START 1;
CREATE SEQUENCE public.commandes_fournitures_id_seq AS integer START 1;
CREATE SEQUENCE public.commandes_librairie_id_seq AS integer START 1;
CREATE SEQUENCE public.commandes_librairie_articles_id_seq AS integer START 1;
CREATE SEQUENCE public.conges_personnel_id_seq AS integer START 1;
CREATE SEQUENCE public.contrats_personnel_id_seq AS integer START 1;
CREATE SEQUENCE public.depenses_id_seq AS integer START 1;
CREATE SEQUENCE public.devoirs_id_seq AS integer START 1;
CREATE SEQUENCE public.echeances_paiement_id_seq AS integer START 1;
CREATE SEQUENCE public.eleves_id_seq AS integer START 1;
CREATE SEQUENCE public.emprunts_bibliotheque_id_seq AS integer START 1;
CREATE SEQUENCE public.enseignements_id_seq AS integer START 1;
CREATE SEQUENCE public.examens_id_seq AS integer START 1;
CREATE SEQUENCE public.examens_eleves_id_seq AS integer START 1;
CREATE SEQUENCE public.frais_scolaires_id_seq AS integer START 1;
CREATE SEQUENCE public.inscriptions_id_seq AS integer START 1;
CREATE SEQUENCE public.inscriptions_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.inscriptions_transport_id_seq AS integer START 1;
CREATE SEQUENCE public.lecons_id_seq AS integer START 1;
CREATE SEQUENCE public.lignes_transport_id_seq AS integer START 1;
CREATE SEQUENCE public.livres_bibliotheque_id_seq AS integer START 1;
CREATE SEQUENCE public.logs_activites_id_seq AS integer START 1;
CREATE SEQUENCE public.matieres_id_seq AS integer START 1;
CREATE SEQUENCE public.menus_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.messages_id_seq AS integer START 1;
CREATE SEQUENCE public.mouvements_caisse_id_seq AS integer START 1;
CREATE SEQUENCE public.notes_id_seq AS integer START 1;
CREATE SEQUENCE public.options_qcm_id_seq AS integer START 1;
CREATE SEQUENCE public.options_quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.paiements_id_seq AS integer START 1;
CREATE SEQUENCE public.paiements_salaires_id_seq AS integer START 1;
CREATE SEQUENCE public.parents_id_seq AS integer START 1;
CREATE SEQUENCE public.participations_quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.personnels_id_seq AS integer START 1;
CREATE SEQUENCE public.preinscriptions_id_seq AS integer START 1;
CREATE SEQUENCE public.preinscription_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.preinscription_transport_id_seq AS integer START 1;
CREATE SEQUENCE public.presences_id_seq AS integer START 1;
CREATE SEQUENCE public.presences_transport_id_seq AS integer START 1;
CREATE SEQUENCE public.questions_qcm_id_seq AS integer START 1;
CREATE SEQUENCE public.questions_quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.quiz_questions_id_seq AS integer START 1;
CREATE SEQUENCE public.recus_id_seq AS integer START 1;
CREATE SEQUENCE public.reinscriptions_id_seq AS integer START 1;
CREATE SEQUENCE public.remises_familles_id_seq AS integer START 1;
CREATE SEQUENCE public.reponses_eleves_qcm_id_seq AS integer START 1;
CREATE SEQUENCE public.reponses_quiz_id_seq AS integer START 1;
CREATE SEQUENCE public.reservations_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.reserves_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.reset_tokens_id_seq AS integer START 1;
CREATE SEQUENCE public.services_annexes_id_seq AS integer START 1;
CREATE SEQUENCE public.sessions_id_seq AS integer START 1;
CREATE SEQUENCE public.soumissions_devoirs_id_seq AS integer START 1;
CREATE SEQUENCE public.transactions_cantine_id_seq AS integer START 1;
CREATE SEQUENCE public.utilisateurs_id_seq AS integer START 1;
CREATE SEQUENCE public.ventes_librairie_id_seq AS integer START 1;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.annees_scolaires (
    id integer DEFAULT nextval('public.annees_scolaires_id_seq') NOT NULL,
    libelle character varying(20) NOT NULL,
    date_debut date NOT NULL,
    date_fin date NOT NULL,
    est_active boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.annonces (
    id integer DEFAULT nextval('public.annonces_id_seq') NOT NULL,
    titre character varying(255) NOT NULL,
    contenu text NOT NULL,
    cible character varying(50) DEFAULT 'tous'::character varying,
    type character varying(50) DEFAULT 'information'::character varying,
    classe_id integer,
    image_url text,
    date_publication timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    date_modification timestamp(6) without time zone,
    date_programmee timestamp(6) without time zone,
    publie_par integer
);

CREATE TABLE public.articles_librairie (
    id integer DEFAULT nextval('public.articles_librairie_id_seq') NOT NULL,
    nom character varying(255) NOT NULL,
    description text,
    prix_unitaire integer NOT NULL,
    quantite_stock integer DEFAULT 0,
    categorie character varying(100) DEFAULT 'fourniture'::character varying,
    image_url text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    niveaux_cibles text[]
);

CREATE TABLE public.avances_salaires (
    id integer DEFAULT nextval('public.avances_salaires_id_seq') NOT NULL,
    personnel_id integer NOT NULL,
    montant integer NOT NULL,
    motif text,
    date_avance timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    mois_deduction integer NOT NULL,
    annee_deduction integer NOT NULL,
    statut character varying(20) DEFAULT 'accorde'::character varying,
    accorde_par integer,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.budget_previsionnel (
    id integer DEFAULT nextval('public.budget_previsionnel_id_seq') NOT NULL,
    annee integer NOT NULL,
    categorie_code character varying(20) NOT NULL,
    montant_prevu integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.bus (
    id integer DEFAULT nextval('public.bus_id_seq') NOT NULL,
    immatriculation character varying(50) NOT NULL,
    capacite integer,
    chauffeur_nom character varying(100),
    chauffeur_tel character varying(20)
);

CREATE TABLE public.cantine_menus (
    id integer DEFAULT nextval('public.cantine_menus_id_seq') NOT NULL,
    date date NOT NULL,
    plat character varying(255),
    accompagnement character varying(255),
    dessert character varying(255),
    regime_special boolean DEFAULT false,
    prix integer,
    prix_annuel integer
);

CREATE TABLE public.categories_depenses (
    id integer DEFAULT nextval('public.categories_depenses_id_seq') NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    type character varying(10) DEFAULT 'sortie'::character varying NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.categories_quiz (
    id integer DEFAULT nextval('public.categories_quiz_id_seq') NOT NULL,
    nom character varying(100) NOT NULL,
    description text,
    couleur character varying(7) DEFAULT '#6B46C1'::character varying,
    icon character varying(50) DEFAULT 'BookOpen'::character varying,
    est_active boolean DEFAULT true,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.classes (
    id integer DEFAULT nextval('public.classes_id_seq') NOT NULL,
    nom character varying(50) NOT NULL,
    niveau character varying(50) NOT NULL,
    salle character varying(50),
    capacite_max integer DEFAULT 30,
    titulaire_id integer,
    code_acces character varying(20),
    frais_inscription integer DEFAULT 0,
    annee_scolaire_id integer,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    premier_versement integer DEFAULT 0,
    deuxieme_versement integer DEFAULT 0,
    troisieme_versement integer DEFAULT 0,
    total_versement integer DEFAULT 0,
    reinscription_premier_versement integer DEFAULT 0,
    reinscription_deuxieme_versement integer DEFAULT 0,
    reinscription_troisieme_versement integer DEFAULT 0,
    reinscription_total_versement integer DEFAULT 0
);

CREATE TABLE public.commandes_fournitures (
    id integer DEFAULT nextval('public.commandes_fournitures_id_seq') NOT NULL,
    preinscription_id integer,
    article_id integer,
    quantite integer DEFAULT 1 NOT NULL,
    prix_unitaire integer NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.commandes_librairie (
    id integer DEFAULT nextval('public.commandes_librairie_id_seq') NOT NULL,
    parent_id integer,
    numero_commande character varying(50) NOT NULL,
    date_commande timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    total integer NOT NULL,
    observations text,
    date_traitement timestamp(6) without time zone,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.commandes_librairie_articles (
    id integer DEFAULT nextval('public.commandes_librairie_articles_id_seq') NOT NULL,
    commande_id integer,
    article_id integer,
    quantite integer NOT NULL,
    prix_unitaire integer NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.conges_personnel (
    id integer DEFAULT nextval('public.conges_personnel_id_seq') NOT NULL,
    personnel_id integer NOT NULL,
    type_conge character varying(50) DEFAULT 'annuel'::character varying NOT NULL,
    date_debut date NOT NULL,
    date_fin date NOT NULL,
    nombre_jours integer,
    motif text,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    approuve_par integer,
    date_approbation timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.contrats_personnel (
    id integer DEFAULT nextval('public.contrats_personnel_id_seq') NOT NULL,
    personnel_id integer NOT NULL,
    type_contrat character varying(50) DEFAULT 'CDI'::character varying NOT NULL,
    date_debut date NOT NULL,
    date_fin date,
    salaire_brut integer NOT NULL,
    salaire_net integer NOT NULL,
    heures_semaine numeric(5,2) DEFAULT 40,
    conges_annuels integer DEFAULT 25,
    observations text,
    is_actif boolean DEFAULT true,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.depenses (
    id integer DEFAULT nextval('public.depenses_id_seq') NOT NULL,
    categorie character varying(100) NOT NULL,
    montant integer NOT NULL,
    description text,
    date_depense timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    sous_categorie character varying(100),
    reference character varying(100),
    fournisseur character varying(200),
    numero_recu character varying(100),
    saisi_par integer,
    valide_par integer,
    statut character varying(20) DEFAULT 'valide'::character varying,
    exercice_annee integer DEFAULT EXTRACT(year FROM now()),
    exercice_mois integer DEFAULT EXTRACT(month FROM now()),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.devoirs (
    id integer DEFAULT nextval('public.devoirs_id_seq') NOT NULL,
    enseignement_id integer,
    titre character varying(255) NOT NULL,
    description text,
    fichier_url text,
    date_limite date NOT NULL,
    date_publication date DEFAULT CURRENT_DATE
);

CREATE TABLE public.echeances_paiement (
    id integer DEFAULT nextval('public.echeances_paiement_id_seq') NOT NULL,
    preinscription_id integer,
    type character varying(50) NOT NULL,
    echeance character varying(50) NOT NULL,
    montant integer NOT NULL,
    date_echeance date,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    date_paiement date,
    reference_transaction character varying(100),
    mode_paiement character varying(50),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    reinscription_id integer
);

CREATE TABLE public.eleves (
    id integer DEFAULT nextval('public.eleves_id_seq') NOT NULL,
    utilisateur_id integer,
    matricule character varying(50) NOT NULL,
    date_naissance date NOT NULL,
    lieu_naissance character varying(100),
    sexe character varying(1),
    nationalite character varying(50) DEFAULT 'Guin├⌐enne'::character varying,
    classe_id integer,
    date_inscription date DEFAULT CURRENT_DATE,
    est_inscrit boolean DEFAULT true,
    carte_scolaire_url text,
    photo_url text,
    deleted_at timestamp without time zone
);

CREATE TABLE public.emprunts_bibliotheque (
    id integer DEFAULT nextval('public.emprunts_bibliotheque_id_seq') NOT NULL,
    livre_id integer,
    eleve_id integer,
    date_emprunt timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    date_retour_prevue timestamp(6) without time zone NOT NULL,
    date_retour_reelle timestamp(6) without time zone,
    statut character varying(20) DEFAULT 'en_cours'::character varying
);

CREATE TABLE public.enseignements (
    id integer DEFAULT nextval('public.enseignements_id_seq') NOT NULL,
    enseignant_id integer,
    classe_id integer,
    matiere_id integer,
    heures_semaine numeric(5,2),
    heures_mois numeric(5,2),
    heures_an numeric(5,2),
    annee_scolaire_id integer
);

CREATE TABLE public.examens (
    id integer DEFAULT nextval('public.examens_id_seq') NOT NULL,
    enseignement_id integer,
    titre character varying(255) NOT NULL,
    duree_minutes integer,
    date_debut timestamp(6) without time zone,
    date_fin timestamp(6) without time zone,
    est_actif boolean DEFAULT true,
    fichier_url text
);

CREATE TABLE public.examens_eleves (
    id integer DEFAULT nextval('public.examens_eleves_id_seq') NOT NULL,
    examen_id integer NOT NULL,
    eleve_id integer NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.frais_scolaires (
    id integer DEFAULT nextval('public.frais_scolaires_id_seq') NOT NULL,
    nom character varying(100),
    type_frais character varying(50) NOT NULL,
    montant integer NOT NULL,
    obligatoire boolean DEFAULT true,
    frequence character varying(50) DEFAULT 'mensuel'::character varying,
    niveau character varying(50),
    annee_scolaire_id integer,
    description text
);

CREATE TABLE public.inscriptions (
    id integer DEFAULT nextval('public.inscriptions_id_seq') NOT NULL,
    preinscription_id integer,
    eleve_id integer,
    parent_id integer,
    numero_matricule character varying(50) NOT NULL,
    date_inscription date DEFAULT CURRENT_DATE,
    annee_scolaire_id integer,
    statut character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.inscriptions_cantine (
    id integer DEFAULT nextval('public.inscriptions_cantine_id_seq') NOT NULL,
    eleve_id integer,
    est_actif boolean DEFAULT true,
    solde numeric(12,2) DEFAULT 0,
    preferences_alimentaires text,
    allergies text,
    date_inscription date DEFAULT CURRENT_DATE,
    mois_total integer DEFAULT 9,
    mois_restants integer DEFAULT 9,
    montant_mensuel integer DEFAULT 400000,
    montant_total integer DEFAULT 3600000
);

CREATE TABLE public.inscriptions_transport (
    id integer DEFAULT nextval('public.inscriptions_transport_id_seq') NOT NULL,
    eleve_id integer,
    ligne_id integer,
    date_debut date,
    date_fin date,
    est_actif boolean DEFAULT true,
    mois_total integer DEFAULT 9,
    mois_restants integer DEFAULT 9,
    montant_mensuel integer DEFAULT 0,
    montant_total integer DEFAULT 0,
    solde integer DEFAULT 0,
    date_inscription timestamp without time zone DEFAULT now()
);

CREATE TABLE public.lecons (
    id integer DEFAULT nextval('public.lecons_id_seq') NOT NULL,
    enseignement_id integer,
    titre character varying(255) NOT NULL,
    description text,
    contenu text,
    fichier_url text,
    video_url text,
    date_publication date DEFAULT CURRENT_DATE,
    matiere_personnalisee character varying(100)
);

CREATE TABLE public.lien_parent_eleve (
    parent_id integer NOT NULL,
    eleve_id integer NOT NULL,
    lien character varying(50) DEFAULT 'parent'::character varying
);

CREATE TABLE public.lignes_transport (
    id integer DEFAULT nextval('public.lignes_transport_id_seq') NOT NULL,
    nom character varying(100),
    bus_id integer,
    horaire_matin time(6) without time zone,
    horaire_soir time(6) without time zone,
    prix_abonnement integer
);

CREATE TABLE public.livres_bibliotheque (
    id integer DEFAULT nextval('public.livres_bibliotheque_id_seq') NOT NULL,
    titre character varying(255) NOT NULL,
    auteur character varying(255),
    isbn character varying(50),
    quantite integer DEFAULT 1,
    disponible integer DEFAULT 1,
    emplacement character varying(50),
    categorie character varying(100),
    image_url text
);

CREATE TABLE public.logs_activites (
    id integer DEFAULT nextval('public.logs_activites_id_seq') NOT NULL,
    utilisateur_id integer,
    action character varying(255),
    details text,
    ip_address character varying(45),
    date_action timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.matieres (
    id integer DEFAULT nextval('public.matieres_id_seq') NOT NULL,
    nom character varying(100) NOT NULL,
    coefficient integer DEFAULT 1,
    description text
);

CREATE TABLE public.menus_cantine (
    id integer DEFAULT nextval('public.menus_cantine_id_seq') NOT NULL,
    date date NOT NULL,
    plat character varying(255),
    accompagnement character varying(255),
    dessert character varying(255),
    prix numeric(10,2) DEFAULT 5000,
    allergenes text,
    calories integer,
    regime_special boolean DEFAULT false
);

CREATE TABLE public.messages (
    id integer DEFAULT nextval('public.messages_id_seq') NOT NULL,
    expediteur_id integer,
    destinataire_id integer,
    sujet character varying(255),
    contenu text,
    est_lu boolean DEFAULT false,
    date_envoi timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.mouvements_caisse (
    id integer DEFAULT nextval('public.mouvements_caisse_id_seq') NOT NULL,
    type character varying(10) NOT NULL,
    montant integer NOT NULL,
    categorie character varying(100) NOT NULL,
    sous_categorie character varying(100),
    description text,
    reference character varying(100),
    date_mouvement timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    exercice_annee integer DEFAULT EXTRACT(year FROM now()) NOT NULL,
    exercice_mois integer DEFAULT EXTRACT(month FROM now()) NOT NULL,
    saisi_par integer,
    valide_par integer,
    statut character varying(20) DEFAULT 'valide'::character varying,
    recu_url text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.notes (
    id integer DEFAULT nextval('public.notes_id_seq') NOT NULL,
    eleve_id integer,
    enseignement_id integer,
    type_note character varying(50),
    valeur numeric(5,2) NOT NULL,
    coefficient integer DEFAULT 1,
    date_saisie date DEFAULT CURRENT_DATE,
    commentaire text,
    enseignant_id integer,
    note_sur integer DEFAULT 20
);

CREATE TABLE public.options_qcm (
    id integer DEFAULT nextval('public.options_qcm_id_seq') NOT NULL,
    question_id integer,
    option_texte text NOT NULL,
    est_correcte boolean DEFAULT false
);

CREATE TABLE public.options_quiz (
    id integer DEFAULT nextval('public.options_quiz_id_seq') NOT NULL,
    question_id integer,
    option_texte text NOT NULL,
    est_correcte boolean DEFAULT false,
    ordre integer
);

CREATE TABLE public.paiements (
    id integer DEFAULT nextval('public.paiements_id_seq') NOT NULL,
    eleve_id integer,
    montant integer NOT NULL,
    type_frais character varying(50),
    mois integer,
    annee integer,
    mode_paiement character varying(50),
    reference_transaction character varying(100),
    statut character varying(20) DEFAULT 'valide'::character varying,
    date_paiement date DEFAULT CURRENT_DATE,
    "re├ºu_url" text,
    saisie_par integer,
    preinscription_id integer,
    reinscription_id integer
);

CREATE TABLE public.paiements_salaires (
    id integer DEFAULT nextval('public.paiements_salaires_id_seq') NOT NULL,
    personnel_id integer,
    montant integer NOT NULL,
    mois integer NOT NULL,
    annee integer NOT NULL,
    mode_paiement character varying(50),
    reference_transaction character varying(100),
    saisie_par integer,
    statut character varying(20) DEFAULT 'paye'::character varying,
    date_paiement timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    note text,
    salaire_base integer DEFAULT 0,
    prime_mensuelle integer DEFAULT 0,
    prime_responsabilite integer DEFAULT 0,
    prime_craie integer DEFAULT 0,
    retenue_sanction integer DEFAULT 0,
    autres_retenues integer DEFAULT 0,
    details_lignes jsonb DEFAULT '[]'::jsonb,
    total_brut integer DEFAULT 0,
    total_deductions integer DEFAULT 0
);

CREATE TABLE public.parents (
    id integer DEFAULT nextval('public.parents_id_seq') NOT NULL,
    utilisateur_id integer,
    profession character varying(255),
    situation_matrimoniale character varying(225)
);

CREATE TABLE public.participations_quiz (
    id integer DEFAULT nextval('public.participations_quiz_id_seq') NOT NULL,
    quiz_id integer,
    eleve_id integer,
    date_debut timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    date_fin timestamp(6) without time zone,
    score_total integer DEFAULT 0,
    points_obtenus integer DEFAULT 0,
    reponses_correctes integer DEFAULT 0,
    reponses_totales integer DEFAULT 0,
    pourcentage numeric(5,2) DEFAULT 0,
    est_termine boolean DEFAULT false
);

CREATE TABLE public.personnels (
    id integer DEFAULT nextval('public.personnels_id_seq') NOT NULL,
    utilisateur_id integer,
    matricule_personnel character varying(50) NOT NULL,
    type character varying(50),
    date_embauche date DEFAULT CURRENT_DATE,
    salaire_base integer,
    carte_personnel_url text,
    statut character varying(20) DEFAULT 'actif'::character varying,
    departement character varying(100),
    prime_mensuelle integer DEFAULT 0,
    mode_paiement_salaire character varying(50) DEFAULT 'virement'::character varying,
    carte_id_url text,
    cv_url text,
    certificat_residence_url text
);

CREATE TABLE public.preinscriptions (
    id integer DEFAULT nextval('public.preinscriptions_id_seq') NOT NULL,
    parent_id integer,
    enfant_nom character varying(100) NOT NULL,
    enfant_prenom character varying(100) NOT NULL,
    date_naissance date NOT NULL,
    lieu_naissance character varying(100),
    sexe character varying(10) NOT NULL,
    niveau character varying(50) NOT NULL,
    classe character varying(50) NOT NULL,
    acte_naissance_url text,
    photo_url text,
    bulletin_url text,
    statut character varying(50) DEFAULT 'en_attente'::character varying,
    numero_dossier character varying(50),
    date_preinscription timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    observations text,
    traite_par integer,
    date_traitement timestamp(6) without time zone,
    frais_montant integer DEFAULT 0,
    frais_statut character varying(20) DEFAULT 'non_paye'::character varying,
    frais_mode_paiement character varying(50),
    frais_reference character varying(100),
    frais_date_paiement timestamp(6) without time zone,
    plan_paiement_id integer,
    montant_total_plan integer DEFAULT 0,
    montant_restant_plan integer DEFAULT 0,
    type_inscription character varying(50) DEFAULT 'inscription'::character varying,
    est_reinscription boolean DEFAULT false
);

CREATE TABLE public.preinscription_cantine (
    id integer DEFAULT nextval('public.preinscription_cantine_id_seq') NOT NULL,
    preinscription_id integer,
    menu_id integer,
    prix integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.preinscription_transport (
    id integer DEFAULT nextval('public.preinscription_transport_id_seq') NOT NULL,
    preinscription_id integer,
    ligne_id integer,
    prix integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.presences (
    id integer DEFAULT nextval('public.presences_id_seq') NOT NULL,
    eleve_id integer,
    classe_id integer,
    date date NOT NULL,
    statut character varying(20),
    heure_arrivee time(6) without time zone,
    justificatif_url text,
    enseignant_id integer
);

CREATE TABLE public.presences_transport (
    id integer DEFAULT nextval('public.presences_transport_id_seq') NOT NULL,
    eleve_id integer NOT NULL,
    date date NOT NULL,
    statut character varying(20) NOT NULL,
    heure_arrivee time(6) without time zone,
    commentaire text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.questions_qcm (
    id integer DEFAULT nextval('public.questions_qcm_id_seq') NOT NULL,
    examen_id integer,
    question text NOT NULL,
    points integer DEFAULT 1,
    ordre integer
);

CREATE TABLE public.questions_quiz (
    id integer DEFAULT nextval('public.questions_quiz_id_seq') NOT NULL,
    categorie_id integer,
    enseignement_id integer,
    question text NOT NULL,
    explication text,
    difficulte character varying(20) DEFAULT 'facile'::character varying,
    points integer DEFAULT 1,
    temps_secondes integer DEFAULT 30,
    est_active boolean DEFAULT true,
    ordre integer,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);

CREATE TABLE public.quiz (
    id integer DEFAULT nextval('public.quiz_id_seq') NOT NULL,
    enseignement_id integer,
    titre character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'qcm'::character varying,
    duree_minutes integer DEFAULT 10,
    est_actif boolean DEFAULT true,
    date_debut timestamp(6) without time zone,
    date_fin timestamp(6) without time zone,
    est_aleatoire boolean DEFAULT false,
    afficher_resultats boolean DEFAULT true,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    fichier_url text
);

CREATE TABLE public.quiz_questions (
    id integer DEFAULT nextval('public.quiz_questions_id_seq') NOT NULL,
    quiz_id integer,
    question_id integer,
    ordre integer,
    points_personnalises integer
);

CREATE TABLE public.recus (
    id integer DEFAULT nextval('public.recus_id_seq') NOT NULL,
    numero_recu character varying(50) NOT NULL,
    paiement_id integer,
    eleve_id integer,
    preinscription_id integer,
    reinscription_id integer,
    enfant_nom character varying(200),
    parent_nom character varying(200),
    montant integer NOT NULL,
    type_frais character varying(50),
    mode_paiement character varying(50),
    date_paiement timestamp without time zone DEFAULT now(),
    reference character varying(100),
    source character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    montant_total integer DEFAULT 0,
    reste_a_payer integer DEFAULT 0,
    classe_nom character varying(100)
);

CREATE TABLE public.reinscriptions (
    id integer DEFAULT nextval('public.reinscriptions_id_seq') NOT NULL,
    inscription_id integer,
    eleve_id integer,
    parent_id integer,
    annee_scolaire_id integer,
    classe_id integer,
    montant_frais integer DEFAULT 500000,
    frais_statut character varying(50) DEFAULT 'non_paye'::character varying,
    frais_mode_paiement character varying(50),
    frais_reference character varying(100),
    frais_date_paiement timestamp(6) without time zone,
    statut character varying(50) DEFAULT 'en_attente'::character varying,
    date_reinscription timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    observations text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    acte_naissance_url text,
    photo_url text,
    bulletin_url text,
    date_traitement timestamp(6) without time zone,
    numero_dossier character varying(50),
    enfant_nom character varying(100),
    enfant_prenom character varying(100),
    date_naissance date,
    lieu_naissance character varying(200),
    sexe character varying(10),
    niveau character varying(50),
    classe_nom character varying(50),
    parent_nom character varying(100),
    parent_prenom character varying(100),
    parent_email character varying(100),
    parent_telephone character varying(20),
    montant_total_plan integer DEFAULT 0,
    montant_restant_plan integer DEFAULT 0
);

CREATE TABLE public.remises_familles (
    id integer DEFAULT nextval('public.remises_familles_id_seq') NOT NULL,
    parent_id integer NOT NULL,
    montant numeric(12,2) NOT NULL,
    motif text,
    saisie_par integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.reponses_eleves_qcm (
    id integer DEFAULT nextval('public.reponses_eleves_qcm_id_seq') NOT NULL,
    examen_id integer,
    eleve_id integer,
    question_id integer,
    option_id integer,
    date_reponse timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.reponses_quiz (
    id integer DEFAULT nextval('public.reponses_quiz_id_seq') NOT NULL,
    participation_id integer,
    question_id integer,
    option_id integer,
    est_correcte boolean DEFAULT false,
    temps_reponse_ms integer,
    date_reponse timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.reservations_cantine (
    id integer DEFAULT nextval('public.reservations_cantine_id_seq') NOT NULL,
    eleve_id integer,
    menu_id integer,
    date date NOT NULL,
    statut character varying(20) DEFAULT 'confirmee'::character varying,
    paye boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.reserves_cantine (
    id integer DEFAULT nextval('public.reserves_cantine_id_seq') NOT NULL,
    eleve_id integer,
    date date NOT NULL,
    est_present boolean DEFAULT false,
    date_reservation date DEFAULT CURRENT_DATE
);

CREATE TABLE public.reset_tokens (
    id integer DEFAULT nextval('public.reset_tokens_id_seq') NOT NULL,
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    used boolean DEFAULT false
);

CREATE TABLE public.services_annexes (
    id integer DEFAULT nextval('public.services_annexes_id_seq') NOT NULL,
    nom character varying(100) NOT NULL,
    montant_mensuel integer NOT NULL,
    type character varying(50) DEFAULT 'optionnel'::character varying,
    description text,
    actif boolean DEFAULT true,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.sessions (
    id integer DEFAULT nextval('public.sessions_id_seq') NOT NULL,
    utilisateur_id integer,
    token character varying(255) NOT NULL,
    expire_le timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.soumissions_devoirs (
    id integer DEFAULT nextval('public.soumissions_devoirs_id_seq') NOT NULL,
    devoir_id integer,
    eleve_id integer,
    fichier_url text,
    date_soumission timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    note numeric(5,2),
    commentaire text,
    est_retard boolean DEFAULT false
);

CREATE TABLE public.transactions_cantine (
    id integer DEFAULT nextval('public.transactions_cantine_id_seq') NOT NULL,
    eleve_id integer,
    montant numeric(12,2) NOT NULL,
    type character varying(20),
    description text,
    date timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.utilisateurs (
    id integer DEFAULT nextval('public.utilisateurs_id_seq') NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    prenom character varying(100) NOT NULL,
    nom character varying(100) NOT NULL,
    telephone character varying(20),
    adresse text,
    photo_url text,
    role character varying(50) NOT NULL,
    est_actif boolean DEFAULT true,
    derniere_connexion timestamp(6) without time zone,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

CREATE TABLE public.ventes_librairie (
    id integer DEFAULT nextval('public.ventes_librairie_id_seq') NOT NULL,
    article_id integer,
    eleve_id integer,
    quantite integer DEFAULT 1 NOT NULL,
    montant_total integer NOT NULL,
    date_vente timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    vendu_par integer
);

-- ------------------------------------------------------------
-- Contraintes et index
-- ------------------------------------------------------------
-- Tables primaires
ALTER TABLE ONLY public._prisma_migrations ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.annees_scolaires ADD CONSTRAINT annees_scolaires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.annonces ADD CONSTRAINT annonces_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.articles_librairie ADD CONSTRAINT articles_librairie_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.avances_salaires ADD CONSTRAINT avances_salaires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.budget_previsionnel ADD CONSTRAINT budget_previsionnel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bus ADD CONSTRAINT bus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cantine_menus ADD CONSTRAINT cantine_menus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categories_depenses ADD CONSTRAINT categories_depenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categories_quiz ADD CONSTRAINT categories_quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commandes_fournitures ADD CONSTRAINT commandes_fournitures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commandes_librairie ADD CONSTRAINT commandes_librairie_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commandes_librairie_articles ADD CONSTRAINT commandes_librairie_articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conges_personnel ADD CONSTRAINT conges_personnel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contrats_personnel ADD CONSTRAINT contrats_personnel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.depenses ADD CONSTRAINT depenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.devoirs ADD CONSTRAINT devoirs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.echeances_paiement ADD CONSTRAINT echeances_paiement_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.eleves ADD CONSTRAINT eleves_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.emprunts_bibliotheque ADD CONSTRAINT emprunts_bibliotheque_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.enseignements ADD CONSTRAINT enseignements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.examens ADD CONSTRAINT examens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.examens_eleves ADD CONSTRAINT examens_eleves_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.frais_scolaires ADD CONSTRAINT frais_scolaires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inscriptions ADD CONSTRAINT inscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inscriptions_cantine ADD CONSTRAINT inscriptions_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inscriptions_transport ADD CONSTRAINT inscriptions_transport_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lecons ADD CONSTRAINT lecons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lien_parent_eleve ADD CONSTRAINT lien_parent_eleve_pkey PRIMARY KEY (parent_id, eleve_id);

ALTER TABLE ONLY public.lignes_transport ADD CONSTRAINT lignes_transport_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.livres_bibliotheque ADD CONSTRAINT livres_bibliotheque_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.logs_activites ADD CONSTRAINT logs_activites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.matieres ADD CONSTRAINT matieres_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.menus_cantine ADD CONSTRAINT menus_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mouvements_caisse ADD CONSTRAINT mouvements_caisse_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.options_qcm ADD CONSTRAINT options_qcm_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.options_quiz ADD CONSTRAINT options_quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.paiements ADD CONSTRAINT paiements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.paiements_salaires ADD CONSTRAINT paiements_salaires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.parents ADD CONSTRAINT parents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.participations_quiz ADD CONSTRAINT participations_quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.personnels ADD CONSTRAINT personnels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.preinscriptions ADD CONSTRAINT preinscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.preinscription_cantine ADD CONSTRAINT preinscription_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.preinscription_transport ADD CONSTRAINT preinscription_transport_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.presences ADD CONSTRAINT presences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.presences_transport ADD CONSTRAINT presences_transport_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.questions_qcm ADD CONSTRAINT questions_qcm_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.questions_quiz ADD CONSTRAINT questions_quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.quiz ADD CONSTRAINT quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.quiz_questions ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recus ADD CONSTRAINT recus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.remises_familles ADD CONSTRAINT remises_familles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reponses_eleves_qcm ADD CONSTRAINT reponses_eleves_qcm_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reponses_quiz ADD CONSTRAINT reponses_quiz_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reservations_cantine ADD CONSTRAINT reservations_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reserves_cantine ADD CONSTRAINT reserves_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reset_tokens ADD CONSTRAINT reset_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.services_annexes ADD CONSTRAINT services_annexes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.soumissions_devoirs ADD CONSTRAINT soumissions_devoirs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transactions_cantine ADD CONSTRAINT transactions_cantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.utilisateurs ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ventes_librairie ADD CONSTRAINT ventes_librairie_pkey PRIMARY KEY (id);

-- Uniques et checks
CREATE UNIQUE INDEX budget_previsionnel_annee_categorie_code_key ON public.budget_previsionnel (annee, categorie_code);
CREATE UNIQUE INDEX bus_immatriculation_key ON public.bus (immatriculation);
CREATE UNIQUE INDEX categories_depenses_code_key ON public.categories_depenses (code);
CREATE UNIQUE INDEX categories_quiz_nom_key ON public.categories_quiz (nom);
CREATE UNIQUE INDEX commandes_librairie_numero_commande_key ON public.commandes_librairie (numero_commande);
CREATE UNIQUE INDEX eleves_matricule_key ON public.eleves (matricule);
CREATE UNIQUE INDEX eleves_utilisateur_id_key ON public.eleves (utilisateur_id);
CREATE UNIQUE INDEX examens_eleves_examen_id_eleve_id_key ON public.examens_eleves (examen_id, eleve_id);
CREATE UNIQUE INDEX inscriptions_numero_matricule_key ON public.inscriptions (numero_matricule);
CREATE UNIQUE INDEX paiements_salaires_personnel_id_mois_annee_key ON public.paiements_salaires (personnel_id, mois, annee);
CREATE UNIQUE INDEX parents_utilisateur_id_key ON public.parents (utilisateur_id);
CREATE UNIQUE INDEX participations_quiz_quiz_id_eleve_id_key ON public.participations_quiz (quiz_id, eleve_id);
CREATE UNIQUE INDEX personnels_matricule_personnel_key ON public.personnels (matricule_personnel);
CREATE UNIQUE INDEX personnels_utilisateur_id_key ON public.personnels (utilisateur_id);
CREATE UNIQUE INDEX preinscriptions_numero_dossier_key ON public.preinscriptions (numero_dossier);
CREATE UNIQUE INDEX presences_transport_eleve_id_date_key ON public.presences_transport (eleve_id, date);
CREATE UNIQUE INDEX quiz_questions_quiz_id_question_id_key ON public.quiz_questions (quiz_id, question_id);
CREATE UNIQUE INDEX reinscriptions_numero_dossier_key ON public.reinscriptions (numero_dossier);
CREATE UNIQUE INDEX services_annexes_nom_key ON public.services_annexes (nom);
CREATE UNIQUE INDEX sessions_token_key ON public.sessions (token);
CREATE UNIQUE INDEX unique_email_token ON public.reset_tokens (email);
CREATE UNIQUE INDEX utilisateurs_email_key ON public.utilisateurs (email);
CREATE UNIQUE INDEX recus_numero_recu_key ON public.recus (numero_recu);

-- Index supplémentaires (performance)
CREATE INDEX idx_depenses_annee_mois ON public.depenses (exercice_annee, exercice_mois);
CREATE INDEX idx_depenses_categorie ON public.depenses (categorie);
CREATE INDEX idx_depenses_date ON public.depenses (date_depense);
CREATE INDEX idx_echeances_paiement_reinscription_id ON public.echeances_paiement (reinscription_id);
CREATE INDEX idx_eleves_classe ON public.eleves (classe_id);
CREATE INDEX idx_eleves_classe_id ON public.eleves (classe_id);
CREATE INDEX idx_eleves_matricule ON public.eleves (matricule);
CREATE INDEX idx_eleves_utilisateur_id ON public.eleves (utilisateur_id);
CREATE INDEX idx_emprunts_bibliotheque_eleve_id_statut ON public.emprunts_bibliotheque (eleve_id, statut);
CREATE INDEX idx_enseignements_classe ON public.enseignements (classe_id);
CREATE INDEX idx_enseignements_enseignant ON public.enseignements (enseignant_id);
CREATE INDEX idx_examens_eleves_eleve_id ON public.examens_eleves (eleve_id);
CREATE INDEX idx_examens_eleves_examen_id ON public.examens_eleves (examen_id);
CREATE INDEX idx_inscriptions_cantine_eleve_id_est_actif ON public.inscriptions_cantine (eleve_id, est_actif);
CREATE INDEX idx_inscriptions_eleve ON public.inscriptions (eleve_id);
CREATE INDEX idx_inscriptions_parent ON public.inscriptions (parent_id);
CREATE INDEX idx_inscriptions_transport_eleve_id_est_actif ON public.inscriptions_transport (eleve_id, est_actif);
CREATE INDEX idx_lien_parent_eleve_eleve_id ON public.lien_parent_eleve (eleve_id);
CREATE INDEX idx_lien_parent_eleve_parent_id ON public.lien_parent_eleve (parent_id);
CREATE INDEX idx_messages_destinataire ON public.messages (destinataire_id, est_lu);
CREATE INDEX idx_mouvements_caisse_annee_mois ON public.mouvements_caisse (exercice_annee, exercice_mois);
CREATE INDEX idx_mouvements_caisse_date ON public.mouvements_caisse (date_mouvement);
CREATE INDEX idx_mouvements_caisse_type ON public.mouvements_caisse (type);
CREATE INDEX idx_notes_eleve ON public.notes (eleve_id);
CREATE INDEX idx_paiements_date ON public.paiements (date_paiement);
CREATE INDEX idx_paiements_eleve ON public.paiements (eleve_id);
CREATE INDEX idx_paiements_eleve_id_type_frais_statut ON public.paiements (eleve_id, type_frais, statut);
CREATE INDEX idx_paiements_preinscription_id ON public.paiements (preinscription_id);
CREATE INDEX idx_paiements_salaires_mois_annee ON public.paiements_salaires (mois, annee);
CREATE INDEX idx_parents_utilisateur_id ON public.parents (utilisateur_id);
CREATE INDEX idx_preinscriptions_date ON public.preinscriptions (date_preinscription);
CREATE INDEX idx_preinscriptions_nom_enfant ON public.preinscriptions (enfant_nom, enfant_prenom);
CREATE INDEX idx_preinscriptions_numero_dossier ON public.preinscriptions (numero_dossier);
CREATE INDEX idx_preinscriptions_parent_id ON public.preinscriptions (parent_id);
CREATE INDEX idx_preinscriptions_statut ON public.preinscriptions (statut);
CREATE INDEX idx_presences_date ON public.presences (date);
CREATE INDEX idx_presences_transport_date ON public.presences_transport (date);
CREATE INDEX idx_presences_transport_eleve ON public.presences_transport (eleve_id);
CREATE INDEX idx_recus_date ON public.recus (date_paiement);
CREATE INDEX idx_recus_eleve ON public.recus (eleve_id);
CREATE INDEX idx_recus_numero ON public.recus (numero_recu);
CREATE INDEX idx_recus_paiement ON public.recus (paiement_id);
CREATE INDEX idx_reinscriptions_annee ON public.reinscriptions (annee_scolaire_id);
CREATE INDEX idx_reinscriptions_eleve ON public.reinscriptions (eleve_id);
CREATE INDEX idx_reinscriptions_statut ON public.reinscriptions (statut);
CREATE INDEX idx_reset_tokens_email ON public.reset_tokens (email);
CREATE INDEX idx_reset_tokens_token ON public.reset_tokens (token);

-- ------------------------------------------------------------
-- Clés étrangères
-- ------------------------------------------------------------
ALTER TABLE ONLY public.annonces ADD CONSTRAINT annonces_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);
ALTER TABLE ONLY public.annonces ADD CONSTRAINT annonces_publie_par_fkey FOREIGN KEY (publie_par) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.avances_salaires ADD CONSTRAINT avances_salaires_accorde_par_fkey FOREIGN KEY (accorde_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.avances_salaires ADD CONSTRAINT avances_salaires_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.budget_previsionnel ADD CONSTRAINT budget_previsionnel_categorie_code_fkey FOREIGN KEY (categorie_code) REFERENCES public.categories_depenses(code);
ALTER TABLE ONLY public.classes ADD CONSTRAINT classes_annee_scolaire_id_fkey FOREIGN KEY (annee_scolaire_id) REFERENCES public.annees_scolaires(id);
ALTER TABLE ONLY public.classes ADD CONSTRAINT classes_titulaire_id_fkey FOREIGN KEY (titulaire_id) REFERENCES public.personnels(id);
ALTER TABLE ONLY public.commandes_fournitures ADD CONSTRAINT commandes_fournitures_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles_librairie(id);
ALTER TABLE ONLY public.commandes_fournitures ADD CONSTRAINT commandes_fournitures_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.commandes_librairie_articles ADD CONSTRAINT commandes_librairie_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles_librairie(id);
ALTER TABLE ONLY public.commandes_librairie_articles ADD CONSTRAINT commandes_librairie_articles_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_librairie(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.commandes_librairie ADD CONSTRAINT commandes_librairie_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conges_personnel ADD CONSTRAINT conges_personnel_approuve_par_fkey FOREIGN KEY (approuve_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conges_personnel ADD CONSTRAINT conges_personnel_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contrats_personnel ADD CONSTRAINT contrats_personnel_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.depenses ADD CONSTRAINT depenses_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.depenses ADD CONSTRAINT depenses_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.devoirs ADD CONSTRAINT devoirs_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id);
ALTER TABLE ONLY public.echeances_paiement ADD CONSTRAINT echeances_paiement_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.echeances_paiement ADD CONSTRAINT echeances_paiement_reinscription_id_fkey FOREIGN KEY (reinscription_id) REFERENCES public.reinscriptions(id);
ALTER TABLE ONLY public.eleves ADD CONSTRAINT eleves_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);
ALTER TABLE ONLY public.eleves ADD CONSTRAINT eleves_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.emprunts_bibliotheque ADD CONSTRAINT emprunts_bibliotheque_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.emprunts_bibliotheque ADD CONSTRAINT emprunts_bibliotheque_livre_id_fkey FOREIGN KEY (livre_id) REFERENCES public.livres_bibliotheque(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.enseignements ADD CONSTRAINT enseignements_annee_scolaire_id_fkey FOREIGN KEY (annee_scolaire_id) REFERENCES public.annees_scolaires(id);
ALTER TABLE ONLY public.enseignements ADD CONSTRAINT enseignements_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);
ALTER TABLE ONLY public.enseignements ADD CONSTRAINT enseignements_enseignant_id_fkey FOREIGN KEY (enseignant_id) REFERENCES public.personnels(id);
ALTER TABLE ONLY public.enseignements ADD CONSTRAINT enseignements_matiere_id_fkey FOREIGN KEY (matiere_id) REFERENCES public.matieres(id);
ALTER TABLE ONLY public.examens_eleves ADD CONSTRAINT examens_eleves_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.examens_eleves ADD CONSTRAINT examens_eleves_examen_id_fkey FOREIGN KEY (examen_id) REFERENCES public.examens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.examens ADD CONSTRAINT examens_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id);
ALTER TABLE ONLY public.frais_scolaires ADD CONSTRAINT frais_scolaires_annee_scolaire_id_fkey FOREIGN KEY (annee_scolaire_id) REFERENCES public.annees_scolaires(id);
ALTER TABLE ONLY public.inscriptions ADD CONSTRAINT inscriptions_annee_scolaire_id_fkey FOREIGN KEY (annee_scolaire_id) REFERENCES public.annees_scolaires(id);
ALTER TABLE ONLY public.inscriptions_cantine ADD CONSTRAINT inscriptions_cantine_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inscriptions ADD CONSTRAINT inscriptions_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inscriptions ADD CONSTRAINT inscriptions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inscriptions ADD CONSTRAINT inscriptions_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inscriptions_transport ADD CONSTRAINT inscriptions_transport_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inscriptions_transport ADD CONSTRAINT inscriptions_transport_ligne_id_fkey FOREIGN KEY (ligne_id) REFERENCES public.lignes_transport(id);
ALTER TABLE ONLY public.lecons ADD CONSTRAINT lecons_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id);
ALTER TABLE ONLY public.lien_parent_eleve ADD CONSTRAINT lien_parent_eleve_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lien_parent_eleve ADD CONSTRAINT lien_parent_eleve_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lignes_transport ADD CONSTRAINT lignes_transport_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.bus(id);
ALTER TABLE ONLY public.logs_activites ADD CONSTRAINT logs_activites_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_destinataire_id_fkey FOREIGN KEY (destinataire_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_expediteur_id_fkey FOREIGN KEY (expediteur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.mouvements_caisse ADD CONSTRAINT mouvements_caisse_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.mouvements_caisse ADD CONSTRAINT mouvements_caisse_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_enseignant_id_fkey FOREIGN KEY (enseignant_id) REFERENCES public.personnels(id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id);
ALTER TABLE ONLY public.options_qcm ADD CONSTRAINT options_qcm_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_qcm(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.options_quiz ADD CONSTRAINT options_quiz_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.paiements ADD CONSTRAINT paiements_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.paiements ADD CONSTRAINT paiements_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id);
ALTER TABLE ONLY public.paiements ADD CONSTRAINT paiements_reinscription_id_fkey FOREIGN KEY (reinscription_id) REFERENCES public.reinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.paiements ADD CONSTRAINT paiements_saisie_par_fkey FOREIGN KEY (saisie_par) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.paiements_salaires ADD CONSTRAINT paiements_salaires_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.paiements_salaires ADD CONSTRAINT paiements_salaires_saisie_par_fkey FOREIGN KEY (saisie_par) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.parents ADD CONSTRAINT parents_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.participations_quiz ADD CONSTRAINT participations_quiz_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.participations_quiz ADD CONSTRAINT participations_quiz_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.personnels ADD CONSTRAINT personnels_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.preinscription_cantine ADD CONSTRAINT preinscription_cantine_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.cantine_menus(id);
ALTER TABLE ONLY public.preinscription_cantine ADD CONSTRAINT preinscription_cantine_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.preinscription_transport ADD CONSTRAINT preinscription_transport_ligne_id_fkey FOREIGN KEY (ligne_id) REFERENCES public.lignes_transport(id);
ALTER TABLE ONLY public.preinscription_transport ADD CONSTRAINT preinscription_transport_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.preinscriptions ADD CONSTRAINT preinscriptions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.preinscriptions ADD CONSTRAINT preinscriptions_traite_par_fkey FOREIGN KEY (traite_par) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.presences ADD CONSTRAINT presences_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);
ALTER TABLE ONLY public.presences ADD CONSTRAINT presences_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.presences ADD CONSTRAINT presences_enseignant_id_fkey FOREIGN KEY (enseignant_id) REFERENCES public.personnels(id);
ALTER TABLE ONLY public.presences_transport ADD CONSTRAINT presences_transport_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.questions_qcm ADD CONSTRAINT questions_qcm_examen_id_fkey FOREIGN KEY (examen_id) REFERENCES public.examens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.questions_quiz ADD CONSTRAINT questions_quiz_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES public.categories_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.questions_quiz ADD CONSTRAINT questions_quiz_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.utilisateurs(id);
ALTER TABLE ONLY public.questions_quiz ADD CONSTRAINT questions_quiz_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.quiz ADD CONSTRAINT quiz_enseignement_id_fkey FOREIGN KEY (enseignement_id) REFERENCES public.enseignements(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.quiz_questions ADD CONSTRAINT quiz_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.quiz_questions ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recus ADD CONSTRAINT recus_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recus ADD CONSTRAINT recus_paiement_id_fkey FOREIGN KEY (paiement_id) REFERENCES public.paiements(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recus ADD CONSTRAINT recus_preinscription_id_fkey FOREIGN KEY (preinscription_id) REFERENCES public.preinscriptions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.recus ADD CONSTRAINT recus_reinscription_id_fkey FOREIGN KEY (reinscription_id) REFERENCES public.reinscriptions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_annee_scolaire_id_fkey FOREIGN KEY (annee_scolaire_id) REFERENCES public.annees_scolaires(id);
ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);
ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.inscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reinscriptions ADD CONSTRAINT reinscriptions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.remises_familles ADD CONSTRAINT remises_familles_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reponses_eleves_qcm ADD CONSTRAINT reponses_eleves_qcm_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reponses_eleves_qcm ADD CONSTRAINT reponses_eleves_qcm_examen_id_fkey FOREIGN KEY (examen_id) REFERENCES public.examens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reponses_eleves_qcm ADD CONSTRAINT reponses_eleves_qcm_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options_qcm(id);
ALTER TABLE ONLY public.reponses_eleves_qcm ADD CONSTRAINT reponses_eleves_qcm_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_qcm(id);
ALTER TABLE ONLY public.reponses_quiz ADD CONSTRAINT reponses_quiz_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reponses_quiz ADD CONSTRAINT reponses_quiz_participation_id_fkey FOREIGN KEY (participation_id) REFERENCES public.participations_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reponses_quiz ADD CONSTRAINT reponses_quiz_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_quiz(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reservations_cantine ADD CONSTRAINT reservations_cantine_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reservations_cantine ADD CONSTRAINT reservations_cantine_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus_cantine(id);
ALTER TABLE ONLY public.reserves_cantine ADD CONSTRAINT reserves_cantine_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sessions ADD CONSTRAINT sessions_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.soumissions_devoirs ADD CONSTRAINT soumissions_devoirs_devoir_id_fkey FOREIGN KEY (devoir_id) REFERENCES public.devoirs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.soumissions_devoirs ADD CONSTRAINT soumissions_devoirs_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transactions_cantine ADD CONSTRAINT transactions_cantine_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ventes_librairie ADD CONSTRAINT ventes_librairie_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles_librairie(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ventes_librairie ADD CONSTRAINT ventes_librairie_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves(id);
ALTER TABLE ONLY public.ventes_librairie ADD CONSTRAINT ventes_librairie_vendu_par_fkey FOREIGN KEY (vendu_par) REFERENCES public.utilisateurs(id);

-- ============================================
-- CRÉATION ADMIN
-- ============================================

-- Mot de passe hashé pour 'admin123'
INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'admin@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Super', 'Admin', 'SUPER_ADMIN', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'admin@eief.com');

-- ============================================
-- CRÉATION PARENT TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'parent@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Jean', 'Parent', 'PARENT', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'parent@eief.com');

-- ============================================
-- CRÉATION ÉLÈVE TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'eleve@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Marie', 'Eleve', 'ELEVE', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'eleve@eief.com');

-- ============================================
-- CRÉATION ENSEIGNANT TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'professeur@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Pierre', 'Enseignant', 'ENSEIGNANT', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'professeur@eief.com');;

-- ============================================
-- CRÉATION COMPTABLE TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'comptable@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Claire', 'Comptable', 'COMPTABLE', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'comptable@eief.com');

-- ============================================
-- CRÉATION DIRECTEUR TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'directeur@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Paul', 'Directeur', 'DIRECTEUR_GENERAL', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'directeur@eief.com');

-- ============================================
-- CRÉATION CHAUFFEUR TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'transport@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Amadou', 'Camara', 'ADMIN_TRANSPORT', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'transport@eief.com');

-- ============================================
-- CRÉATION CANTINE TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'cantine@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Aissatou', 'Kane', 'ADMIN_CANTINE', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'cantine@eief.com');


-- ============================================
-- CRÉATION LIBRAIRIE TEST

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'librairie@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Fatou', 'Diop', 'ADMIN_LIBRAIRIE', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'librairie@eief.com');

-- ============================================
-- CREATION BIBLIOTHECAIRE TEST
-- ============================================

INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif)
SELECT 'bibliotheque@eief.com', 
       '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
       'Mamadou', 'Diallo', 'ADMIN_BIBLIOTHEQUE', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'bibliotheque@eief.com');
-- ============================================
-- AFFICHAGE DES UTILISATEURS CRÉÉS
-- ============================================

SELECT id, email, nom, prenom, role FROM utilisateurs;

-- ============================================
-- FIN DU SCRIPT
-- ============================================