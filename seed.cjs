const admin = require('firebase-admin');
const fs = require('fs');

// IMPORTANT: Replace this with the path to your actual service account key JSON file
// Downloaded from Firebase Console -> Project Settings -> Service Accounts
const serviceAccountPath = './serviceAccountKey.json';

// Initialize Firebase Admin (Only runs if the key exists)
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('⚠️ WARNING: serviceAccountKey.json not found.');
  console.log('This script will only generate the mock JSON data. It will NOT upload to Firebase.');
  console.log('To upload to Firebase, download your Service Account Key, save it in the root folder, and re-run.\n');
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

// Target Area for Seeding (e.g., coordinates for Bangalore or your target city)
const TARGET_LAT = 18.5204; // Pune
const TARGET_LNG = 73.8567;
const RADIUS_KM = 30; // How wide of an area to query

/**
 * Builds an Overpass QL query to find all amenities tagged as 'fuel' or specifically 'lpg' 
 * within a certain radius of a coordinate.
 */
function buildOverpassQuery(lat, lng, radiusKm) {
    const radiusMeters = radiusKm * 1000;
    // Overpass QL expects: (radius_in_meters, lat, lon)
    return `
        [out:json][timeout:60];
        (
          node["amenity"="fuel"]["fuel:lpg"="yes"](around:${radiusMeters},${lat},${lng});
          node["shop"="gas"](around:${radiusMeters},${lat},${lng});
          node["name"~"Gas Agency|Indane|Bharat Gas|HP Gas",i](around:${radiusMeters},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;
}

async function fetchAgenciesFromOSM() {
    console.log(`🌍 Fetching real LPG agencies within ${RADIUS_KM}km of [${TARGET_LAT}, ${TARGET_LNG}] from OpenStreetMap...`);
    
    const query = buildOverpassQuery(TARGET_LAT, TARGET_LNG, RADIUS_KM);
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        console.log(`✅ Found ${data.elements.length} raw map nodes.`);
        return processOSMData(data.elements);
    } catch (error) {
        console.error("❌ Error fetching from Overpass API:", error);
        return [];
    }
}

function processOSMData(elements) {
    const formattedDistributors = [];
    let idCounter = 100;

    elements.forEach(node => {
        if (!node.lat || !node.lon) return;

        const tags = node.tags || {};
        let name = tags.name || 'Local Gas Agency';
        let company = 'Independent';

        // Try to infer the oil company from the name
        const nameLower = name.toLowerCase();
        if (nameLower.includes('indane')) company = 'Indane';
        else if (nameLower.includes('bharat')) company = 'Bharat Gas';
        else if (nameLower.includes('hp')) company = 'HP Gas';

        // Create a structured document matching our Firestore schema
        const distributorDoc = {
            name: name,
            oil_company: company,
            lat: node.lat,
            lng: node.lon,
            stock_status: 'unknown', // Default for a new seed
            last_updated: null,
            updated_by: null,
            conflict_flag: false,
            phone: tags.phone || tags['contact:phone'] || null,
            views_today: 0,
            walk_in: true,
            delivery: true,
            upi: true,
            cash: true,
            types: ['14.2kg', '19kg'], // Default assumptions
            osm_id: node.id // Keep a reference to the source
        };

        formattedDistributors.push(distributorDoc);
        idCounter++;
    });

    return formattedDistributors;
}

async function uploadToFirestore(distributors) {
    if (!db) return;

    const collectionRef = db.collection('distributors');

    // Remove the deletion code to keep appending to the DB
    console.log(`\n🚀 Appending ${distributors.length} agencies to Firebase Firestore...`);
    let successCount = 0;

    // Upload in batches to avoid overwhelming the free tier rate limits
    for (const dist of distributors) {
        try {
            // We use add() to auto-generate a secure random document ID
            await collectionRef.add(dist);
            successCount++;
            process.stdout.write(`\rProgress: ${successCount}/${distributors.length}`);
        } catch (error) {
            console.error(`\n❌ Failed to upload ${dist.name}:`, error);
        }
    }
    
    console.log(`\n🎉 Successfully seeded ${successCount} distributors to Firestore!`);
}

async function run() {
    const distributors = await fetchAgenciesFromOSM();
    
    if (distributors.length === 0) {
        console.log("No agencies found. Try expanding the radius or changing the coordinates.");
        return;
    }

    // Always save a local copy as a backup/reference
    fs.writeFileSync('seeded_agencies_backup.json', JSON.stringify(distributors, null, 2));
    console.log(`\n💾 Saved ${distributors.length} agencies to local file: seeded_agencies_backup.json`);

    if (db) {
        await uploadToFirestore(distributors);
    } else {
        console.log("\n⚠️ Skipping Firebase upload. Please configure serviceAccountKey.json to push this data live.");
    }
}

// Execute the script
run();