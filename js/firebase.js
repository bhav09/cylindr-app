import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit, increment, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// NOTE on Firebase App Check:
// App Check (reCAPTCHA v3 bot protection) is READY to be enabled.
// To activate it:
//   1. Go to Firebase Console → Build → App Check → Register your web app
//   2. Generate a reCAPTCHA v3 site key at https://www.google.com/recaptcha/admin
//   3. Uncomment the block below and replace the placeholder key with your real key.
//
// import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js';
// try {
//     if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
//         self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
//     }
//     initializeAppCheck(app, {
//         provider: new ReCaptchaV3Provider('YOUR_REAL_RECAPTCHA_V3_SITE_KEY'),
//         isTokenAutoRefreshEnabled: true
//     });
// } catch (e) {
//     console.warn('App Check init failed:', e);
// }

export { app, db, auth, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit, increment, updateDoc, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut };
