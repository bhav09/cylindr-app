# Enhanced Task Brief (ETB): Cylindr (LPG Tracking PWA)

## 1. Project Overview
Cylindr is a crowdsourced, zero-cost Progressive Web App (PWA) designed to track LPG cylinder availability in real-time. It connects users seeking gas cylinders with distributors, using community reporting and partner updates to maintain an accurate stock map.

## 2. Tech Stack & Architecture
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Mapping:** Leaflet.js with OpenStreetMap (OSM) tiles
- **Database & Real-time Sync:** Firebase Firestore (Spark Plan -> Blaze when scaling)
- **Authentication:** Firebase Auth (Anonymous for users, Email/Password for partners)
- **Hosting:** GitHub Pages
- **Recommendation Engine:** Real-Time Heuristic Scoring (Runs in standard JavaScript, no ML models to download)
- **Serverless Logic:** Firebase Cloud Functions (Conflict detection & data aggregation)

## 3. Core Features
### User Side (Consumers)
- **Hyper-Local Location Tracking:** Instantly drops a pulsing blue dot at the user's GPS coordinates and zooms the map to a 1km walkable/drivable radius. (Includes a 10-minute TTL cache so reloads are instantaneous without firing the slow GPS API).
- **Live Stock Map & "Best Option" AI:** Pins are color-coded (🟢 In Stock, 🟡 Low, 🔴 Out). A smart heuristic engine calculates the "Best Option Right Now" based on distance, time since last update, and partner vs. crowdsourced authority.
- **Cylinder Size Filtering:** Map chips to instantly filter agencies based on specific needs: `14.2kg (Home)`, `19kg (Commercial)`, or `5kg (Mini)`.
- **Operational Intelligence:** Tells users *how* they can buy before they arrive. Shows badges for: `🚚 Delivery Only` vs `🚶‍♂️ Walk-ins`, and `💵 Cash Only` vs `📱 UPI Accepted`.
- **1-Tap Crowdsourcing (Geofenced):** Users can anonymously report stock. To prevent competitor spam, the app enforces a 500-meter GPS geofence—users must be physically standing at the agency to submit a report.
- **Free Web Push Notifications ("Alert Me"):** If an agency is empty, users can tap "Alert Me". They receive a native browser push notification the exact second the owner marks it as "In Stock" (No SMS costs).
- **Vernacular Support (i18n):** 1-tap toggle to switch the entire interface from English to Hindi, making it accessible to tier-2/tier-3 demographics.
- **WhatsApp Virality Engine:** A 1-tap share button generates a deep-link with emojis: *"🟢 LPG is In Stock at Ramesh Gas. Check near you: [link]"*

### Partner Side (Distributors/Agency Owners)
- **Frictionless Dashboard:** A mobile-friendly portal (`/partner.html`) that requires no training.
- **1-Tap Stock Updates:** 3 large buttons (In Stock / Low / Out) instantly sync to the main map for all local users.
- **Micro-CRM Controls:** Simple checkboxes to update their current operational reality: "Walk-ins Accepted?", "UPI Accepted?", and "Which cylinder sizes are in stock?".
- **Engagement Analytics:** Shows the owner their value. Metrics display exactly how many people viewed their agency today (`views_today`), and an estimated "Calls Deflected" counter to prove the app is saving them time.
- **Automated "Conflict" Accountability:** If an owner lies and clicks "In Stock" to drive foot traffic, but 3 geofenced users report "Out of Stock," the map automatically flags the agency with a ⚠️ warning, protecting the platform's integrity.
- **Self-Onboarding with GPS:** Undiscovered agencies can register themselves via a form that automatically captures their exact GPS coordinates to prevent fake map pins.

## 4. Business & Logical Error Corrections (MVP Adjustments)
During the design phase, several logical and business errors were identified in the original concept. Here is how they are fixed:

### 4.1. The ML "Malware/Download" Perception & Real-Time Sync Issue (Fixed - Removed TF.js)
- **Error:** The original plan proposed a TensorFlow.js model that users would download to their browsers. **Problem 1:** A static `.bin` model file gets outdated quickly and cannot react to a sudden 1-hour shortage spike. **Problem 2:** Users seeing random files downloading in the background of a free web app might assume it's malware, destroying trust.
- **Fix (Real-Time Heuristic Engine):** We have **removed TensorFlow.js entirely**. Instead, we will use a **Real-Time Heuristic Engine** built in standard, transparent JavaScript. 
  - *How it works:* It pulls the live data that the map is already downloading anyway. It instantly calculates a score based on: `(Time since last update) + (Partner vs User report) + (Distance)`. 
  - *Why it's better:* It's 100% real-time, requires zero background downloads, costs $0, and delivers the exact same UX ("Here is the best agency to go to right now") without the malware paranoia.

