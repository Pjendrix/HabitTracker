import { useMemo, useState } from 'react';
import { usePortfolio } from '../lib/store';
import { DEFAULT_POSITIONS, MONTHS_CS, monthKey, monthLabel, fmtEur, toEur } from '../lib/model';

export default function Portfolio({ uid, settings }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [editKey, setEditKey] = useState(() => monthKey(new Date()));
  const { snapshots, ordered, save } = usePortfolio(uid, year);

  const positions = settings.positions ?? DEFAULT_POSITIONS;
  const snap = snapshots[editKey];
  const fx = snap?.fx ?? settings.fxDefault;

  const valueOf = (s) =>
    s ? positions.reduce((sum, p) => sum + toEur(s.values?.[p.id] ?? 0, p.cur, s.fx ?? settings.fxDefault), 0) : 0;

  const series = useMemo(
    () => ordered.map(([k, s]) => ({ key: k, value: valueOf(s) })).filter((p) => p.value > 0),
    [ordered, positions]
  );

  const currentTotal = valueOf(snap);
  const prevKey = ordered.filter(([k]) => k < editKey).pop()?.[0];
  const prevTotal = valueOf(snapshots[prevKey]);
  const delta = prevTotal ? currentTotal - prevTotal : 0;

  const byGroup = positions.reduce((acc, p) => {
    const v = toEur(snap?.values?.[p.id] ?? 0, p.cur, fx);
    acc[p.group] = (acc[p.group] ?? 0) + v;
    return acc;
  }, {});

  const setValue = (id, v) =>
    save(editKey, { fx, values: { ...(snap?.values ?? {}), [id]: Number(v) || 0 }, updatedAt: Date.now() });

  const copyPrevious = () =>
    prevKey && save(editKey, { fx: snapshots[prevKey].fx ?? fx, values: { ...snapshots[prevKey].values }, updatedAt: Date.now() });

  return (
    <>
      <div className="page-head">
        <h1>Portfolio</h1>
        <div className="month-picker">
          <button onClick={() => setYear(year - 1)} aria-label="Předchozí rok">‹</button>
          <span>{year}</span>
          <button onClick={() => setYear(year + 1)} aria-label="Následující rok" disabled={year >= new Date().getFullYear()}>›</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="v">{fmtEur(currentTotal)}</span><span className="k">čisté jmění {monthLabel(editKey)}</span></div>
        <div className="stat">
          <span className={`v ${delta >= 0 ? 'pos' : 'neg'}`}>{delta >= 0 ? '+' : ''}{fmtEur(delta)}</span>
          <span className="k">oproti {prevKey ? monthLabel(prevKey) : '—'}</span>
        </div>
        <div className="stat">
          <span className="v">{Math.round(((byGroup['Akcie'] ?? 0) / (currentTotal || 1)) * 100)} %</span>
          <span className="k">v akciích</span>
        </div>
        <div className="stat">
          <span className="v">{Math.round(((byGroup['Hotovost'] ?? 0) / (currentTotal || 1)) * 100)} %</span>
          <span className="k">v hotovosti</span>
        </div>
      </div>

      {series.length > 1 && <NetWorthChart series={series} />}

      <h2>Snapshot měsíce</h2>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="field" style={{ maxWidth: 200 }}>
            <label htmlFor="snapm">Měsíc</label>
            <select id="snapm" value={editKey} onChange={(e) => setEditKey(e.target.value)}>
              {MONTHS_CS.map((label, i) => {
                const k = `${year}-${String(i + 1).padStart(2, '0')}`;
                return <option key={k} value={k}>{label} {snapshots[k] ? '✓' : ''}</option>;
              })}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label htmlFor="pfx">Kurz CZK/EUR</label>
            <input id="pfx" type="number" step="0.01" className="num" value={fx}
              onChange={(e) => save(editKey, { fx: Number(e.target.value) })} />
          </div>
          {prevKey && !snap && (
            <button className="btn ghost" onClick={copyPrevious}>Předvyplnit z {monthLabel(prevKey)}</button>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Pozice</th><th>Kde</th><th className="n">Hodnota</th><th className="n">V EUR</th><th className="n">Podíl</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const raw = snap?.values?.[p.id] ?? '';
                const eur = toEur(Number(raw) || 0, p.cur, fx);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">{p.platform}</td>
                    <td className="n">
                      <input type="number" className="num" style={{ maxWidth: 130, textAlign: 'right' }}
                        value={raw} onChange={(e) => setValue(p.id, e.target.value)} placeholder="0" />
                      <span className="muted" style={{ marginLeft: 6 }}>{p.cur}</span>
                    </td>
                    <td className="n">{fmtEur(eur)}</td>
                    <td className="n muted">{currentTotal ? Math.round((eur / currentTotal) * 100) : 0} %</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td colSpan={3}>Celkem</td>
                <td className="n">{fmtEur(currentTotal)}</td>
                <td className="n">100 %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h2>Rozdělení</h2>
      <div className="card">
        {Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([group, v]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>{group}</span>
              <span className="num muted">{fmtEur(v)}</span>
            </div>
            <div className="meter"><span style={{ width: `${currentTotal ? (v / currentTotal) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
    </>
  );
}

function NetWorthChart({ series }) {
  const w = 640, h = 180, pad = 24;
  const values = series.map((p) => p.value);
  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Vývoj čistého jmění</h3>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Graf vývoje čistého jmění">
        <path d={area} fill="var(--accent-soft)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {series.map((p, i) => (
          <circle key={p.key} cx={x(i)} cy={y(p.value)} r="3" fill="var(--accent)">
            <title>{`${monthLabel(p.key)}: ${fmtEur(p.value)}`}</title>
          </circle>
        ))}
        <text x={pad} y={h - 6} fontSize="10" fill="var(--ink-soft)">{monthLabel(series[0].key)}</text>
        <text x={w - pad} y={h - 6} fontSize="10" fill="var(--ink-soft)" textAnchor="end">
          {monthLabel(series[series.length - 1].key)}
        </text>
      </svg>
    </div>
  );
}
