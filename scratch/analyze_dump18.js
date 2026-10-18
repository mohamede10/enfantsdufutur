const fs = require('fs');
const readline = require('readline');

const filename = 'backup_database-eief-18-10-2026-00H-27.sql';

// Detect encoding
const fd = fs.openSync(filename, 'r');
const bom = Buffer.alloc(4);
fs.readSync(fd, bom, 0, 4, 0);
fs.closeSync(fd);

let enc = 'utf8';
if (bom[0] === 0xFF && bom[1] === 0xFE) enc = 'utf16le';
else if (bom[0] === 0xFE && bom[1] === 0xFF) enc = 'utf16be';
console.log('Encoding detected:', enc);

const rl = readline.createInterface({
  input: fs.createReadStream(filename, { encoding: enc }),
  crlfDelay: Infinity
});

const tables = {};
let currentTable = null;
let inCopy = false;

// Track paiements details
const paiements = [];
const echeances = [];
const inscriptions = [];
const eleves = [];
const parents_data = [];

rl.on('line', (line) => {
  const copyMatch = line.match(/^COPY public\.(\w+)\s*\(([^)]+)\)/i);
  if (copyMatch) {
    currentTable = copyMatch[1];
    tables[currentTable] = { cols: copyMatch[2].split(',').map(c=>c.trim()), rows: 0 };
    inCopy = true;
    return;
  }
  if (line === '\\.' || line.trim() === '\\.') {
    inCopy = false;
    currentTable = null;
    return;
  }
  if (inCopy && currentTable) {
    tables[currentTable].rows++;
    const cols = tables[currentTable].cols;
    const vals = line.split('\t');
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });

    if (currentTable === 'paiements') {
      paiements.push(row);
    } else if (currentTable === 'echeances') {
      echeances.push(row);
    } else if (currentTable === 'inscriptions') {
      inscriptions.push(row);
    } else if (currentTable === 'eleves') {
      eleves.push(row);
    } else if (currentTable === 'parents') {
      parents_data.push(row);
    }
  }
});

rl.on('close', () => {
  console.log('\n=== TABLES ET NOMBRE DE LIGNES ===');
  for (const [t, info] of Object.entries(tables)) {
    if (info.rows > 0) console.log(`  ${t}: ${info.rows} lignes`);
  }

  console.log('\n=== PAIEMENTS (' + paiements.length + ') ===');
  console.log('Colonnes:', tables['paiements']?.cols?.join(', '));

  // Group paiements by statut
  const byStatut = {};
  let total = 0;
  paiements.forEach(p => {
    const s = p.statut || 'unknown';
    byStatut[s] = (byStatut[s] || 0) + 1;
    if (s === 'valide' || s === 'paye') {
      total += parseFloat(p.montant || 0);
    }
  });
  console.log('Par statut:', byStatut);
  console.log('Total validé/payé:', total.toLocaleString('fr-FR'), 'GNF');

  // Group by type_paiement
  const byType = {};
  const totalByType = {};
  paiements.forEach(p => {
    const t = p.type_paiement || p.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
    if (p.statut === 'valide' || p.statut === 'paye') {
      totalByType[t] = (totalByType[t] || 0) + parseFloat(p.montant || 0);
    }
  });
  console.log('\nPar type_paiement:', byType);
  console.log('Total par type (validé):', totalByType);

  // Sample first 5 paiements
  console.log('\nExemple de paiements (5 premiers):');
  paiements.slice(0, 5).forEach(p => console.log(' ', JSON.stringify(p)));

  console.log('\n=== ECHEANCES (' + echeances.length + ') ===');
  console.log('Colonnes:', tables['echeances']?.cols?.join(', '));

  const echByStatut = {};
  let totalDu = 0, totalPaye = 0;
  echeances.forEach(e => {
    const s = e.statut || 'unknown';
    echByStatut[s] = (echByStatut[s] || 0) + 1;
    totalDu += parseFloat(e.montant || 0);
    if (s === 'paye' || s === 'valide') totalPaye += parseFloat(e.montant || 0);
  });
  console.log('Par statut:', echByStatut);
  console.log('Total montant dû:', totalDu.toLocaleString('fr-FR'), 'GNF');
  console.log('Total payé:', totalPaye.toLocaleString('fr-FR'), 'GNF');

  // Sample first 5 echeances
  console.log('\nExemple d\'échéances (5 premiers):');
  echeances.slice(0, 5).forEach(e => console.log(' ', JSON.stringify(e)));

  console.log('\n=== INSCRIPTIONS (' + inscriptions.length + ') ===');
  console.log('Colonnes:', tables['inscriptions']?.cols?.join(', '));
  
  // Check inscription amounts
  const insByStatut = {};
  let totalFrais = 0;
  inscriptions.forEach(i => {
    const s = i.statut || 'unknown';
    insByStatut[s] = (insByStatut[s] || 0) + 1;
    totalFrais += parseFloat(i.frais_inscription || 0);
  });
  console.log('Par statut:', insByStatut);
  console.log('Total frais inscription:', totalFrais.toLocaleString('fr-FR'), 'GNF');

  // Sample first 3 inscriptions
  console.log('\nExemple d\'inscriptions (3 premiers):');
  inscriptions.slice(0, 3).forEach(i => console.log(' ', JSON.stringify(i)));

  console.log('\n=== ELEVES (' + eleves.length + ') ===');
  console.log('Sample colonnes:', tables['eleves']?.cols?.slice(0,10)?.join(', '));
  
  console.log('\n=== PARENTS (' + parents_data.length + ') ===');
  
  // Detect paiements_globaux table
  if (tables['paiements_globaux']) {
    console.log('\n=== PAIEMENTS_GLOBAUX (' + tables['paiements_globaux'].rows + ') ===');
  }
  
  // Check all payment-related tables
  const paymentTables = Object.keys(tables).filter(t => 
    t.includes('paie') || t.includes('frais') || t.includes('ech') || t.includes('scol')
  );
  console.log('\nToutes les tables liées aux paiements:', paymentTables);
});
