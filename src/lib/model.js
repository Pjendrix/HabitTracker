// Datový model vychází z HABIT_TRACKER_2026.xlsx, ale s jedním rozdílem:
// atomem není denní součet za kategorii, ale jednotlivá transakce.
// Denní i měsíční součty se z nich dopočítávají, takže se nikdy nerozejdou.

export const MONTHS_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

export const DAYS_CS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

// Kategorie odpovídají sloupcům G–L v měsíčních listech.
// `czkAccount` značí kategorii, kterou v Excelu vedeš zvlášť v korunách.
export const DEFAULT_SETTINGS = {
  fxDefault: 24.2,
  categories: [
    { id: 'food', label: 'Jídlo & pití' },
    { id: 'social', label: 'Sociální' },
    { id: 'things', label: 'Věci' },
    { id: 'others', label: 'Ostatní' },
    { id: 'work', label: 'Práce' },
  ],
  habits: [
    { id: 'sports', label: 'Sport', kind: 'bool' },
    { id: 'kcal', label: 'Kalorie zapsané', kind: 'bool' },
    { id: 'supp', label: 'Doplňky', kind: 'bool' },
    { id: 'clean', label: 'Bez alkoholu', kind: 'bool' },
  ],
  fixed: [
    { id: 'wohnung', label: 'Nájem', amount: 1000, cur: 'EUR' },
    { id: 'gym', label: 'Posilovna', amount: 54.9, cur: 'EUR' },
    { id: 'invest', label: 'Investice', amount: 800, cur: 'EUR' },
    { id: 'insurance', label: 'Pojištění', amount: 200, cur: 'CZK' },
  ],
  subscriptions: [
    { id: 'spotify', label: 'Spotify', amount: 299, cur: 'CZK', cycle: 'monthly' },
    { id: 'apple', label: 'Apple', amount: 79, cur: 'CZK', cycle: 'monthly' },
    { id: 'youtube', label: 'YouTube', amount: 225, cur: 'CZK', cycle: 'monthly' },
  ],
  budget: { food: 250, social: 120, things: 150, others: 200, work: 0 },
  weightUnit: 'kg',
};

export const DEFAULT_POSITIONS = [
  { id: 'bank_czk', name: 'Bankovní účet', platform: 'Fio', group: 'Hotovost', cur: 'CZK' },
  { id: 'bank_eur', name: 'Bankovní účet', platform: 'Erste', group: 'Hotovost', cur: 'EUR' },
  { id: 'tr_etf', name: 'ETF & akcie', platform: 'Trade Republic', group: 'Akcie', cur: 'EUR' },
  { id: 'tr_cash', name: 'Cash', platform: 'Trade Republic', group: 'Hotovost', cur: 'EUR' },
  { id: 'tr_crypto', name: 'Crypto', platform: 'Trade Republic', group: 'Crypto', cur: 'EUR' },
  { id: 'btc', name: 'Bitcoin', platform: 'Ledger', group: 'Crypto', cur: 'EUR' },
  { id: 'eth', name: 'Ethereum', platform: 'Ledger', group: 'Crypto', cur: 'EUR' },
  { id: 'cash_czk', name: 'Hotovost', platform: '—', group: 'Hotovost', cur: 'CZK' },
];

/* ---------- klíče ---------- */

export const dayKey = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const monthKey = (d) => dayKey(d).slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS_CS[Number(m) - 1]} ${y}`;
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
};
export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/* ---------- měna ---------- */

export const toEur = (amount, cur, fx) => (cur === 'CZK' ? amount / fx : amount);
export const fmtEur = (n) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
export const fmtEur2 = (n) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0);
export const fmtCzk = (n) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n || 0);

/* ---------- výpočty ---------- */

export const dayTotal = (day, fx) =>
  (day?.tx ?? []).reduce((s, t) => s + toEur(t.amount, t.cur, fx), 0);

export function monthTotals(days, fx, categories) {
  const byCat = Object.fromEntries(categories.map((c) => [c.id, 0]));
  let total = 0;
  for (const day of Object.values(days)) {
    for (const t of day.tx ?? []) {
      const eur = toEur(t.amount, t.cur, fx);
      if (byCat[t.cat] === undefined) byCat[t.cat] = 0;
      byCat[t.cat] += eur;
      total += eur;
    }
  }
  return { byCat, total };
}

export function fixedTotal(settings, month, fx) {
  const overrides = month?.fixedOverrides ?? {};
  const fixed = settings.fixed.reduce(
    (s, f) => s + toEur(overrides[f.id] ?? f.amount, f.cur, fx),
    0
  );
  const subs = settings.subscriptions
    .filter((s) => s.cycle !== 'paused')
    .reduce((s, x) => s + toEur(x.cycle === 'yearly' ? x.amount / 12 : x.amount, x.cur, fx), 0);
  return { fixed, subs, total: fixed + subs };
}

export function incomeTotal(month, fx) {
  const i = month?.income ?? {};
  return (i.salary ?? 0) + (i.extraEur ?? 0) + toEur(i.extraCzk ?? 0, 'CZK', fx);
}

/** Kolik dní po sobě (od dneška zpět) je návyk splněný. */
export function streak(days, habitId, today = new Date()) {
  let n = 0;
  const d = new Date(today);
  for (let i = 0; i < 400; i++) {
    const key = dayKey(d);
    const day = days[key];
    if (i === 0 && !day?.habits?.[habitId]) {
      // dnešek ještě nemusí být zapsaný — streak počítáme od včerejška
    } else if (day?.habits?.[habitId]) {
      n++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Kolik můžeš utratit denně do konce měsíce, aby ses vešel do rozpočtu. */
export function paceLeft(spentVariable, budgetVariable, monthKeyStr, today = new Date()) {
  const total = daysInMonth(monthKeyStr);
  const isCurrent = monthKey(today) === monthKeyStr;
  const elapsed = isCurrent ? today.getDate() : total;
  const remainingDays = Math.max(total - elapsed, 0);
  const remaining = budgetVariable - spentVariable;
  return {
    elapsed,
    total,
    remainingDays,
    remaining,
    perDay: remainingDays > 0 ? remaining / remainingDays : 0,
    expectedByNow: (budgetVariable / total) * elapsed,
  };
}
