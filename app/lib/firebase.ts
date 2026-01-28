import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGW_5Hrytho2jAq97tARZsgu6V0gniU5Y",
  authDomain: "gmt-test-99b30.firebaseapp.com",
  projectId: "gmt-test-99b30",
  storageBucket: "gmt-test-99b30.firebasestorage.app",
  messagingSenderId: "285166609217",
  appId: "1:285166609217:web:c86d0f8b1131fe4add77c0"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);