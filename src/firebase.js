import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';

// Z Firebase console → Project settings → Your apps → SDK setup → Config.
// Tyhle klíče nejsou tajné a můžou být klidně na GitHubu — přístup k datům
// hlídají Firestore pravidla (firestore.rules), ne utajení klíče.
const firebaseConfig = {
  apiKey: 'AIzaSyDAhQ8bxmHDc4sDrn7T-QotpPsE-4AwvPA',
  authDomain: 'habittracker-9913c.firebaseapp.com',
  projectId: 'habittracker-9913c',
  storageBucket: 'habittracker-9913c.firebasestorage.app',
  messagingSenderId: '463778952036',
  appId: '1:463778952036:web:9f255bc35c48fb675a0071',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline cache: zápis bez signálu se propíše, jakmile je síť zpátky.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});
