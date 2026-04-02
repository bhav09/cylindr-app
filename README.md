# Cylindr 🔥

> Real-time LPG cylinder availability — mapped to you.

Cylindr is a community-driven Progressive Web App (PWA) that shows you which local LPG gas agencies have stock available **right now**, directly on a live map. No more calling every agency when cylinders run out. Built on Firebase, zero server cost.

🔗 **Live App:** [https://bhav09.github.io/cylindr-app/](https://bhav09.github.io/cylindr-app/)

---

## 🏠 For Consumers

| Feature | What it does |
|---|---|
| **Live Map** | See real-time LPG availability (✅ In Stock, ⚠️ Low, ❌ Out) pinned to your GPS location |
| **Smart Pick** | The app scores every nearby agency by distance, freshness, and availability — the best option floats to the top |
| **Stock Reports** | Physically near an agency? Tap to report its current status. Geo-fence verified (must be within 500m) |
| **Multi-language** | Switch the map labels to Hindi, Tamil, Telugu, Kannada, Bengali, and more |
| **Cylinder Filter** | One tap to filter by 14.2kg • 5kg • 19kg cylinder size |
| **Notify Me** | Get push alerts the moment an out-of-stock agency restocks |

---

## 🚚 For Distributors & Agency Owners

| Feature | What it does |
|---|---|
| **One-tap Status** | Update your stock status on the live map instantly — stop answering 200 calls a day |
| **Easy Onboarding** | Register your agency GPS location, oil company, and dealer code in under 60 seconds |
| **Phone Verification** | OTP verified registration ensures only genuine agency owners can list |
| **Dealer Code Check** | Your Indane / HP Gas / Bharat Gas SAP/license code is recorded for manual verification before your listing goes live |
| **Foot Traffic** | Customers who arrive are pre-filtered by payment type (UPI/Cash) and walk-in preference |

---

## 🔒 Security & Scale

- **Firestore Rules:** Server-enforced schema validation on all write paths; no raw injection possible
- **Geo-bounded Queries:** App only fetches up to 100 agencies within a 100km radius — billing quota safe under any traffic load  
- **Sharded Visitor Counter:** Global visit count spread across 5 Firestore shards to bypass write-rate limits — accurate at millions of requests/day  
- **Bot Protections:** Honeypot fields + form speed analysis on registration; rate-limited reporting (1 report/agency/5min)  
- **XSS Prevention:** All user-supplied data rendered via `textContent` / DOM construction — no `innerHTML` on untrusted data  
- **App Check Ready:** Firebase App Check (reCAPTCHA v3) is scaffolded and ready to enable when a site key is configured

---

## 🧪 Automated Testing

End-to-End tests (Playwright) cover:
- Consumer Welcome → Map navigation
- Language toggle
- Partner portal access
- Login validation
- Registration bot-protection checks  
- **Full partner onboarding** — fills form, auto-captures OTP from JS alert, verifies, waits past bot-speed-check, submits

Run tests: `npm run test:e2e`

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JavaScript (ES Modules), HTML5, CSS3, Leaflet.js |
| Backend | Firebase Firestore (realtime), Firebase Auth (anonymous + email) |
| Hosting | GitHub Pages |
| Testing | Playwright (E2E) + Jest (Unit) |
| Maps | Google Maps Tiles (multilingual) via Leaflet |