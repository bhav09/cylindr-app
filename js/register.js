import { db, collection, addDoc, serverTimestamp } from './firebase.js';

const form = document.getElementById('register-form');
const locationBtn = document.getElementById('get-location-btn');
const locationStatus = document.getElementById('location-status');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-message');

const regCard = document.getElementById('registration-card');
const successCard = document.getElementById('success-card');

let agencyLocation = null;

// Get Location
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
                submitBtn.disabled = false;
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

// Submit Form
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!agencyLocation) {
        errorMsg.textContent = "Please acquire your location first.";
        errorMsg.style.display = 'block';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    errorMsg.style.display = 'none';
    
    const data = {
        name: document.getElementById('agency-name').value.trim(),
        oil_company: document.getElementById('company').value,
        dealer_code: document.getElementById('dealer-code').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        lat: agencyLocation.lat,
        lng: agencyLocation.lng,
        status: 'pending',
        created_at: serverTimestamp()
    };
    
    // Basic input validation
    if (!data.name || data.name.length > 100) {
        errorMsg.textContent = "Agency name is required and must be under 100 characters.";
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Registration";
        return;
    }
    
    try {
        await addDoc(collection(db, 'pending_partners'), data);
        
        regCard.classList.add('hidden');
        successCard.classList.remove('hidden');
    } catch (error) {
        console.error("Error submitting registration:", error);
        errorMsg.textContent = "An error occurred. Please try again later.";
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Registration";
    }
});
