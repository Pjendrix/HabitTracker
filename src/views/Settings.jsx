import { useState } from 'react';
import { DEFAULT_POSITIONS } from '../lib/model';

export default function Settings({ settings, saveSettings, onSignOut }) {
  const positions = settings.positions ?? DEFAULT_POSITIONS;

  const update = (list, i, patch) => list.map((x, j) => (j === i ? { ...x, ...patch } : x));
  const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `id_${Date.now()}`;

  return (
    <>
      <div className="page-head"><h1>Nastavení</h1></div>

      <h2>Kategorie výdajů</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Kategorie jsou uložené jednou a platí pro všechny roky. Přejmenování nerozbije historii —
          transakce si drží ID, ne název.
        </p>
        <EditableList
          items={settings.categories}
          onChange={(categories) => saveSettings({ categories })}
          newItem={(label) => ({ id: slug(label), label })}
          render={(c, i, list, onChange) => (
            <input type="text" value={c.label} onChange={(e) => onChange(update(list, i, { label: e.target.value }))} />
          )}
        />
      </div>

      <h2>Návyky</h2>
      <div className="card">
        <EditableList
          items={settings.habits}
          onChange={(habits) => saveSettings({ habits })}
          newItem={(label) => ({ id: slug(label), label, kind: 'bool' })}
          render={(h, i, list, onChange) => (
            <input type="text" value={h.label} onChange={(e) => onChange(update(list, i, { label: e.target.value }))} />
          )}
        />
      </div>

      <h2>Fixní náklady</h2>
      <div className="card">
        <EditableList
          items={settings.fixed}
          onChange={(fixed) => saveSettings({ fixed })}
          newItem={(label) => ({ id: slug(label), label, amount: 0, cur: 'EUR' })}
          render={(f, i, list, onChange) => (
            <div className="row" style={{ flex: 1 }}>
              <input type="text" value={f.label} onChange={(e) => onChange(update(list, i, { label: e.target.value }))} />
              <input type="number" step="0.01" className="num" style={{ maxWidth: 110 }} value={f.amount}
                onChange={(e) => onChange(update(list, i, { amount: Number(e.target.value) }))} />
              <select style={{ maxWidth: 90 }} value={f.cur} onChange={(e) => onChange(update(list, i, { cur: e.target.value }))}>
                <option>EUR</option><option>CZK</option>
              </select>
            </div>
          )}
        />
      </div>

      <h2>Předplatné</h2>
      <div className="card">
        <EditableList
          items={settings.subscriptions}
          onChange={(subscriptions) => saveSettings({ subscriptions })}
          newItem={(label) => ({ id: slug(label), label, amount: 0, cur: 'CZK', cycle: 'monthly' })}
          render={(s, i, list, onChange) => (
            <div className="row" style={{ flex: 1 }}>
              <input type="text" value={s.label} onChange={(e) => onChange(update(list, i, { label: e.target.value }))} />
              <input type="number" className="num" style={{ maxWidth: 100 }} value={s.amount}
                onChange={(e) => onChange(update(list, i, { amount: Number(e.target.value) }))} />
              <select style={{ maxWidth: 90 }} value={s.cur} onChange={(e) => onChange(update(list, i, { cur: e.target.value }))}>
                <option>CZK</option><option>EUR</option>
              </select>
            </div>
          )}
        />
      </div>

      <h2>Pozice v portfoliu</h2>
      <div className="card">
        <EditableList
          items={positions}
          onChange={(next) => saveSettings({ positions: next })}
          newItem={(name) => ({ id: slug(name), name, platform: '', group: 'Ostatní', cur: 'EUR' })}
          render={(p, i, list, onChange) => (
            <div className="row" style={{ flex: 1 }}>
              <input type="text" value={p.name} onChange={(e) => onChange(update(list, i, { name: e.target.value }))} />
              <input type="text" style={{ maxWidth: 130 }} value={p.platform} placeholder="platforma"
                onChange={(e) => onChange(update(list, i, { platform: e.target.value }))} />
              <select style={{ maxWidth: 120 }} value={p.group} onChange={(e) => onChange(update(list, i, { group: e.target.value }))}>
                <option>Hotovost</option><option>Akcie</option><option>Crypto</option><option>Fondy</option><option>Ostatní</option>
              </select>
              <select style={{ maxWidth: 90 }} value={p.cur} onChange={(e) => onChange(update(list, i, { cur: e.target.value }))}>
                <option>EUR</option><option>CZK</option>
              </select>
            </div>
          )}
        />
      </div>

      <h2>Výchozí kurz</h2>
      <div className="card">
        <div className="field" style={{ maxWidth: 160 }}>
          <label htmlFor="dfx">CZK za 1 EUR</label>
          <input id="dfx" type="number" step="0.01" className="num" value={settings.fxDefault}
            onChange={(e) => saveSettings({ fxDefault: Number(e.target.value) })} />
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Použije se pro nové měsíce. Jednotlivý měsíc přepíšeš v záložce Měsíc.
        </p>
      </div>

      <h2>Účet</h2>
      <div className="card">
        <button className="btn ghost" onClick={onSignOut}>Odhlásit se</button>
      </div>
    </>
  );
}

function EditableList({ items, onChange, render, newItem }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, newItem(draft.trim())]);
    setDraft('');
  };

  return (
    <>
      {items.map((item, i) => (
        <div key={item.id} className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
          {render(item, i, items, onChange)}
          <button className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Odebrat">✕</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Přidat další…"
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn small" onClick={add}>Přidat</button>
      </div>
    </>
  );
}