### 4.2. The Overpass API Viral Death Trap (Fixed)
- **Error:** The original plan suggested querying the free Overpass API directly from the user's browser on map load. If the app goes viral via WhatsApp, thousands of concurrent requests will result in an immediate IP ban or domain block from Overpass, breaking the app entirely.
- **Fix (Pre-seeding):** Instead of live client-side queries, we will pre-seed the Firebase Firestore database with distributor locations using a one-time offline Overpass script. The web app will ONLY query our Firestore database. If a user is in an unmapped area, they can manually add a pin, which goes into a `/pending_distributors` queue for approval.

### 4.3. The "Calls Saved" Vanity Metric (Fixed)
- **Error:** The partner dashboard promises to show "Estimated calls saved." We cannot measure phone calls that didn't happen.
- **Fix:** Redefine the metric. Track whenever a user taps "Get Directions" or expands the distributor's detail card while the status is "In Stock." Label this metric honestly in the partner portal: *"34 users viewed your stock status instead of calling you today."*

### 4.4. The Anonymous Auth Loophole (Fixed)
- **Error:** Users don't sign up. They use Firebase Anonymous Auth, which creates a UID stored in the browser. If a user clears their cache or uses Incognito mode, they get a new UID. They could spam reports repeatedly.
- **Fix:** Accept that anonymous auth is imperfect, but mitigate the impact mathematically. A distributor's status shouldn't flip based on one user. We require a **consensus threshold**: 3 conflicting reports from 3 different UIDs *and* IP addresses within 2 hours are required to flag a partner's status as a "Conflict."

## 5. Scaling Architecture (Handling High Traffic)
To ensure the app does not hit Firebase read limits or slow down when it goes viral (e.g., during a shortage), the following architectural patterns are enforced:

### 5.1. Geohashing for Bounded Queries
- **Problem:** If a user opens the app, downloading 10,000 distributors across India consumes 10,000 Firestore reads. If 5 users do this, we exhaust the free tier instantly.
- **Solution:** Implement **Geohashing** (using `geofire-common` or custom bounding boxes). The app will only query Firestore for distributors within a 5km–10km radius of the user's current GPS location or map center. This limits reads to ~20-50 documents per session.

### 5.2. Aggregation via Cloud Functions (Read Optimization)
- **Problem:** Users submitting thousands of reports will create huge read/write contention if the client calculates consensus.
- **Solution:** 
  - Clients write strictly to a `/reports` collection (Write-only).
  - A Firebase Cloud Function triggers on new reports, performs the consensus check (3 out-of-stock reports in 2 hours), and securely updates the **single** distributor document in `/distributors`.
  - Clients only listen to the `/distributors` collection. This decouples write-heavy operations from read-heavy map rendering.

### 5.3. Cache-First Read Strategies
- **Problem:** Users repeatedly moving the map around could trigger redundant queries.
- **Solution:** Configure Firestore client SDK to use `cache` first or `source: 'cache'`. Additionally, Service Workers will cache static assets (HTML, CSS, JS, Leaflet tiles) so repeated visits consume zero bandwidth on hosting.

### 5.4. Data Expiration / TTL (Time-To-Live)
- **Problem:** The `/reports` collection will grow infinitely over time, leading to storage bloat.
- **Solution:** Implement a Google Cloud Platform TTL policy on the `/reports` collection to automatically delete documents older than 24 hours (since availability reports are irrelevant after a day). 

## 6. Comprehensive Security Threat Model & Mitigations
Since this is a crowdsourced application relying on anonymous user data and free-tier infrastructure, it is inherently vulnerable to specific classes of exploits. Below is a detailed breakdown of potential vulnerabilities, how users could exploit them, and the implemented mitigations.

### 6.1. Sybil Attacks & Fake Reporting (The "Competitor Takedown" Exploit)
- **Vulnerability:** The app uses Firebase Anonymous Auth to lower friction. Anonymous accounts are tied to local storage/IndexedDB.
- **Exploitation Method:** A malicious user (or a competing gas agency) could write a script that opens the app in incognito mode, reports a target agency as "Out of Stock" (🔴), closes the browser, and repeats. This would trigger the "Conflict Detection" logic (3 out-of-stock reports in 2 hours) and artificially penalize a legitimate distributor, displaying a warning badge on their pin.
- **Mitigation Strategy:**
  - **Geofencing Reports:** Only allow a user to submit a report if their `navigator.geolocation` proves they are within a reasonable distance (e.g., 500 meters) of the distributor. This prevents someone sitting at home from downranking agencies across the city.
  - **App Check integration:** Use Firebase App Check with reCAPTCHA v3 or Google Play Integrity to ensure requests are coming from a genuine browser/device, not an automated script.
  - **Device Fingerprinting (Lightweight):** If the same IP/Device submits multiple conflicting reports within a short window, shadow-ban the reports (accept the write so the attacker thinks it worked, but exclude it from the aggregation logic).

