import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit, increment } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyC3mUMDmPUC5yu9kh80RBQi3ULaSGpcvLY",
    authDomain: "cylindr-3759e.firebaseapp.com",
    projectId: "cylindr-3759e",
    storageBucket: "cylindr-3759e.firebasestorage.app",
    messagingSenderId: "579364732251",
    appId: "1:579364732251:web:95265d7c2e4004e2402e7e",
    measurementId: "G-ZRJ7DLMFG2"
};

import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Guardrail: Firebase App Check (reCAPTCHA v3)
// Prevents automated bots and scripts from spamming your Firebase endpoints.
try {
    // For localhost testing, use a debug token (Will print in console to enter in Firebase)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    // Initialize App Check (Ensure you replace with your real reCAPTCHA v3 site key in Production)
    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Lc_REPLACE_WITH_YOUR_REAL_RECAPTCHA_V3_SITE_KEY'),
        isTokenAutoRefreshEnabled: true
    });
} catch (error) {
    console.warn("App Check initialization skipped or failed (Ensure it's setup in Firebase Console):", error);
}

export { app, db, auth, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit, increment, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut };
