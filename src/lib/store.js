import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, query, setDoc, where, documentId, deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_SETTINGS, daysInMonth } from './model';

const userDoc = (uid, ...path) => doc(db, 'users', uid, ...path);

/* ---------- nastavení ---------- */

export function useSettings(uid) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(userDoc(uid, 'meta', 'settings'), (snap) => {
      setSettings(snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : DEFAULT_SETTINGS);
    });
  }, [uid]);

  const save = (patch) => setDoc(userDoc(uid, 'meta', 'settings'), patch, { merge: true });
  return [settings, save];
}

/* ---------- dny v měsíci ---------- */

export function useDays(uid, mKey) {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !mKey) return;
    setLoading(true);
    const last = `${mKey}-${String(daysInMonth(mKey)).padStart(2, '0')}`;
    const q = query(
      collection(db, 'users', uid, 'days'),
      where(documentId(), '>=', `${mKey}-01`),
      where(documentId(), '<=', last)
    );
    return onSnapshot(q, (snap) => {
      const next = {};
      snap.forEach((d) => { next[d.id] = d.data(); });
      setDays(next);
      setLoading(false);
    });
  }, [uid, mKey]);

  const saveDay = (key, patch) => setDoc(userDoc(uid, 'days', key), patch, { merge: true });

  const addTx = (key, tx) => {
    const current = days[key]?.tx ?? [];
    return saveDay(key, { tx: [...current, { ...tx, id: crypto.randomUUID() }] });
  };
  const removeTx = (key, txId) =>
    saveDay(key, { tx: (days[key]?.tx ?? []).filter((t) => t.id !== txId) });

  const toggleHabit = (key, habitId, value) =>
    saveDay(key, { habits: { [habitId]: value } });

  const setWeight = (key, weight) =>
    saveDay(key, { weight: weight === '' || weight == null ? deleteField() : Number(weight) });

  return { days, loading, saveDay, addTx, removeTx, toggleHabit, setWeight };
}

/* ---------- měsíc (kurz, příjmy, fixní náklady) ---------- */

export function useMonth(uid, mKey, fxDefault) {
  const [month, setMonth] = useState(null);

  useEffect(() => {
    if (!uid || !mKey) return;
    return onSnapshot(userDoc(uid, 'months', mKey), (snap) =>
      setMonth(snap.exists() ? snap.data() : {})
    );
  }, [uid, mKey]);

  const save = (patch) => setDoc(userDoc(uid, 'months', mKey), patch, { merge: true });
  const fx = month?.fx ?? fxDefault ?? 24.2;
  return [month, save, fx];
}

/* ---------- portfolio (roční série snapshotů) ---------- */

export function usePortfolio(uid, year) {
  const [snapshots, setSnapshots] = useState({});

  useEffect(() => {
    if (!uid || !year) return;
    const q = query(
      collection(db, 'users', uid, 'portfolio'),
      where(documentId(), '>=', `${year}-01`),
      where(documentId(), '<=', `${year}-12`)
    );
    return onSnapshot(q, (snap) => {
      const next = {};
      snap.forEach((d) => { next[d.id] = d.data(); });
      setSnapshots(next);
    });
  }, [uid, year]);

  const save = (mKey, patch) => setDoc(userDoc(uid, 'portfolio', mKey), patch, { merge: true });
  const ordered = useMemo(
    () => Object.entries(snapshots).sort(([a], [b]) => a.localeCompare(b)),
    [snapshots]
  );
  return { snapshots, ordered, save };
}
