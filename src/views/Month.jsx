import { useMemo } from 'react';
import { useDays, useMonth } from '../lib/store';
import {
  monthLabel, shiftMonth, daysInMonth, dayKey, dayTotal, monthTotals,
  fixedTotal, incomeTotal, fmtEur, fmtEur2, DAYS_CS,
} from '../lib/model';
import { exportMonthXlsx } from '../lib/exportXlsx';

const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function Month({ uid, settings, mKey, setMKey }) {
  const [month, saveMonth, fx] = useMonth(uid, mKey, settings.fxDefault);
  const { days } = useDays(uid, mKey);

  const { byCat, total } = useMemo(
    () => monthTotals(days, fx, settings.categories),
    [days, fx, settings.categories]
  );
  const fixed = fixedTotal(settings, month, fx);
  const income = incomeTotal(month, fx);
  const balance = income - total - fixed.total;

  const [year, m] = mKey.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // pondělí první
  const count = daysInMonth(mKey);
  const max = Math.max(...Object.keys(days).map((k) => dayTotal(days[k], fx)), 1);

  const habitStats = settings.habits.map((h) => ({
    ...h,
    hit: Object.values(days).filter((d) => d.habits?.[h.id]).length,
  }));

  return (
    <>
      <div className="page-head">
        <h1>{monthLabel(mKey)}</h1>
        <div className="month-picker">
          <button onClick={() => setMKey(shiftMonth(mKey, -1))} aria-label="Předchozí měsíc">‹</button>
          <span>{monthLabel(mKey)}</span>
          <button onClick={() => setMKey(shiftMonth(mKey, 1))} aria-label="Následující měsíc">›</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="v">{fmtEur(total)}</span><span className="k">denní výdaje</span></div>
        <div className="stat"><span className="v">{fmtEur(fixed.total)}</span><span className="k">fixní náklady</span></div>
        <div className="stat"><span className="v">{fmtEur(income)}</span><span className="k">příjem</span></div>
        <div className="stat">
          <span className={`v ${balance >= 0 ? 'pos' : 'neg'}`}>{fmtEur(balance)}</span>
          <span className="k">bilance</span>
        </div>
      </div>

      <h2>Dny</h2>
      <div className="cal" role="group" aria-label="Kalendář měsíce">
        {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: count }).map((_, i) => {
          const d = new Date(year, m - 1, i + 1);
          const key = dayKey(d);
          const t = dayTotal(days[key], fx);
          const intensity = t / max;
          const anyHabit = settings.habits.some((h) => days[key]?.habits?.[h.id]);
          return (
            <button
              key={key}
              title={`${DAYS_CS[d.getDay()]} ${i + 1}. — ${fmtEur2(t)}`}
              style={{ background: t ? `color-mix(in srgb, var(--accent) ${Math.round(10 + intensity * 55)}%, #fff)` : '#fff' }}
            >
              <span>{i + 1}</span>
              {t > 0 && <span className="amt">{Math.round(t)}</span>}
              {anyHabit && <span className="dot" />}
            </button>
          );
        })}
      </div>

      <h2>Kam to šlo</h2>
      <div className="card">
        <table>
          <thead>
            <tr><th>Kategorie</th><th className="n">Utraceno</th><th className="n">Rozpočet</th><th className="n">Rozdíl</th></tr>
          </thead>
          <tbody>
            {settings.categories.map((c) => {
              const spent = byCat[c.id] ?? 0;
              const plan = settings.budget?.[c.id] ?? 0;
              const diff = plan - spent;
              return (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td className="n">{fmtEur2(spent)}</td>
                  <td className="n muted">{plan ? fmtEur(plan) : '—'}</td>
                  <td className={`n ${diff >= 0 ? 'pos' : 'neg'}`}>{plan ? fmtEur(diff) : '—'}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td>Celkem</td>
              <td className="n">{fmtEur2(total)}</td>
              <td className="n">{fmtEur(Object.values(settings.budget ?? {}).reduce((a, b) => a + b, 0))}</td>
              <td className="n" />
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Návyky</h2>
      <div className="card">
        {habitStats.map((h) => (
          <div key={h.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>{h.label}</span>
              <span className="num muted">{h.hit}/{count} dní</span>
            </div>
            <div className="meter"><span style={{ width: `${(h.hit / count) * 100}%` }} /></div>
          </div>
        ))}
      </div>

      <h2>Přenos do Excelu</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Vyexportuje list se stejným rozvržením jako měsíční záložky v HABIT_TRACKER — datum, den,
          kategorie G–L, návyky, váha a poznámky. List vlož do svého sešitu jako novou záložku.
        </p>
        <button className="btn ghost" onClick={() => exportMonthXlsx({ mKey, days, month, settings, fx })}>
          Stáhnout {monthLabel(mKey)} jako .xlsx
        </button>
      </div>

      <h2>Kurz a příjem</h2>
      <div className="card">
        <div className="row">
          <div className="field" style={{ maxWidth: 140 }}>
            <label htmlFor="fx">Kurz CZK/EUR</label>
            <input id="fx" type="number" step="0.01" className="num" value={month?.fx ?? settings.fxDefault}
              onChange={(e) => saveMonth({ fx: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label htmlFor="sal">Výplata (EUR)</label>
            <input id="sal" type="number" className="num" value={month?.income?.salary ?? ''}
              onChange={(e) => saveMonth({ income: { ...(month?.income ?? {}), salary: Number(e.target.value) } })} />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label htmlFor="ex">Extra příjem (EUR)</label>
            <input id="ex" type="number" className="num" value={month?.income?.extraEur ?? ''}
              onChange={(e) => saveMonth({ income: { ...(month?.income ?? {}), extraEur: Number(e.target.value) } })} />
          </div>
        </div>
      </div>
    </>
  );
}
