// Parser HABIT_TRACKER_*.xlsx. Používá ho tlačítko Import v Nastavení
// i příkazový skript scripts/import-xlsx.mjs — logika je jen na jednom místě.

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
  return month ? { year: 2000 + Number(m[2]), month } : null;
}

const at = (sheet, letter, row) => sheet[`${letter}${row}`]?.v;

/** Najde popisek v listu a vrátí číslo o řádek níž. */
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

const CATS = [['G', 'food'], ['H', 'social'], ['I', 'things'], ['J', 'others'], ['L', 'work']];

/** Roční souhrny drží výplatu (M) a extra příjmy (N, O) — v měsíčních listech nejsou. */
function readIncome(wb, months) {
  for (const name of wb.SheetNames) {
    const m = /^(\d{4}) summary$/.exec(name.trim());
    if (!m) continue;
    const sheet = wb.Sheets[name];
    const year = Number(m[1]);
    for (let row = 4; row <= 15; row++) {
      const mKey = `${year}-${String(row - 3).padStart(2, '0')}`;
      if (!months[mKey]) continue;
      const salary = at(sheet, 'M', row);
      const extraEur = at(sheet, 'N', row);
      const extraCzk = at(sheet, 'O', row);
      months[mKey].income = {
        salary: typeof salary === 'number' ? Number(salary.toFixed(2)) : 0,
        extraEur: typeof extraEur === 'number' ? Number(extraEur.toFixed(2)) : 0,
        extraCzk: typeof extraCzk === 'number' ? Number(extraCzk.toFixed(2)) : 0,
      };
    }
  }
}

/**
 * @param {ArrayBuffer|Uint8Array} data obsah sešitu
 * @returns {{days: object, months: object, sheets: number}}
 */
export async function parseWorkbook(data) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });

  const days = {};
  const months = {};
  let sheets = 0;

  for (const name of wb.SheetNames) {
    const parsed = parseSheetName(name);
    if (!parsed) continue;
    const sheet = wb.Sheets[name];
    const { year, month } = parsed;
    const mKey = `${year}-${String(month).padStart(2, '0')}`;

    // Hlavička G3 prozradí éru: "Food & Drink" = částky v EUR, "Jídlo & Pití" = v CZK.
    const eurEra = /food/i.test(String(at(sheet, 'G', 3) ?? ''));
    months[mKey] = {
      fx: labelValue(sheet, 'Kurz EUR') ?? 25,
      income: { salary: 0, extraEur: 0, extraCzk: 0 },
      importedFrom: name,
    };

    // Sport se mezi érami přesunul ze sloupce P do N.
    const habitMap = eurEra
      ? { N: 'sports', P: 'kcal', Q: 'supp', R: 'clean' }
      : { N: 'okfood', P: 'sports', Q: 'limo' };

    for (let row = 4; row <= 40; row++) {
      const dayNum = at(sheet, 'B', row);
      if (typeof dayNum !== 'number' || dayNum < 1 || dayNum > 31) continue;
      const key = `${mKey}-${String(dayNum).padStart(2, '0')}`;
      const note = [at(sheet, 'W', row), at(sheet, 'Y', row)]
        .filter((v) => typeof v === 'string' && v.trim())
        .join(' ');

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

      const habits = {};
      for (const [letter, id] of Object.entries(habitMap)) {
        if (at(sheet, letter, row) === 1) habits[id] = true;
      }

      const weight = at(sheet, 'T', row);
      const record = { tx, habits, importedFrom: name };
      if (typeof weight === 'number' && weight > 30) record.weight = weight;
      if (tx.length || Object.keys(habits).length || record.weight) days[key] = record;
    }
    sheets++;
  }

  readIncome(wb, months);
  return { days, months, sheets };
}
