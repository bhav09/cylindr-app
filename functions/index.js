const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// 1. DYNAMIC MAP SCRAPER
// Requires authentication. Validates coordinates are inside India.
// Rate-limited: skips if data already exists in the region.
// ============================================================
exports.fetchLocalAgencies = functions.https.onCall(async (data, context) => {
    // AUTH CHECK: Must be a logged-in user
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be signed in to use this feature.'
        );
    }

    const { lat, lng, radiusKm = 10 } = data;

    // INPUT VALIDATION: lat/lng must be numbers
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Latitude and Longitude must be numbers.');
    }

    // GEO VALIDATION: Must be inside India's bounding box
    if (lat < 6.0 || lat > 36.0 || lng < 68.0 || lng > 98.0) {
        throw new functions.https.HttpsError('invalid-argument', 'Coordinates must be within India.');
    }

    // RADIUS VALIDATION: Clamp to prevent absurdly large queries
    const safeRadius = Math.min(Math.max(radiusKm, 1), 30);

    console.log(`[fetchLocalAgencies] User ${context.auth.uid} requesting near ${lat}, ${lng} within ${safeRadius}km`);

    // Check if we already have data in this area to avoid spamming the Overpass API
    const latOffset = safeRadius / 111.0;
    const lngOffset = safeRadius / (111.0 * Math.cos(lat * (Math.PI / 180.0)));

    const snapshot = await db.collection('distributors')
        .where('lat', '>=', lat - latOffset)
        .where('lat', '<=', lat + latOffset)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        console.log("Data already exists in this region. Skipping scrape.");
        return { status: 'cached_data_exists' };
    }

    console.log("No data found. Triggering Overpass API scrape...");

    // Build the Overpass Query
    const radiusMeters = safeRadius * 1000;
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="fuel"]["fuel:lpg"="yes"](around:${radiusMeters},${lat},${lng});
          node["shop"="gas"](around:${radiusMeters},${lat},${lng});
          node["name"~"Gas Agency|Indane|Bharat Gas|HP Gas",i](around:${radiusMeters},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        
        let addedCount = 0;
        const batch = db.batch();

        for (const node of result.elements) {
            if (!node.lat || !node.lon) continue;

            const tags = node.tags || {};
            let name = tags.name || 'Local Gas Agency';
            let company = 'Independent';

            const nameLower = name.toLowerCase();
            if (nameLower.includes('indane')) company = 'Indane';
            else if (nameLower.includes('bharat')) company = 'Bharat Gas';
            else if (nameLower.includes('hp')) company = 'HP Gas';

            // Check if this specific OSM node already exists to prevent duplicates
            const existingQuery = await db.collection('distributors').where('osm_id', '==', node.id).get();
            if (!existingQuery.empty) continue;

            const docRef = db.collection('distributors').doc();
            batch.set(docRef, {
                name: name,
                oil_company: company,
                lat: node.lat,
                lng: node.lon,
                stock_status: 'unknown',
                last_updated: null,
                updated_by: null,
                conflict_flag: false,
                phone: tags.phone || tags['contact:phone'] || null,
                views_today: 0,
                walk_in: true,
                delivery: true,
                upi: true,
                cash: true,
                types: ['14.2kg', '19kg'],
                osm_id: node.id
            });
            addedCount++;

            // Firestore batches max out at 500 operations
            if (addedCount >= 490) break; 
        }

        if (addedCount > 0) {
            await batch.commit();
        }

        console.log(`Successfully scraped and added ${addedCount} new agencies.`);
        return { status: 'success', added: addedCount };

    } catch (error) {
        console.error("Scraping failed:", error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch map data.');
    }
});

// ============================================================
// 2. INCREMENT VIEWS — Secured
// Requires authentication. Validates distributorId format.
// ============================================================
exports.incrementAgencyViews = functions.https.onCall(async (data, context) => {
    // AUTH CHECK
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be signed in to use this feature.'
        );
    }

    const { distributorId } = data;

    // INPUT VALIDATION: distributorId must be a non-empty string of reasonable length
    if (!distributorId || typeof distributorId !== 'string' || distributorId.length > 128) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid distributor ID.');
    }

    const docRef = db.collection('distributors').doc(distributorId);
    
    try {
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Distributor not found.');
        }

        await docRef.update({
            views_today: admin.firestore.FieldValue.increment(1)
        });
        return { success: true };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error("Failed to increment view:", err);
        return { success: false };
    }
});