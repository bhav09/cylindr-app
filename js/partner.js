import { auth, signInWithEmailAndPassword, signOut } from './firebase.js';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from './firebase.js';

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const errorEl = document.getElementById('login-error');

const statusBadge = document.getElementById('current-status-badge');
const lastUpdatedText = document.getElementById('last-updated-text');
const updateStockBtns = document.querySelectorAll('.update-stock-btn');
const feedbackEl = document.getElementById('update-feedback');

const walkinToggle = document.getElementById('accept-walkin');
const upiToggle = document.getElementById('accept-upi');
const typeToggles = document.querySelectorAll('.type-toggle');

let currentPartnerDocId = null;

// Auth State Listener - wrapped in try/catch for mock mode
try {
    auth.onAuthStateChanged((user) => {
        if (user && !user.isAnonymous) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            currentPartnerDocId = user.uid;
            loadPartnerData(currentPartnerDocId);
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            currentPartnerDocId = null;
        }
    });
} catch (error) {
    console.warn("Firebase auth not available, running in mock mode:", error.message);
}

// Login Flow
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        errorEl.style.display = 'none';
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login failed:", error);
        errorEl.textContent = "Invalid email or password.";
        errorEl.style.display = 'block';
    }
});

// Logout Flow
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
    }
});

// Load Partner Dashboard Data
function loadPartnerData(distributorId) {
    const docRef = doc(db, 'distributors', distributorId);
    
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('agency-name').textContent = data.name || "Your Agency";
            
            // Update Status Badge
            const status = data.stock_status || "unknown";
            statusBadge.textContent = status.toUpperCase();
            statusBadge.className = `status-badge ${status}`;
            
            // Update Buttons
            updateStockBtns.forEach(btn => {
                if (btn.dataset.status === status) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Last Updated
            if (data.last_updated) {
                const date = data.last_updated.toDate ? data.last_updated.toDate() : new Date(data.last_updated);
                lastUpdatedText.textContent = `Last updated: ${date.toLocaleTimeString()} on ${date.toLocaleDateString()}`;
            }
            
            // Analytics
            document.getElementById('views-count').textContent = data.analytics_views || "0";
            document.getElementById('calls-saved').textContent = data.analytics_calls_deflected || "0";
            
            // Toggles
            if (data.walk_in !== undefined) walkinToggle.checked = data.walk_in;
            if (data.upi !== undefined) upiToggle.checked = data.upi;
            if (data.types) {
                typeToggles.forEach(t => {
                    t.checked = data.types.includes(t.value);
                });
            }
            
        } else {
            console.warn("Distributor document not found!");
            document.getElementById('agency-name').textContent = "Account Pending Setup";
        }
    });
}

// Update Stock Flow
updateStockBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!currentPartnerDocId) return;
        
        const newStatus = e.currentTarget.dataset.status;
        
        try {
            const docRef = doc(db, 'distributors', currentPartnerDocId);
            await setDoc(docRef, {
                stock_status: newStatus,
                last_updated: serverTimestamp(),
                updated_by: 'partner',
                conflict_flag: false
            }, { merge: true });
            
            feedbackEl.style.opacity = '1';
            setTimeout(() => { feedbackEl.style.opacity = '0'; }, 3000);
            
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Could not update status. Please try again.");
        }
    });
});

// Auto-save toggles when changed
async function saveToggles() {
    if (!currentPartnerDocId) return;
    
    const selectedTypes = Array.from(typeToggles)
        .filter(t => t.checked)
        .map(t => t.value);
        
    try {
        const docRef = doc(db, 'distributors', currentPartnerDocId);
        await setDoc(docRef, {
            walk_in: walkinToggle.checked,
            upi: upiToggle.checked,
            types: selectedTypes
        }, { merge: true });
        
        feedbackEl.textContent = "Details updated successfully!";
        feedbackEl.style.opacity = '1';
        setTimeout(() => { feedbackEl.style.opacity = '0'; }, 3000);
    } catch (error) {
        console.error("Failed to update toggles:", error);
    }
}

walkinToggle.addEventListener('change', saveToggles);
upiToggle.addEventListener('change', saveToggles);
typeToggles.forEach(t => t.addEventListener('change', saveToggles));
