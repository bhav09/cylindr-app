import { db, collection, addDoc, serverTimestamp } from './firebase.js';

const form = document.getElementById('register-form');
const locationBtn = document.getElementById('get-location-btn');
const locationStatus = document.getElementById('location-status');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-message');
const regCard = document.getElementById('registration-card');
const successCard = document.getElementById('success-card');

// OTP Elements
const sendOtpBtn = document.getElementById('send-otp-btn');
const otpRequestArea = document.getElementById('otp-request-area');
const otpVerifyArea = document.getElementById('otp-verify-area');
const otpSuccessArea = document.getElementById('otp-success-area');
const otpInput = document.getElementById('otp-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const otpTimerEl = document.getElementById('otp-timer');

// Honeypot Element
const honeypotInput = document.getElementById('website');

let agencyLocation = null;
let phoneVerified = false;
let generatedOtp = null;
let otpTimerInterval = null;
let formOpenedAt = Date.now(); // Track time spent on form (bots submit instantly)

// Rate limiting: prevent spamming from the same browser
const RATE_LIMIT_KEY = 'cylindr_reg_attempts';
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit() {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        if (!raw) return true;
        const data = JSON.parse(raw);
        // Clean up old entries
        const recent = data.filter(ts => (Date.now() - ts) < RATE_LIMIT_WINDOW_MS);
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
        return recent.length < MAX_ATTEMPTS;
    } catch {
        return true;
    }
}

function recordAttempt() {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        const data = raw ? JSON.parse(raw) : [];
        data.push(Date.now());
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    } catch {
        // Fail silently
    }
}

// Sanitize text input to strip any HTML/script injection attempts
function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.trim();
}

// Generate a 6-digit OTP (client-side simulation)
// In production, this should be done server-side via Firebase Cloud Functions + SMS API
function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// --- OTP Flow ---
sendOtpBtn.addEventListener('click', () => {
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value.trim();

    if (!phone || phone.length < 10) {
        showError("Please enter a valid phone number first.");
        return;
    }

    // Generate and "send" OTP
    generatedOtp = generateOtp();
    
    // In a real production app, you would call a Cloud Function here:
    // await fetch('/api/send-otp', { method: 'POST', body: JSON.stringify({ phone }) })
    // For now, we simulate it client-side and show the OTP in an alert
    alert(`📱 Verification code sent to ${phone}\n\n(Demo mode: Your code is ${generatedOtp})`);

    otpRequestArea.style.display = 'none';
    otpVerifyArea.style.display = 'block';
    otpInput.focus();

    // Start countdown timer (5 minutes)
    let secondsLeft = 300;
    otpTimerInterval = setInterval(() => {
        secondsLeft--;
        const mins = Math.floor(secondsLeft / 60);
        const secs = String(secondsLeft % 60).padStart(2, '0');
        otpTimerEl.innerHTML = `Code valid for <strong>${mins}:${secs}</strong>`;
        
        if (secondsLeft <= 0) {
            clearInterval(otpTimerInterval);
            generatedOtp = null;
            otpTimerEl.textContent = 'Code expired. Please request a new one.';
            otpVerifyArea.style.display = 'none';
            otpRequestArea.style.display = 'block';
        }
    }, 1000);
});

verifyOtpBtn.addEventListener('click', () => {
    const entered = otpInput.value.trim();
    
    if (!entered || entered.length !== 6) {
        showError("Please enter the full 6-digit code.");
        return;
    }

    if (entered === generatedOtp) {
        phoneVerified = true;
        clearInterval(otpTimerInterval);
        otpVerifyArea.style.display = 'none';
        otpSuccessArea.style.display = 'block';
        hideError();
        checkSubmitReady();
    } else {
        showError("Invalid code. Please check and try again.");
    }
});

// --- Location ---
locationBtn.addEventListener('click', () => {
    if ('geolocation' in navigator) {
        locationBtn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Acquiring...';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                agencyLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                locationBtn.style.display = 'none';
                locationStatus.style.display = 'block';
                checkSubmitReady();
            },
            (error) => {
                console.error("Location error:", error);
                locationBtn.innerHTML = '<span class="material-icons-round">my_location</span> Get Current Location';
                alert("Could not get location. Please ensure location permissions are enabled.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
});

// Enable Submit only when both location AND phone are verified
function checkSubmitReady() {
    submitBtn.disabled = !(agencyLocation && phoneVerified);
}

// --- Form Submission ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // --- Anti-Bot Checks ---
    
    // 1. Honeypot check: if the invisible field was filled, it's a bot
    if (honeypotInput && honeypotInput.value) {
        // Silently accept but don't actually submit (shadow-reject)
        regCard.classList.add('hidden');
        successCard.classList.remove('hidden');
        console.warn("Honeypot triggered - submission silently rejected.");
        return;
    }

    // 2. Time-on-page check: real humans take at least 15 seconds to fill a form
    const timeSpentMs = Date.now() - formOpenedAt;
    if (timeSpentMs < 15000) {
        // Too fast, likely a bot
        regCard.classList.add('hidden');
        successCard.classList.remove('hidden');
        console.warn("Speed check triggered - submission silently rejected.");
        return;
    }

    // 3. Rate limiting: max 3 submissions per hour from the same browser
    if (!checkRateLimit()) {
        showError("You have submitted too many registrations recently. Please try again later.");
        return;
    }
    
    // 4. Location must be acquired
    if (!agencyLocation) {
        showError("Please acquire your location first.");
        return;
    }

    // 5. Phone must be verified
    if (!phoneVerified) {
        showError("Please verify your phone number first.");
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    hideError();
    
    const name = sanitize(document.getElementById('agency-name').value.trim());
    const oilCompany = document.getElementById('company').value;
    const dealerCode = sanitize(document.getElementById('dealer-code').value.trim());
    const phone = sanitize(document.getElementById('phone').value.trim());
    const email = sanitize(document.getElementById('email').value.trim());

    // Validate input lengths
    if (!name || name.length > 100) {
        showError("Agency name is required and must be under 100 characters.");
        resetSubmitBtn();
        return;
    }

    if (!dealerCode || dealerCode.length > 30) {
        showError("Dealer code is required and must be under 30 characters.");
        resetSubmitBtn();
        return;
    }

    if (!oilCompany) {
        showError("Please select your oil company.");
        resetSubmitBtn();
        return;
    }
    
    const data = {
        name: name,
        oil_company: oilCompany,
        dealer_code: dealerCode,
        phone: phone,
        email: email,
        lat: agencyLocation.lat,
        lng: agencyLocation.lng,
        phone_verified: true,
        status: 'pending_review', // Explicitly mark as needing manual review
        created_at: serverTimestamp()
    };
    
    try {
        await addDoc(collection(db, 'pending_partners'), data);
        recordAttempt();
        
        regCard.classList.add('hidden');
        successCard.classList.remove('hidden');
    } catch (error) {
        console.error("Error submitting registration:", error);
        showError("An error occurred. Please try again later.");
        resetSubmitBtn();
    }
});

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}

function hideError() {
    errorMsg.style.display = 'none';
}

function resetSubmitBtn() {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Registration";
}
