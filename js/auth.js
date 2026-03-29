import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';

// App state
export let currentUser = null;
export let isPartner = false;

export function initAuth() {
    return new Promise((resolve) => {
        // Safety timeout: if Firebase never responds, resolve anyway so the app isn't blocked
        const timeout = setTimeout(() => {
            console.warn("Auth timed out - proceeding without authentication");
            resolve(null);
        }, 5000);

        try {
            onAuthStateChanged(auth, async (user) => {
                clearTimeout(timeout);
                if (user) {
                    currentUser = user;
                    isPartner = !user.isAnonymous;
                    resolve(user);
                } else {
                    if (!window.location.pathname.includes('partner.html') && !window.location.pathname.includes('register.html')) {
                        try {
                            await signInAnonymously(auth);
                        } catch (error) {
                            console.warn("Anonymous auth failed (expected with placeholder config):", error.message);
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }
            });
        } catch (error) {
            clearTimeout(timeout);
            console.warn("Auth setup failed:", error.message);
            resolve(null);
        }
    });
}
