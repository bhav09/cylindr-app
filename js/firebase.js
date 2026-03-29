import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
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

export { app, db, auth, collection, onSnapshot, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, limit, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut };
