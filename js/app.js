import { db, collection, onSnapshot, query } from './firebase.js';
import { initAuth } from './auth.js';
import { scoreDistributors } from './score.js';
import { handleReport } from './reports.js';
import { generateShareLink } from './share.js';
import { translations } from './i18n.js';

let map;
let markers = {};
let userLocation = null;
let currentSelectedDistributor = null;
let currentFilter = 'all';
let currentLang = 'en';
let rawDistributors = []; // Store them so we can re-filter without fetching
let tileLayer = null; // Store tile layer to update language

// DOM Elements
const bottomSheet = document.getElementById('bottom-sheet');
const sheetHandle = document.querySelector('.sheet-handle');
const recenterBtn = document.getElementById('recenter-btn');
const btnDirections = document.getElementById('btn-directions');
const btnShare = document.getElementById('btn-share');
const btnNotify = document.getElementById('btn-notify');
const reportBtns = document.querySelectorAll('.report-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const filterChips = document.querySelectorAll('.filter-chip');
const langSelect = document.getElementById('lang-select');

async function init() {
    const userType = localStorage.getItem('cylindr_user_type');
    const welcomeOverlay = document.getElementById('welcome-overlay');

    if (!userType) {
        welcomeOverlay.classList.remove('hidden');
        setupWelcomeScreen();
        return; // Wait for user choice before initializing heavy map/location
    }

    startApp();
}

function setupWelcomeScreen() {
    const btnConsumer = document.getElementById('btn-consumer');
    const btnDistributor = document.getElementById('btn-distributor');
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const loadingOverlay = document.getElementById('loading-overlay');

    btnConsumer.addEventListener('click', () => {
        localStorage.setItem('cylindr_user_type', 'consumer');
        welcomeOverlay.style.opacity = '0';
        // Show loading screen while map inits behind the scenes
        if(loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '1';
        }
        setTimeout(() => {
            welcomeOverlay.classList.add('hidden');
            startApp();
        }, 400);
    });

    btnDistributor.addEventListener('click', () => {
        localStorage.setItem('cylindr_user_type', 'distributor');
        window.location.href = 'partner.html'; // Redirect to partner portal
    });
}

function startApp() {
    initMap();
    applyTranslations();
    
    // We start auth in the background, but immediately trigger location fetching.
    // The loading screen will stay up until location is found AND mock pins are drawn.
    getUserLocation();
    setupEventListeners();

    initAuth().catch(err => console.warn('Auth init skipped:', err));
}

function applyTranslations() {
    const dict = translations[currentLang];
    
    // Simple text replacement for data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') el.placeholder = dict[key];
            else el.textContent = dict[key];
        }
    });

    // Special formats (e.g. checkedToday)
    const viewsEl = document.getElementById('sheet-views-count-text');
    if (viewsEl && currentSelectedDistributor) {
        let text = dict['checkedToday'].replace('{n}', `<strong id="sheet-views-count">${currentSelectedDistributor.views_today || 0}</strong>`);
        viewsEl.innerHTML = text;
    }
}

function initMap() {
    // Default to a 1km radius zoom level (Zoom level 15) 
    // A desperate user wants to see what's immediately around them.
    map = L.map('map', { zoomControl: false }).setView([12.9352, 77.6245], 15);
    
    // Move zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(map);
    
    // Initialize with English tiles
    setMapLanguage(currentLang);
}

function setMapLanguage(lang) {
    if (tileLayer) {
        map.removeLayer(tileLayer);
    }
    // Using Google Maps tiles to support all native Indian scripts for street names.
    // hl= language code
    // s.e:l.i|p.v:off -> Hides ALL Google map icons (shops, hospitals, landmarks, transit, etc)
    // s.e:l.t.f|p.c:#ffe0e0e0 -> Makes all text labels (cities, areas) an extremely dull/faint light grey
    // s.e:l.t.s|p.c:#ffffffff -> Pure white stroke around text for subtle readability
    // s.t:2|p.v:off,s.t:3|p.v:off -> Hides POI and transit geometries entirely
    const apiStyle = 's.e:l.i|p.v:off,s.e:l.t.f|p.c:#ffe0e0e0,s.e:l.t.s|p.c:#ffffffff,s.t:2|p.v:off,s.t:3|p.v:off';
    tileLayer = L.tileLayer(`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=${lang}&apistyle=${apiStyle}`, {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    }).addTo(map);
}

// Check if coordinates are roughly within India's bounding box
function isInsideIndia(lat, lng) {
    return lat >= 6.0 && lat <= 36.0 && lng >= 68.0 && lng <= 98.0;
}

function getUserLocation(forceRefresh = false) {
    // Check if we have a fresh cached location to avoid slow GPS API calls on every reload
    if (!forceRefresh) {
        const cachedLoc = localStorage.getItem('lpg_user_location');
        if (cachedLoc) {
            const parsed = JSON.parse(cachedLoc);
            const isFresh = (Date.now() - parsed.timestamp) < (10 * 60 * 1000); // 10 minutes TTL
            
            if (isFresh) {
                if (!isInsideIndia(parsed.lat, parsed.lng)) {
                    handleOutsideIndia();
                    return;
                }
                userLocation = { lat: parsed.lat, lng: parsed.lng };
                renderUserLocationMarker();
                listenToDistributors();
                return; // Skip the native GPS call
            }
        }
    }

    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                if (!isInsideIndia(lat, lng)) {
                    handleOutsideIndia();
                    return;
                }

                userLocation = { lat, lng };
                
                // Save to cache with timestamp
                localStorage.setItem('lpg_user_location', JSON.stringify({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    timestamp: Date.now()
                }));
                
                renderUserLocationMarker();
                listenToDistributors();
            },
            (error) => {
                console.warn('Geolocation error:', error);
                handleLocationError();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } // Use browser cache too
        );
    } else {
        // Fallback for browsers that do not support geolocation
        handleLocationError();
    }
}

function handleOutsideIndia() {
    alert("🌍 Cylindr is currently only available for locations within India. We've centered the map on Bangalore so you can see how the app works.");
    map.setView([12.9352, 77.6245], 15); 
    listenToDistributors(); 
}

function handleLocationError() {
    // Fallback to a default city if needed, e.g., Bangalore at 1km zoom
    map.setView([12.9352, 77.6245], 15); 
    listenToDistributors(); 
}

function renderUserLocationMarker() {
    // Clear any existing user marker before adding a new one
    if (window.userMarker) {
        map.removeLayer(window.userMarker);
    }

    // Set to zoom level 15 (approx 1km radius)
    map.setView([userLocation.lat, userLocation.lng], 15);
    
    // Add user marker using a custom div icon with CSS animation
    window.userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
            className: 'my-location-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10] // Center the pulse dot perfectly on the coordinates
        }),
        zIndexOffset: 1000 // Ensure the blue dot stays on top of other pins
    }).addTo(map);
}

function createCustomIcon(status, hasConflict) {
    let statusClass = 'unknown';
    if (status === 'available') statusClass = 'available';
    else if (status === 'low') statusClass = 'low';
    else if (status === 'out') statusClass = 'out';

    let html = `<div class="marker-pin ${statusClass}"><span class="material-icons-round">propane_tank</span></div>`;
    if (hasConflict) {
        html += `<div class="warning-badge">!</div>`;
    }

    return L.divIcon({
        className: 'custom-div-icon',
        html: html,
        iconSize: [44, 44],
        iconAnchor: [22, 22] // Center of the circle
    });
}

function listenToDistributors() {
    const q = query(collection(db, "distributors"));
    onSnapshot(q, (snapshot) => {
        const distributors = [];
        snapshot.forEach((doc) => {
            distributors.push({ id: doc.id, ...doc.data() });
        });
        rawDistributors = distributors;
        renderFilteredMap();
    });
}

function renderFilteredMap() {
    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    let filtered = rawDistributors;
    if (currentFilter !== 'all') {
        filtered = rawDistributors.filter(d => d.types && d.types.includes(currentFilter));
    }

    filtered.forEach(dist => updateMarker(dist));

    if (userLocation) {
        const bestOption = scoreDistributors(filtered, userLocation);
        showRecommendation(bestOption);
    } else {
        const bestOption = scoreDistributors(filtered, {lat: 12.9352, lng: 77.6245});
        showRecommendation(bestOption);
    }

    // Hide the loading overlay once pins are successfully drawn to the map
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 400);
    }
}

function updateMarker(distributor) {
    const { id, lat, lng, stock_status, conflict_flag, name } = distributor;
    
    if (!lat || !lng) return;

    if (markers[id]) {
        map.removeLayer(markers[id]);
    }

    const marker = L.marker([lat, lng], {
        icon: createCustomIcon(stock_status, conflict_flag)
    }).addTo(map);

    marker.on('click', () => {
        openBottomSheet(distributor);
    });

    markers[id] = marker;
}

