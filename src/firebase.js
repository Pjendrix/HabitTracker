import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';

// Nahraď hodnotami z Firebase console → Project settings → Your apps → Web app.
// Tyhle klíče nejsou tajné, přístup hlídají Firestore rules (firestore.rules).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? 'REPLACE_ME',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN ?? 'REPLACE_ME.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? 'REPLACE_ME',
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET ?? 'REPLACE_ME.appspot.com',
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID ?? 'REPLACE_ME',
  appId: import.meta.env.VITE_FB_APP_ID ?? 'REPLACE_ME',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline cache: zápis v metru bez signálu se propíše, až bude síť.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});
