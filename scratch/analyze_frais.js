const fs = require('fs');
const readline = require('readline');

const filename = 'backup_database-eief-18-10-2026-00H-27.sql';

const fd = fs.openSync(filename, 'r');
const bom = Buffer.alloc(4);
fs.readSync(fd, bom, 0, 4, 0);
fs.closeSync(fd);
let enc = bom[0] === 0xFF && bom[1] === 0xFE ? 'utf16le' : 'utf8';

const rl = readline.createInterface({
  input: fs.createReadStream(filename, { encoding: enc }),
  crlfDelay: Infinity
});

const tables = {};
let currentTable = null;
let inCopy = false;
const allRows = {};

// Tables to capture in detail
const captureTables = ['echeances_paiement', 'frais_scolaires', 'paiements', 'preinscriptions', 'classes', 'annees_scolaires'];

rl.on('line', (line) => {
  const copyMatch = line.match(/^COPY public\.(\w+)\s*\(([^)]+)\)/i);
  if (copyMatch) {
    currentTable = copyMatch[1];
    tables[currentTable] = { cols: copyMatch[2].split(',').map(c=>c.trim().replace(/"/g, '')), rows: 0 };
    inCopy = true;
    if (captureTables.includes(currentTable)) allRows[currentTable] = [];
    return;
  }
  if (line === '\\.' || line.trim() === '\\.') {
    inCopy = false;
    currentTable = null;
    return;
  }
  if (inCopy && currentTable) {
    tables[currentTable].rows++;
    if (captureTables.includes(currentTable)) {
      const cols = tables[currentTable].cols;
      const vals = line.split('\t');
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      allRows[currentTable].push(row);
    }
  }
});

rl.on('close', () => {
  // frais_scolaires
  console.log('\n=== FRAIS_SCOLAIRES ===');
  console.log('Colonnes:', tables['frais_scolaires']?.cols?.join(', '));
  console.log('Lignes:', tables['frais_scolaires']?.rows);
  (allRows['frais_scolaires'] || []).forEach(r => console.log(' ', JSON.stringify(r)));

  // echeances_paiement
  console.log('\n=== ECHEANCES_PAIEMENT ===');
  console.log('Colonnes:', tables['echeances_paiement']?.cols?.join(', '));
  console.log('Lignes:', tables['echeances_paiement']?.rows);
  (allRows['echeances_paiement'] || []).forEach(r => console.log(' ', JSON.stringify(r)));

  // paiements details
  console.log('\n=== PAIEMENTS ===');
  console.log('Colonnes:', tables['paiements']?.cols?.join(', '));
  (allRows['paiements'] || []).forEach(r => console.log(' ', JSON.stringify(r)));

  // preinscriptions
  console.log('\n=== PREINSCRIPTIONS ===');
  console.log('Colonnes:', tables['preinscriptions']?.cols?.join(', '));
  console.log('Lignes:', tables['preinscriptions']?.rows);
  (allRows['preinscriptions'] || []).slice(0,3).forEach(r => console.log(' ', JSON.stringify(r)));

  // annees_scolaires
  console.log('\n=== ANNEES_SCOLAIRES ===');
  (allRows['annees_scolaires'] || []).forEach(r => console.log(' ', JSON.stringify(r)));

  // classes - show distribution
  console.log('\n=== CLASSES (distribution) ===');
  const classesByNiveau = {};
  (allRows['classes'] || []).forEach(c => {
    const n = c.niveau || c.type || 'autre';
    classesByNiveau[n] = (classesByNiveau[n] || 0) + 1;
  });
  console.log(classesByNiveau);
  console.log('Sample classe cols:', tables['classes']?.cols?.join(', '));
  (allRows['classes'] || []).slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)));
});