### 6.2. Partner Privilege Escalation (The "Takeover" Exploit)
- **Vulnerability:** Partners use the same app frontend but log in via email/password.
- **Exploitation Method:** A technically savvy user might inspect the frontend JavaScript, find the Firebase Firestore write paths for partners (e.g., `db.collection('distributors').doc(id).update({ stock_status: 'available' })`), and attempt to manually execute these commands in the browser console to hijack a distributor's status.
- **Mitigation Strategy:**
  - **Firebase Custom Claims:** Do not rely on client-side state for authorization. When a partner is approved, a Firebase Admin script must assign a custom claim (`role: 'partner'`) to their Auth token.
  - **Strict Firestore Security Rules:** Ensure that updates to a distributor's primary record can only be made by the authenticated owner.

### 6.3. NoSQL Injection & Malicious Payload Execution (XSS)
- **Vulnerability:** The partner registration form and user reports accept data that is written to Firestore and subsequently displayed to other users on the map.
- **Exploitation Method:** An attacker could submit a partner registration with a malicious script in the "Agency Name" field (e.g., `<script>alert('hack')</script>`). If the frontend renders this directly, it could steal other users' sessions or deface the map.
- **Mitigation Strategy:**
  - **Strict Schema Validation in Firestore Rules:** Enforce data types and string lengths at the database level to reject malformed payloads.
  - **Frontend DOM Sanitization:** Never use `innerHTML` when displaying distributor names or reports. Always use `textContent` or rely on Leaflet's built-in text escaping for popups to neutralize any injected HTML/JS.

### 6.4. Resource Exhaustion (Firebase Free Tier Exhaustion)
- **Vulnerability:** Firebase Spark plan allows 50K reads and 20K writes per day.
- **Exploitation Method:** An attacker could write a loop to continuously read the `/distributors` collection or write to the `/reports` collection, exhausting the daily quota and causing a denial of service for legitimate users until the next billing cycle.
- **Mitigation Strategy:**
  - **Pagination and Limit Queries:** Never query the entire collection at once. Always use `.limit(50)` and bound the queries by geographic coordinates.
  - **Client-side Quota Protection:** Implement local rate-limiting (e.g., max 5 reports per device per hour) before attempting a Firestore write.
  - **Time-based Rules:** Use Firestore rules to prevent rapid successive writes from the same user ID.

## 8. Deployment & Hosting Guide (Zero Cost)
To take this application from local mock-data to a live, production-ready app that anyone in India can use, follow these exact steps. It will cost $0.

### Step 1: Set up Firebase (The Backend & Database)
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click "Add Project" (Name it `Cylindr`).
2. **Enable Firestore Database:** Go to Build -> Firestore Database -> Create Database. Start in **Production mode**. Choose a location closest to India (e.g., `asia-south1` Mumbai).
3. **Enable Authentication:** Go to Build -> Authentication -> Get Started. Enable **Email/Password** (for partners) and **Anonymous** (for users).
4. **Get your Config Keys:** Go to Project Settings (the gear icon) -> General. Scroll down to "Your apps", click the Web icon (`</>`), register the app, and copy the `firebaseConfig` object.
5. Paste this config object into `js/firebase.js` replacing the placeholder keys.

### Step 2: Set up GitHub Pages (The Frontend Hosting)
1. Create a new public repository on GitHub (e.g., `cylindr-app`).
2. Push all the local files (`index.html`, `css/`, `js/`, etc.) to the `main` branch of this repo.
3. Go to the repository **Settings** -> **Pages**.
4. Under "Source", select `Deploy from a branch`. Select the `main` branch and `/ (root)` folder. Click Save.
5. Within 2 minutes, your app will be live at `https://[your-username].github.io/cylindr-app/`.

### Step 3: Deploy Security Rules
Because this is a crowdsourced app, you must protect the database from malicious overwrites.
1. Open the Firebase Console -> Firestore Database -> **Rules**.
2. Copy the exact contents of the `firestore.rules` file from this repository and paste them there. Click **Publish**. This ensures no one can write a script to maliciously delete your agencies.

### Step 4: Map Data Seeding (The Cold Start Fix)
Right now, the app is using hardcoded mock data. You need to fill Firestore with real gas agencies so the map actually works on Day 1.
1. We have provided a Node.js data seeding script. Run `npm install firebase-admin` in your terminal.
2. Go to Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key. Save this JSON file to your project root as `serviceAccountKey.json`.
3. Create a script (e.g., `seed.js`) that uses the Overpass API to fetch real LPG distributor coordinates for your target city, and uses the Firebase Admin SDK to push them into your `/distributors` Firestore collection.
4. Once seeded, uncomment the "REAL FIREBASE CODE" blocks in `app.js`, `partner.js`, and `reports.js`, and delete the `mockDistributors` array. 

Your app is now live, fully functional, and ready for a viral WhatsApp blast in your local neighborhood!

 
 # #   W o r k   L o g 
 -   2 0 2 6 - 0 3 - 2 9   1 2 : 3 6 :   I n i t i a l i z e d   G i t ,   c o m m i t t e d   a l l   c o d e ,   a n d   p u s h e d   t o   h t t p s : / / g i t h u b . c o m / b h a v 0 9 / c y l i n d r - a p p .   A t t e m p t e d   a u t o m a t i c   P a g e s   d e p l o y m e n t   b u t   r e q u i r e s   m a n u a l   a u t h .  
 