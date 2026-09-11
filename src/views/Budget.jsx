import { useMemo } from 'react';
import { useDays, useMonth } from '../lib/store';
import {
  monthLabel, shiftMonth, monthTotals, fixedTotal, incomeTotal,
  fmtEur, fmtEur2, toEur, paceLeft,
} from '../lib/model';

export default function Budget({ uid, settings, saveSettings, mKey, setMKey }) {
  const [month, saveMonth, fx] = useMonth(uid, mKey, settings.fxDefault);
  const { days } = useDays(uid, mKey);

  const { total: spent } = useMemo(
    () => monthTotals(days, fx, settings.categories),
    [days, fx, settings.categories]
  );
  const fixed = fixedTotal(settings, month, fx);
  const income = incomeTotal(month, fx);
  const budgetVariable = Object.values(settings.budget ?? {}).reduce((a, b) => a + b, 0);
  const pace = paceLeft(spent, budgetVariable, mKey);
  const plannedBalance = income - fixed.total - budgetVariable;
  const actualBalance = income - fixed.total - spent;

  const setBudget = (id, value) =>
    saveSettings({ budget: { ...(settings.budget ?? {}), [id]: Number(value) || 0 } });

  const setFixed = (id, value) =>
    saveMonth({ fixedOverrides: { ...(month?.fixedOverrides ?? {}), [id]: Number(value) || 0 } });

  return (
    <>
      <div className="page-head">
        <h1>Rozpočet</h1>
        <div className="month-picker">
          <button onClick={() => setMKey(shiftMonth(mKey, -1))} aria-label="Předchozí měsíc">‹</button>
          <span>{monthLabel(mKey)}</span>
          <button onClick={() => setMKey(shiftMonth(mKey, 1))} aria-label="Následující měsíc">›</button>
        </div>
      </div>

      {spent > pace.expectedByNow * 1.15 && pace.remainingDays > 0 && (
        <div className="banner">
          K {pace.elapsed}. dni jsi utratil {fmtEur(spent)}, tempo rozpočtu je {fmtEur(pace.expectedByNow)}.
          Do konce měsíce zbývá {fmtEur(pace.remaining)} na {pace.remainingDays} dní, tedy {fmtEur2(pace.perDay)} denně.
        </div>
      )}

      <div className="stats">
        <div className="stat"><span className="v">{fmtEur(income)}</span><span className="k">příjem</span></div>
        <div className="stat"><span className="v">{fmtEur(fixed.total)}</span><span className="k">fixní</span></div>
        <div className="stat"><span className="v">{fmtEur(spent)}</span><span className="k">variabilní</span></div>
        <div className="stat">
          <span className={`v ${actualBalance >= 0 ? 'pos' : 'neg'}`}>{fmtEur(actualBalance)}</span>
          <span className="k">zbývá (plán {fmtEur(plannedBalance)})</span>
        </div>
      </div>

      <h2>Fixní náklady</h2>
      <div className="card">
        <table>
          <thead><tr><th>Položka</th><th className="n">Částka</th><th className="n">V EUR</th></tr></thead>
          <tbody>
            {settings.fixed.map((f) => {
              const value = month?.fixedOverrides?.[f.id] ?? f.amount;
              return (
                <tr key={f.id}>
                  <td>{f.label}</td>
                  <td className="n">
                    <input type="number" step="0.01" className="num" style={{ maxWidth: 110, textAlign: 'right' }}
                      value={value} onChange={(e) => setFixed(f.id, e.target.value)} />
                    <span className="muted" style={{ marginLeft: 6 }}>{f.cur}</span>
                  </td>
                  <td className="n">{fmtEur2(toEur(value, f.cur, fx))}</td>
                </tr>
              );
            })}
            <tr>
              <td>Předplatné <span className="muted">({settings.subscriptions.filter((s) => s.cycle !== 'paused').length} aktivních)</span></td>
              <td className="n muted">—</td>
              <td className="n">{fmtEur2(fixed.subs)}</td>
            </tr>
            <tr className="total"><td>Celkem</td><td /><td className="n">{fmtEur2(fixed.total)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Předplatné</h2>
      <div className="card">
        <table>
          <thead><tr><th>Služba</th><th className="n">Cena</th><th>Cyklus</th><th className="n">Měsíčně v EUR</th></tr></thead>
          <tbody>
            {settings.subscriptions.map((s, i) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td className="n">{s.amount} {s.cur}</td>
                <td>
                  <select value={s.cycle} onChange={(e) => {
                    const next = settings.subscriptions.map((x, j) => (j === i ? { ...x, cycle: e.target.value } : x));
                    saveSettings({ subscriptions: next });
                  }}>
                    <option value="monthly">měsíčně</option>
                    <option value="yearly">ročně</option>
                    <option value="paused">pozastaveno</option>
                  </select>
                </td>
                <td className="n">
                  {s.cycle === 'paused' ? '—' : fmtEur2(toEur(s.cycle === 'yearly' ? s.amount / 12 : s.amount, s.cur, fx))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Plán na variabilní výdaje</h2>
      <div className="card">
        <table>
          <thead><tr><th>Kategorie</th><th className="n">Měsíční plán (EUR)</th></tr></thead>
          <tbody>
            {settings.categories.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td className="n">
                  <input type="number" className="num" style={{ maxWidth: 110, textAlign: 'right' }}
                    value={settings.budget?.[c.id] ?? 0} onChange={(e) => setBudget(c.id, e.target.value)} />
                </td>
              </tr>
            ))}
            <tr className="total"><td>Celkem</td><td className="n">{fmtEur(budgetVariable)}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
