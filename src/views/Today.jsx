import { useMemo, useState } from 'react';
import { useDays, useMonth } from '../lib/store';
import {
  dayKey, monthKey, DAYS_CS, MONTHS_CS, dayTotal, monthTotals, fmtEur, fmtEur2,
  streak, paceLeft,
} from '../lib/model';

export default function Today({ uid, settings }) {
  const [date, setDate] = useState(() => new Date());
  const key = dayKey(date);
  const mKey = monthKey(date);

  const [month, , fx] = useMonth(uid, mKey, settings.fxDefault);
  const { days, addTx, removeTx, toggleHabit, setWeight } = useDays(uid, mKey);

  const day = days[key];
  const total = dayTotal(day, fx);
  const { total: spent } = useMemo(
    () => monthTotals(days, fx, settings.categories),
    [days, fx, settings.categories]
  );
  const budgetVariable = Object.values(settings.budget ?? {}).reduce((a, b) => a + b, 0);
  const pace = paceLeft(spent, budgetVariable, mKey);
  const lastWeight = useMemo(() => {
    const entries = Object.entries(days).filter(([, d]) => typeof d.weight === 'number');
    entries.sort(([a], [b]) => b.localeCompare(a));
    return entries[0]?.[1].weight;
  }, [days]);

  const shift = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    if (d <= new Date()) setDate(d);
  };
  const isToday = key === dayKey(new Date());

  return (
    <>
      <div className="page-head">
        <h1>{isToday ? 'Dnes' : `${DAYS_CS[date.getDay()]} ${date.getDate()}. ${MONTHS_CS[date.getMonth()].toLowerCase()}`}</h1>
        <div className="month-picker">
          <button onClick={() => shift(-1)} aria-label="Předchozí den">‹</button>
          <span>{key}</span>
          <button onClick={() => shift(1)} aria-label="Následující den" disabled={isToday}>›</button>
        </div>
      </div>

      <section className="ledger">
        <div className="ledger-head">
          <div>
            <div className="ledger-date">{DAYS_CS[date.getDay()]}, utraceno</div>
            <div className="ledger-total">{fmtEur2(total)}</div>
          </div>
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="v">{fmtEur(pace.perDay)}</span>
            <span className="k">na den do konce měsíce</span>
          </div>
        </div>

        {day?.tx?.length ? (
          <ul className="ledger-rows">
            {day.tx.map((t) => (
              <li key={t.id}>
                <span className="tag">{settings.categories.find((c) => c.id === t.cat)?.label ?? t.cat}</span>
                <span className="row-note">{t.note || '—'}</span>
                <span className="num">
                  {t.cur === 'CZK' ? `${t.amount.toLocaleString('cs-CZ')} Kč` : fmtEur2(t.amount)}
                </span>
                <button className="icon-btn" onClick={() => removeTx(key, t.id)} aria-label="Smazat položku">✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ledger-empty">Zatím nic. Zapiš první výdaj níž — nebo si užij nulový den.</p>
        )}
      </section>

      <QuickAdd categories={settings.categories} onAdd={(tx) => addTx(key, tx)} />

      <h2>Návyky</h2>
      <div className="habits">
        {settings.habits.map((h) => {
          const on = !!day?.habits?.[h.id];
          const s = streak(days, h.id, date);
          return (
            <button key={h.id} className="habit" aria-pressed={on} onClick={() => toggleHabit(key, h.id, !on)}>
              {h.label}
              {s > 1 && <span className="streak">{s}×</span>}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field" style={{ maxWidth: 160 }}>
            <label htmlFor="w">Váha (kg)</label>
            <input
              id="w"
              type="number"
              step="0.1"
              className="num"
              value={day?.weight ?? ''}
              placeholder={lastWeight ? String(lastWeight) : '—'}
              onChange={(e) => setWeight(key, e.target.value)}
            />
          </div>
          <div className="stat">
            <span className="v">{fmtEur(spent)}</span>
            <span className="k">
              utraceno za {MONTHS_CS[date.getMonth()].toLowerCase()} · plán {fmtEur(pace.expectedByNow)} k dnešku
            </span>
          </div>
        </div>
        <div className={`meter ${spent > pace.expectedByNow ? 'over' : ''}`} style={{ marginTop: 14 }}>
          <span style={{ width: `${Math.min(100, budgetVariable ? (spent / budgetVariable) * 100 : 0)}%` }} />
        </div>
      </div>
    </>
  );
}

function QuickAdd({ categories, onAdd }) {
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState('EUR');
  const [cat, setCat] = useState(categories[0]?.id);
  const [note, setNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const value = Number(String(amount).replace(',', '.'));
    if (!value) return;
    onAdd({ amount: value, cur, cat, note: note.trim() });
    setAmount('');
    setNote('');
  };

  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 12 }}>
      <div className="row">
        <div className="field" style={{ maxWidth: 170 }}>
          <label htmlFor="amt">Částka</label>
          <input
            id="amt" className="amount" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0" autoComplete="off"
          />
        </div>
        <div className="field" style={{ maxWidth: 130, flex: '0 0 auto' }}>
          <label>Měna</label>
          <div className="seg">
            {['EUR', 'CZK'].map((c) => (
              <button key={c} type="button" aria-pressed={cur === c} onClick={() => setCur(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">Za co</label>
          <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Billa, letenka do Tokia…" />
        </div>
      </div>

      <div className="chips" style={{ marginTop: 12 }}>
        {categories.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <button className="btn" style={{ marginTop: 12 }} disabled={!amount}>Zapsat výdaj</button>
    </form>
  );
}
