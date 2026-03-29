const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// 1. DYNAMIC MAP SCRAPER (Called when a user opens the app in a new location)
exports.fetchLocalAgencies = functions.https.onCall(async (data, context) => {
    const { lat, lng, radiusKm = 10 } = data;

    if (!lat || !lng) {
        throw new functions.https.HttpsError('invalid-argument', 'Latitude and Longitude are required.');
    }

    console.log(`Checking for agencies near ${lat}, ${lng} within ${radiusKm}km...`);

    // Check if we already have data in this area to avoid spamming the Overpass API
    // (A simple bounding box check in Firestore)
    const latOffset = radiusKm / 111.0;
    const lngOffset = radiusKm / (111.0 * Math.cos(lat * (Math.PI / 180.0)));

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
    const radiusMeters = radiusKm * 1000;
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

            const docRef = db.collection('distributors').doc(); // Auto-generate ID
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

// 2. INCREMENT VIEWS CLOUD FUNCTION
exports.incrementAgencyViews = functions.https.onCall(async (data, context) => {
    const { distributorId } = data;
    if (!distributorId) return null;

    const docRef = db.collection('distributors').doc(distributorId);
    
    try {
        await docRef.update({
            views_today: admin.firestore.FieldValue.increment(1)
        });
        return { success: true };
    } catch (err) {
        console.error("Failed to increment view:", err);
        return { success: false };
    }
});