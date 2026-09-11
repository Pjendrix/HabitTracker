import { daysInMonth, dayKey, DAYS_CS, MONTHS_CS, toEur } from './model';

// Vytvoří list ve stejném rozvržení jako měsíční záložky v HABIT_TRACKER:
// B = datum, C = den, E = CHECK, G–L = kategorie, N = sport, P–R = návyky,
// T = váha, W = poznámka. Vloží se do sešitu jako nová záložka.
export async function exportMonthXlsx({ mKey, days, month, settings, fx }) {
  const XLSX = await import('xlsx'); // ~800 kB, načte se až při exportu
  const [year, m] = mKey.split('-').map(Number);
  const count = daysInMonth(mKey);
  const cats = settings.categories.map((c) => c.id);
  const habits = settings.habits.map((h) => h.id);

  const col = (letter) => letter.charCodeAt(0) - 65;
  const rows = [];
  const put = (r, letter, v) => {
    rows[r] = rows[r] ?? [];
    rows[r][col(letter)] = v;
  };

  put(1, 'B', 'Date'); put(1, 'C', 'Day'); put(1, 'E', 'CHECK');
  put(1, 'G', 'Money'); put(1, 'N', 'SPORTS'); put(1, 'P', 'HABITS'); put(1, 'T', 'NUM');

  const catLetters = ['G', 'H', 'I', 'J'];
  settings.categories.slice(0, 4).forEach((c, i) => put(2, catLetters[i], c.label));
  put(2, 'K', 'CZK');
  put(2, 'L', settings.categories[4]?.label ?? 'Work');
  habits.slice(0, 3).forEach((h, i) => put(2, ['P', 'Q', 'R'][i], settings.habits[i].label));

  for (let d = 1; d <= count; d++) {
    const r = 2 + d;
    const key = dayKey(new Date(year, m - 1, d));
    const day = days[key] ?? {};
    const tx = day.tx ?? [];

    put(r, 'B', d);
    put(r, 'C', DAYS_CS[new Date(year, m - 1, d).getDay()]);

    // EUR výdaje po kategoriích, CZK zvlášť do sloupce K — jak to máš v listech.
    settings.categories.slice(0, 4).forEach((c, i) => {
      const sum = tx.filter((t) => t.cat === c.id && t.cur === 'EUR').reduce((s, t) => s + t.amount, 0);
      put(r, catLetters[i], Number(sum.toFixed(2)));
    });
    const czk = tx.filter((t) => t.cur === 'CZK').reduce((s, t) => s + t.amount, 0);
    put(r, 'K', Number(czk.toFixed(2)));
    const work = tx.filter((t) => t.cat === (cats[4] ?? 'work') && t.cur === 'EUR').reduce((s, t) => s + t.amount, 0);
    put(r, 'L', Number(work.toFixed(2)));

    put(r, 'N', day.habits?.[habits[0]] ? 1 : 0);
    habits.slice(1, 4).forEach((h, i) => put(r, ['P', 'Q', 'R'][i], day.habits?.[h] ? 1 : 0));
    if (typeof day.weight === 'number') put(r, 'T', day.weight);

    const notes = tx.map((t) => t.note).filter(Boolean).join(', ');
    if (notes) put(r, 'W', notes);
  }

  const totalRow = 3 + count;
  put(totalRow, 'B', 'CELKEM');
  ['G', 'H', 'I', 'J', 'K', 'L', 'N', 'P', 'Q', 'R'].forEach((letter) => {
    const c = XLSX.utils.encode_col(col(letter));
    put(totalRow, letter, { f: `SUM(${c}4:${c}${totalRow})` });
  });

  const infoRow = totalRow + 3;
  put(infoRow, 'G', 'Kurz EUR'); put(infoRow + 1, 'G', fx);
  put(infoRow, 'H', 'Výplata'); put(infoRow + 1, 'H', month?.income?.salary ?? 0);
  put(infoRow, 'I', 'Extra'); put(infoRow + 1, 'I', month?.income?.extraEur ?? 0);
  put(infoRow, 'J', 'Fixní (EUR)');
  put(infoRow + 1, 'J', Number(settings.fixed.reduce((s, f) => s + toEur(month?.fixedOverrides?.[f.id] ?? f.amount, f.cur, fx), 0).toFixed(2)));

  const normalized = Array.from({ length: rows.length }, (_, i) => rows[i] ?? []);
  const ws = XLSX.utils.aoa_to_sheet(normalized);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS_CS[m - 1]}_${String(year).slice(2)}`);
  XLSX.writeFile(wb, `${mKey}.xlsx`);
}