function openBottomSheet(distributor) {
    currentSelectedDistributor = distributor;
    
    document.getElementById('sheet-title').textContent = distributor.name || 'Unknown Agency';
    document.getElementById('sheet-company').textContent = distributor.oil_company || 'Gas Agency';
    
    const badge = document.getElementById('sheet-status-badge');
    badge.textContent = distributor.stock_status ? distributor.stock_status.toUpperCase() : 'UNKNOWN';
    badge.className = `status-badge ${distributor.stock_status || 'unknown'}`;
    
    // Format last updated
    const updatedEl = document.getElementById('sheet-last-updated');
    if (distributor.last_updated) {
        // Handle Firestore timestamp
        const date = distributor.last_updated.toDate ? distributor.last_updated.toDate() : new Date(distributor.last_updated);
        const now = new Date();
        const diffMins = Math.round((now - date) / 60000);
        
        if (diffMins < 60) {
            updatedEl.textContent = `Updated: ${diffMins} mins ago`;
        } else {
            const hours = Math.round(diffMins / 60);
            updatedEl.textContent = `Updated: ${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
    } else {
        updatedEl.textContent = 'Updated: N/A';
    }
    
    // Distance
    const distanceEl = document.getElementById('sheet-distance');
    if (userLocation && distributor.lat && distributor.lng) {
        const distKm = getDistanceFromLatLonInKm(
            userLocation.lat, userLocation.lng, 
            distributor.lat, distributor.lng
        );
        distanceEl.textContent = `Distance: ${distKm.toFixed(1)} km`;
    } else {
        distanceEl.textContent = 'Distance: -- km';
    }

    // Phone Number logic
    const phoneContainer = document.getElementById('sheet-phone-container');
    const phoneEl = document.getElementById('sheet-phone');
    if (distributor.phone) {
        phoneContainer.classList.remove('hidden');
        phoneEl.href = `tel:${distributor.phone}`;
        // Track call intent if clicked
        phoneEl.onclick = () => logAnalytics(distributor.id, 'call_tap');
    } else {
        phoneContainer.classList.add('hidden');
    }

    // Views Today logic
    const viewsCountEl = document.getElementById('sheet-views-count');
    viewsCountEl.textContent = distributor.views_today || 0;
    
    // Feature Badges
    const badgeWalkin = document.getElementById('badge-walkin');
    const badgeDelivery = document.getElementById('badge-delivery');
    const badgeUpi = document.getElementById('badge-upi');
    const badgeCash = document.getElementById('badge-cash');
    
    // Default to true if undefined
    const isWalkin = distributor.walk_in !== false; 
    const isUpi = distributor.upi !== false;
    
    badgeWalkin.style.display = isWalkin ? 'flex' : 'none';
    badgeDelivery.style.display = !isWalkin ? 'flex' : 'none';
    badgeUpi.style.display = isUpi ? 'flex' : 'none';
    badgeCash.style.display = !isUpi ? 'flex' : 'none';

    // Notify Me Button visibility
    if (distributor.stock_status === 'out' || distributor.stock_status === 'unknown') {
        btnNotify.classList.remove('hidden');
    } else {
        btnNotify.classList.add('hidden');
    }

    bottomSheet.classList.remove('hidden');
    
    // Hide legend while bottom sheet is open so it doesn't get squished or look messy
    document.getElementById('map-legend').style.opacity = '0';
    
    // Log that this agency was viewed (checked)
    logAnalytics(distributor.id, 'agency_viewed');
    
    // Reset report buttons state
    reportBtns.forEach(btn => btn.classList.remove('active'));
}

function closeBottomSheet() {
    bottomSheet.classList.add('hidden');
    currentSelectedDistributor = null;
    
    // Bring legend back when bottom sheet closes
    document.getElementById('map-legend').style.opacity = '1';
}

function setupEventListeners() {
    // Map click closes bottom sheet
    map.on('click', closeBottomSheet);
    
    // Bottom sheet drag down to close (simple implementation)
    sheetHandle.addEventListener('click', closeBottomSheet);
    
    // Language Selection
    langSelect.addEventListener('change', (e) => {
        currentLang = e.target.value;
        applyTranslations();
        setMapLanguage(currentLang);
    });

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter;
            renderFilteredMap();
        });
    });

    // Notify Me
    btnNotify.addEventListener('click', async () => {
        if (!currentSelectedDistributor) return;
        
        // Mocking the native push notification permission request
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                alert(`🔔 You will be notified when ${currentSelectedDistributor.name} gets stock. (Free PWA push notification)`);
            } else {
                alert("You need to allow notifications to receive alerts.");
            }
        } else {
            alert("Your browser doesn't support notifications, but we'll try to SMS you (mock).");
        }
    });
    
    // Force a fresh GPS location update when clicking recenter
    recenterBtn.addEventListener('click', () => {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            setTimeout(() => { loadingOverlay.style.opacity = '1'; }, 10);
        }
        getUserLocation(true);
    });
    
    // Directions
    btnDirections.addEventListener('click', () => {
        if (currentSelectedDistributor) {
            const { lat, lng } = currentSelectedDistributor;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
            // Log this action for partner analytics
            logAnalytics(currentSelectedDistributor.id, 'direction_tap');
        }
    });
    
    // Share
    btnShare.addEventListener('click', () => {
        if (currentSelectedDistributor) {
            generateShareLink(currentSelectedDistributor);
        }
    });
    
    // Reporting
    const _reportCooldowns = {};

    reportBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!currentSelectedDistributor) return;
            
            const status = e.currentTarget.dataset.status;
            const agencyId = currentSelectedDistributor.id;

            // Rate limit: max 1 report per agency per 5 minutes
            const lastReport = _reportCooldowns[agencyId];
            if (lastReport && (Date.now() - lastReport) < 5 * 60 * 1000) {
                alert("You recently submitted a report for this agency. Please wait a few minutes before reporting again.");
                return;
            }
            
            // 1. Geofencing Security Check (Must be within 500m)
            if (userLocation && currentSelectedDistributor.lat && currentSelectedDistributor.lng) {
                const distKm = getDistanceFromLatLonInKm(
                    userLocation.lat, userLocation.lng, 
                    currentSelectedDistributor.lat, currentSelectedDistributor.lng
                );
                
                if (distKm > 0.5) { // 500 meters
                    alert("📍 You must be physically near this agency (within 500m) to report its stock status. This ensures reports are accurate and prevents spam.");
                    return;
                }
            } else {
                alert("Please enable location services so we can verify you are at the agency.");
                return;
            }
            
            // Visual feedback
            reportBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // REAL FIREBASE CODE
            const success = await handleReport(currentSelectedDistributor.id, status, userLocation);
            if (!success) {
                e.currentTarget.classList.remove('active');
                alert("Failed to submit report. Please try again.");
            } else {
                _reportCooldowns[agencyId] = Date.now();
                alert(`✅ Report received! If multiple users report the same status, the map will update automatically.`);
            }
        });
    });
}

function showRecommendation(distributor) {
    const overlay = document.getElementById('recommendation-overlay');
    const content = document.getElementById('rec-body-content');
    
    if (!distributor) {
        overlay.classList.add('hidden');
        return;
    }
    
    // Use textContent for user-supplied data to prevent XSS
    content.textContent = '';
    
    const infoDiv = document.createElement('div');
    const nameEl = document.createElement('strong');
    nameEl.textContent = distributor.name;
    const scoreEl = document.createElement('p');
    scoreEl.style.cssText = 'margin: 0; font-size: 0.8rem; color: #5F6368;';
    scoreEl.textContent = `Score: ${distributor._score} \u2022 Near you`;
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(scoreEl);
    
    const badge = document.createElement('span');
    badge.className = `status-badge ${distributor.stock_status || 'unknown'}`;
    badge.textContent = distributor.stock_status === 'available' ? 'IN STOCK' : 'CHECK';
    
    content.appendChild(infoDiv);
    content.appendChild(badge);
    
    overlay.classList.remove('hidden');
    
    // Click opens the bottom sheet and pans to it
    content.onclick = () => {
        map.setView([distributor.lat, distributor.lng], 15);
        openBottomSheet(distributor);
    };
}

// Analytics tracking
import { db as analyticsDb, doc as analyticsDoc } from './firebase.js';
import { increment, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const _viewedThisSession = new Set();

async function logAnalytics(distributorId, actionType) {
    if (actionType === 'agency_viewed') {
        // Only count one view per agency per session to prevent inflating numbers
        if (_viewedThisSession.has(distributorId)) return;
        _viewedThisSession.add(distributorId);
        try {
            const docRef = analyticsDoc(analyticsDb, 'distributors', distributorId);
            await updateDoc(docRef, {
                views_today: increment(1)
            });
        } catch (e) {
            console.warn("Analytics failed:", e);
        }
    }
}

// Utility: Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1); 
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
