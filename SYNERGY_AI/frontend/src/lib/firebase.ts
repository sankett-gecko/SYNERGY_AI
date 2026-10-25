import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDu4vCjIhnJ-UWWnebadOezF6Lfb4lkW1c",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "synergyai-57cdb.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "synergyai-57cdb",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "synergyai-57cdb.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1083824525016",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1083824525016:web:aec50616b017c99d0b11ad"
};

// Initialize Firebase safely (prevents duplicate app initialization in Next.js HMR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();