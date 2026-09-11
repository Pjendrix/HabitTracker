/**
 * Načte HABIT_TRACKER_2026.xlsx a vyrobí z něj data pro Firestore.
 *
 *   node scripts/import-xlsx.mjs ../HABIT_TRACKER_2026.xlsx          → seed.json
 *   node scripts/import-xlsx.mjs ../HABIT_TRACKER_2026.xlsx --upload --uid=UID
 *
 * Upload potřebuje serviceAccount.json z Firebase console
 * (Project settings → Service accounts → Generate new private key)
 * a balík firebase-admin: npm i -D firebase-admin
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Použití: node scripts/import-xlsx.mjs <soubor.xlsx> [--upload --uid=UID]');
  process.exit(1);
}
const uid = flags.find((f) => f.startsWith('--uid='))?.slice(6);
const upload = flags.includes('--upload');

const MONTHS = {
  leden: 1, ledna: 1, january: 1, jan: 1,
  unor: 2, únor: 2, february: 2, feb: 2,
  brezen: 3, březen: 3, march: 3, mar: 3,
  duben: 4, april: 4, apr: 4,
  kveten: 5, květen: 5, may: 5,
  cerven: 6, červen: 6, june: 6, jun: 6,
  cervenec: 7, červenec: 7, july: 7, jul: 7,
  srpen: 8, august: 8, aug: 8,
  zari: 9, září: 9, september: 9, sep: 9,
  rijen: 10, říjen: 10, october: 10, oct: 10,
  listopad: 11, november: 11, nov: 11,
  prosinec: 12, december: 12, dec: 12,
};

/** "Kveten_25" → { year: 2025, month: 5 } */
function parseSheetName(name) {
  const m = /^([\p{L}]+)_(\d{2})$/u.exec(name.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return { year: 2000 + Number(m[2]), month };
}

const wb = XLSX.readFile(file, { cellDates: true });
const at = (sheet, letter, row) => sheet[`${letter}${row}`]?.v;

/** Najde popisek a vrátí hodnotu o řádek níž (tak to máš v listech). */
function labelValue(sheet, label) {
  for (const ref of Object.keys(sheet)) {
    if (ref[0] === '!') continue;
    if (String(sheet[ref].v).trim().toLowerCase() === label.toLowerCase()) {
      const col = ref.match(/[A-Z]+/)[0];
      const row = Number(ref.match(/\d+/)[0]);
      const below = sheet[`${col}${row + 1}`]?.v;
      if (typeof below === 'number') return below;
    }
  }
  return null;
}

const days = {};
const months = {};
let sheetsRead = 0;

for (const name of wb.SheetNames) {
  const parsed = parseSheetName(name);
  if (!parsed) continue;
  const sheet = wb.Sheets[name];
  const { year, month } = parsed;
  const mKey = `${year}-${String(month).padStart(2, '0')}`;

  // Podle hlavičky G3 poznáme éru: "Food & Drink" = EUR, "Jídlo & Pití" = všechno v CZK.
  const header = String(at(sheet, 'G', 3) ?? '');
  const eurEra = /food/i.test(header);
  const fx = labelValue(sheet, 'Kurz EUR') ?? 25;

  months[mKey] = {
    fx,
    income: { salary: 0, extraEur: 0, extraCzk: 0 },
    importedFrom: name,
  };

  const CATS = [
    ['G', 'food'], ['H', 'social'], ['I', 'things'], ['J', 'others'], ['L', 'work'],
  ];

  for (let row = 4; row <= 40; row++) {
    const dayNum = at(sheet, 'B', row);
    if (typeof dayNum !== 'number' || dayNum < 1 || dayNum > 31) continue;
    const key = `${mKey}-${String(dayNum).padStart(2, '0')}`;
    const note = [at(sheet, 'W', row), at(sheet, 'Y', row)].filter((v) => typeof v === 'string' && v.trim()).join(' ');

    const tx = [];
    for (const [letter, cat] of CATS) {
      const v = at(sheet, letter, row);
      if (typeof v === 'number' && v !== 0) {
        tx.push({ id: `${key}-${cat}`, amount: Number(v.toFixed(2)), cur: eurEra ? 'EUR' : 'CZK', cat, note });
      }
    }
    const czk = at(sheet, 'K', row);
    if (typeof czk === 'number' && czk !== 0 && eurEra) {
      tx.push({ id: `${key}-czk`, amount: Number(czk.toFixed(2)), cur: 'CZK', cat: 'others', note });
    }

    // Sloupce se mezi érami posunuly: do 2024 byl sport v P a v N bylo "OK food",
    // od 2025 je sport v N a P–R drží KCAL / SUPP / C.
    const habitMap = eurEra
      ? { N: 'sports', P: 'kcal', Q: 'supp', R: 'clean' }
      : { N: 'okfood', P: 'sports', Q: 'limo' };

    const habits = {};
    for (const [letter, id] of Object.entries(habitMap)) {
      if (at(sheet, letter, row) === 1) habits[id] = true;
    }

    const weight = at(sheet, 'T', row);
    const record = { tx, habits, importedFrom: name };
    if (typeof weight === 'number' && weight > 30) record.weight = weight;
    if (tx.length || Object.keys(habits).length || record.weight) days[key] = record;
  }
  sheetsRead++;
}

console.log(`Načteno listů: ${sheetsRead}, dní: ${Object.keys(days).length}, měsíců: ${Object.keys(months).length}`);

if (!upload) {
  const out = path.resolve('seed.json');
  fs.writeFileSync(out, JSON.stringify({ days, months }, null, 2));
  console.log(`Zapsáno do ${out}. Pro nahrání spusť znovu s --upload --uid=TVOJE_UID.`);
  process.exit(0);
}

if (!uid) {
  console.error('--upload vyžaduje --uid=UID (najdeš v Firebase console → Authentication).');
  process.exit(1);
}

const admin = await import('firebase-admin');
const cred = JSON.parse(fs.readFileSync('serviceAccount.json', 'utf8'));
admin.default.initializeApp({ credential: admin.default.credential.cert(cred) });
const db = admin.default.firestore();

let written = 0;
let batch = db.batch();
const flush = async () => { await batch.commit(); batch = db.batch(); };

for (const [key, value] of Object.entries(days)) {
  batch.set(db.doc(`users/${uid}/days/${key}`), value, { merge: true });
  if (++written % 400 === 0) await flush();
}
for (const [key, value] of Object.entries(months)) {
  batch.set(db.doc(`users/${uid}/months/${key}`), value, { merge: true });
  if (++written % 400 === 0) await flush();
}
await flush();
console.log(`Nahráno ${written} dokumentů.`);
