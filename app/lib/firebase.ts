import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Singleton App Instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ✅ Firestore - Gelişmiş Cache Ayarları
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// ✅ Auth
export const auth = getAuth(app);

// ✅ Persistence garantisi (Çeto'nun patch'i)
let persistenceReady: Promise<void> | null = null;

export function ensureAuthPersistence() {
  if (typeof window === 'undefined') return Promise.resolve();

  if (!persistenceReady) {
    persistenceReady = setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('✅ [AUTH] Persistence: browserLocalPersistence');
      })
      .catch((e) => {
        console.warn('⚠️ [AUTH] Persistence failed, fallback to inMemory', e);
        return setPersistence(auth, inMemoryPersistence).then(() => {});
      });
  }

  return persistenceReady;
}

export { app };