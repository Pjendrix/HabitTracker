import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useSettings } from './lib/store';
import { monthKey } from './lib/model';
import Today from './views/Today';
import Month from './views/Month';
import Budget from './views/Budget';
import Portfolio from './views/Portfolio';
import Settings from './views/Settings';

const TABS = [
  { id: 'today', label: 'Dnes', icon: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z' },
  { id: 'month', label: 'Měsíc', icon: 'M3 9h18M7 3v3m10-3v3M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z' },
  { id: 'budget', label: 'Rozpočet', icon: 'M4 20V10m5 10V4m5 16v-7m5 7V8' },
  { id: 'portfolio', label: 'Portfolio', icon: 'M3 17l6-6 4 4 7-8M14 7h7v7' },
  { id: 'settings', label: 'Nastavení', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7.5 7.5 0 01-2 1.2l-.4 2.6h-4l-.4-2.6a7.5 7.5 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7.4 7.4 0 014.6 12c0-.4 0-.8.1-1.2l-2-1.6 2-3.4 2.4 1a7.5 7.5 0 012-1.2L9.5 3h4l.4 2.6c.7.3 1.4.7 2 1.2l2.4-1 2 3.4-2 1.6c.1.4.1.8.1 1.2z' },
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('today');
  const [mKey, setMKey] = useState(() => monthKey(new Date()));

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u ?? null)), []);

  if (user === undefined) return <div className="spinner">Načítám…</div>;
  if (user === null) return <AuthScreen />;
  return <Shell user={user} tab={tab} setTab={setTab} mKey={mKey} setMKey={setMKey} />;
}

function Shell({ user, tab, setTab, mKey, setMKey }) {
  const [settings, saveSettings] = useSettings(user.uid);
  if (!settings) return <div className="spinner">Načítám nastavení…</div>;

  const shared = { uid: user.uid, settings, saveSettings, mKey, setMKey };

  return (
    <div className="shell">
      <nav className="nav" aria-label="Sekce">
        <div className="brand">
          <strong>Deník</strong>
          {user.email ?? 'anonymní účet'}
        </div>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'today' && <Today {...shared} />}
        {tab === 'month' && <Month {...shared} />}
        {tab === 'budget' && <Budget {...shared} />}
        {tab === 'portfolio' && <Portfolio {...shared} />}
        {tab === 'settings' && <Settings {...shared} onSignOut={() => signOut(auth)} />}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('in');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fn = mode === 'in' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
      await fn(auth, email, password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential'
          ? 'E-mail nebo heslo nesedí.'
          : err.code === 'auth/weak-password'
          ? 'Heslo musí mít aspoň 6 znaků.'
          : `Přihlášení selhalo (${err.code}).`
      );
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>Deník</h1>
      <p>Výdaje, návyky a portfolio na jednom místě.</p>
      <form onSubmit={submit}>
        {error && <div className="banner">{error}</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="pw">Heslo</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn" disabled={busy}>{mode === 'in' ? 'Přihlásit se' : 'Založit účet'}</button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Nemám účet' : 'Už účet mám'}
        </button>
      </form>
    </div>
  );
}
