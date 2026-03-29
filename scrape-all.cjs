const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin 
// In GitHub Actions, we'll pass the JSON via an environment variable
let db;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
} else if (fs.existsSync('./serviceAccountKey.json')) {
  // Local fallback
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
} else {
  console.error('⚠️ CRITICAL: No Firebase credentials found. Exiting.');
  process.exit(1);
}

// Top 50 Indian Cities + Major Hubs (Lat/Lng)
const CITIES = [
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Delhi", lat: 28.6139, lng: 77.2090 },
    { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
    { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
    { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
    { name: "Surat", lat: 23.0225, lng: 72.5714 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
    { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
    { name: "Kanpur", lat: 26.8467, lng: 80.9462 },
    { name: "Nagpur", lat: 26.4499, lng: 80.3319 },
    { name: "Indore", lat: 21.1702, lng: 72.8311 },
    { name: "Thane", lat: 21.1702, lng: 72.8311 },
    { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
    { name: "Visakhapatnam", lat: 21.1458, lng: 79.0882 },
    { name: "Pimpri-Chinchwad", lat: 18.6298, lng: 73.7997 },
    { name: "Patna", lat: 26.8467, lng: 80.9462 },
    { name: "Vadodara", lat: 21.1702, lng: 72.8311 },
    { name: "Ghaziabad", lat: 26.4499, lng: 80.3319 },
    { name: "Ludhiana", lat: 26.8467, lng: 80.9462 },
    { name: "Agra", lat: 26.8467, lng: 80.9462 },
    { name: "Nashik", lat: 21.1458, lng: 79.0882 },
    { name: "Faridabad", lat: 28.4089, lng: 77.3178 },
    { name: "Meerut", lat: 26.8467, lng: 80.9462 },
    { name: "Rajkot", lat: 21.1702, lng: 72.8311 },
    { name: "Kalyan-Dombivli", lat: 19.2403, lng: 73.1305 },
    { name: "Vasai-Virar", lat: 19.3919, lng: 72.8397 },
    { name: "Varanasi", lat: 26.8467, lng: 80.9462 },
    { name: "Srinagar", lat: 26.8467, lng: 80.9462 },
    { name: "Aurangabad", lat: 20.0110, lng: 73.7903 },
    { name: "Dhanbad", lat: 25.5941, lng: 85.1376 },
    { name: "Amritsar", lat: 30.9010, lng: 75.8573 },
    { name: "Navi Mumbai", lat: 19.0330, lng: 73.0297 },
    { name: "Allahabad", lat: 26.8467, lng: 80.9462 },
    { name: "Ranchi", lat: 23.7957, lng: 86.4304 },
    { name: "Howrah", lat: 22.5958, lng: 88.3110 },
    { name: "Coimbatore", lat: 17.6868, lng: 83.2185 },
    { name: "Jabalpur", lat: 23.2599, lng: 77.4126 },
    { name: "Gwalior", lat: 23.2599, lng: 77.4126 },
    { name: "Vijayawada", lat: 16.5062, lng: 80.6480 },
    { name: "Jodhpur", lat: 26.9124, lng: 75.7873 },
    { name: "Madurai", lat: 11.0168, lng: 76.9558 },
    { name: "Raipur", lat: 23.3441, lng: 85.3096 },
    { name: "Kota", lat: 26.9124, lng: 75.7873 },
    { name: "Guwahati", lat: 26.2006, lng: 92.9376 },
    { name: "Chandigarh", lat: 31.6340, lng: 74.8723 },
    { name: "Solapur", lat: 20.0110, lng: 73.7903 },
    { name: "Hubli", lat: 15.3647, lng: 75.1240 }
];

const RADIUS_KM = 25; // 25km radius per city

// Sleep utility to prevent Overpass API rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildOverpassQuery(lat, lng, radiusKm) {
    const radiusMeters = radiusKm * 1000;
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

async function fetchAgenciesForCity(city) {
    console.log(`\n🌍 Fetching ${city.name}...`);
    
    const query = buildOverpassQuery(city.lat, city.lng, RADIUS_KM);
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        return processOSMData(data.elements);
    } catch (error) {
        console.error(`❌ Error fetching ${city.name}:`, error.message);
        return [];
    }
}

function processOSMData(elements) {
    const formattedDistributors = [];

    elements.forEach(node => {
        if (!node.lat || !node.lon) return;

        const tags = node.tags || {};
        let name = tags.name || 'Local Gas Agency';
        let company = 'Independent';

        const nameLower = name.toLowerCase();
        if (nameLower.includes('indane')) company = 'Indane';
        else if (nameLower.includes('bharat')) company = 'Bharat Gas';
        else if (nameLower.includes('hp')) company = 'HP Gas';

        formattedDistributors.push({
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
    });

    return formattedDistributors;
}

async function uploadToFirestore(distributors) {
    if (distributors.length === 0) return 0;

    const collectionRef = db.collection('distributors');
    let newAdds = 0;

    for (const dist of distributors) {
        try {
            // Check if exists to avoid duplicates
            const existing = await collectionRef.where('osm_id', '==', dist.osm_id).limit(1).get();
            
            if (existing.empty) {
                await collectionRef.add(dist);
                newAdds++;
            }
        } catch (error) {
            console.error(`❌ Failed to upload ${dist.name}:`, error.message);
        }
    }
    return newAdds;
}

async function run() {
    console.log("🚀 Starting Pan-India LPG Scraper...");

    // Step 0: Reset all views_today counters to 0 (daily reset)
    console.log("🔄 Resetting views_today counters...");
    const allDocs = await db.collection('distributors').get();
    let resetCount = 0;
    for (const doc of allDocs.docs) {
        if (doc.data().views_today > 0) {
            await doc.ref.update({ views_today: 0 });
            resetCount++;
        }
    }
    console.log(`✅ Reset views_today for ${resetCount} agencies.`);

    let totalAdded = 0;

    for (const city of CITIES) {
        const distributors = await fetchAgenciesForCity(city);
        
        if (distributors.length > 0) {
            console.log(`✅ Found ${distributors.length} nodes in ${city.name}. Uploading...`);
            const added = await uploadToFirestore(distributors);
            console.log(`➕ Added ${added} NEW agencies to database.`);
            totalAdded += added;
        } else {
            console.log(`⚠️ No data found for ${city.name}.`);
        }

        // Wait 15 seconds between cities to respect Overpass API limits
        console.log("⏳ Sleeping 15 seconds to respect rate limits...");
        await sleep(15000); 
    }

    console.log(`\n🎉 Scraping Complete! Total new agencies added today: ${totalAdded}`);
}

run();