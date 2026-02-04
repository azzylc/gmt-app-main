import { initializeApp, getApps } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
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

// ✅ Auth - Client/Server Safe Initialization
let authInstance: Auth;

if (typeof window !== 'undefined') {
  // 🔥 CLIENT-SIDE: iOS Capacitor için özel initialization
  const { initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver } = require('firebase/auth');
  authInstance = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver
  });
} else {
  // 🏗️ SERVER-SIDE (build time): Normal getAuth
  authInstance = getAuth(app);
}

export const auth = authInstance;
export { app };