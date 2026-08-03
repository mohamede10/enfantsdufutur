const { Client } = require('pg');
require('dotenv').config();

async function init() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
  });
  await client.connect();
  
  try {
    console.log("Checking ENUM type...");
    try {
      await client.query(`ALTER TYPE public.role_utilisateur ADD VALUE IF NOT EXISTS 'DIRECTEUR_ETUDES'`);
      console.log("Enum ALTERED successfully or already existed.");
    } catch (e) {
      console.log("Enum alter failed: ", e.message);
    }

    console.log("Creating user...");
    const result = await client.query(`
      INSERT INTO utilisateurs (email, password, prenom, nom, role, est_actif, created_at, updated_at)
      VALUES (
        'directeuretudes@eief.com',
        '$2b$10$Cl.LbpccIdc1.rBfxmuvGuhrvsgOasr/kus9dyvifHCojG8ZiPR72',
        'Directeur',
        'Etudes',
        'DIRECTEUR_ETUDES',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET role = 'DIRECTEUR_ETUDES'
      RETURNING id, email, role;
    `);
    
    console.log("User created or updated: ", result.rows[0]);
    
    const user = result.rows[0];
    const checkPersonnel = await client.query(`SELECT id FROM personnels WHERE utilisateur_id = $1`, [user.id]);
    if (checkPersonnel.rows.length === 0) {
        await client.query(`
            INSERT INTO personnels (utilisateur_id, matricule_personnel, type, statut, date_embauche)
            VALUES ($1, $2, $3, 'actif', NOW())
        `, [user.id, 'DIR_ETU_01', 'Directeur des Etudes']);
        console.log("Personnel entry created.");
    }

  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}
init();
