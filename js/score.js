// Real-Time Heuristic Scoring Engine
// Replaces the heavy TF.js model with a fast, edge-calculated score.

export function scoreDistributors(distributors, userLocation) {
    if (!distributors || distributors.length === 0 || !userLocation) return null;

    let bestDistributor = null;
    let highestScore = -Infinity;

    distributors.forEach(dist => {
        let score = 0;

        // 1. Status Base Score
        if (dist.stock_status === 'available') score += 100;
        else if (dist.stock_status === 'low') score += 50;
        else if (dist.stock_status === 'out') score -= 100;
        else score += 10; // Unknown

        // 2. Freshness Score (Decays over time)
        if (dist.last_updated) {
            const date = dist.last_updated.toDate ? dist.last_updated.toDate() : new Date(dist.last_updated);
            const hoursOld = (new Date() - date) / (1000 * 60 * 60);
            
            if (hoursOld < 1) score += 30;
            else if (hoursOld < 4) score += 15;
            else if (hoursOld > 24) score -= 20; // Stale data penalty
        }

        // 3. Authority Score
        if (dist.updated_by === 'partner') {
            score += 20; // Partner reports carry more weight
        }

        // 4. Conflict Penalty
        if (dist.conflict_flag) {
            score -= 40;
        }

        // 5. Distance Penalty (Closer is better)
        if (dist.lat && dist.lng) {
            const distKm = getDistance(userLocation.lat, userLocation.lng, dist.lat, dist.lng);
            if (distKm <= 2) score += 20;
            else if (distKm <= 5) score += 10;
            else score -= (distKm * 2); // Heavy penalty for being far away
        }

        dist._score = score; // Store for debugging/display

        if (score > highestScore && dist.stock_status === 'available') {
            highestScore = score;
            bestDistributor = dist;
        }
    });

    return bestDistributor;
}

// Haversine helper for internal use
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI/180;
    const dLon = (lon2 - lon1) * Math.PI/180; 
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}
