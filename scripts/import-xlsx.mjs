/**
 * Import historie z příkazové řádky. Běžně ho nepotřebuješ —
 * v appce je Nastavení → Import z Excelu, které dělá totéž bez instalace čehokoliv.
 * Tohle je pro případ, že chceš data jen zkontrolovat, nebo nahrát hromadně mimo prohlížeč.
 *
 *   node scripts/import-xlsx.mjs ../HABIT_TRACKER_2026.xlsx           → seed.json
 *   node scripts/import-xlsx.mjs ../HABIT_TRACKER_2026.xlsx --upload --uid=UID
 *
 * Upload potřebuje `npm i -D firebase-admin` a serviceAccount.json v kořeni projektu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkbook } from '../src/lib/importXlsx.js';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Použití: node scripts/import-xlsx.mjs <soubor.xlsx> [--upload --uid=UID]');
  process.exit(1);
}
const uid = flags.find((f) => f.startsWith('--uid='))?.slice(6);
const upload = flags.includes('--upload');

const { days, months, sheets } = await parseWorkbook(fs.readFileSync(file));
console.log(`Načteno listů: ${sheets}, dní: ${Object.keys(days).length}, měsíců: ${Object.keys(months).length}`);

if (!upload) {
  const out = path.resolve('seed.json');
  fs.writeFileSync(out, JSON.stringify({ days, months }, null, 2));
  console.log(`Zapsáno do ${out}. Pro nahrání spusť znovu s --upload --uid=TVOJE_UID.`);
  process.exit(0);
}

if (!uid) {
  console.error('--upload vyžaduje --uid=UID (Firebase console → Authentication → Users).');
  process.exit(1);
}

const admin = await import('firebase-admin');
admin.default.initializeApp({
  credential: admin.default.credential.cert(JSON.parse(fs.readFileSync('serviceAccount.json', 'utf8'))),
});
const db = admin.default.firestore();

let written = 0;
let batch = db.batch();
const flush = async () => { await batch.commit(); batch = db.batch(); };

for (const [coll, records] of [['days', days], ['months', months]]) {
  for (const [key, value] of Object.entries(records)) {
    batch.set(db.doc(`users/${uid}/${coll}/${key}`), value, { merge: true });
    if (++written % 400 === 0) await flush();
  }
}
await flush();
console.log(`Nahráno ${written} dokumentů.`);
