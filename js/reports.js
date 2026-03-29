import { db, collection, addDoc, serverTimestamp } from './firebase.js';
import { currentUser } from './auth.js';

// Max distance allowed to submit a report (in km)
const MAX_REPORT_DISTANCE_KM = 0.5;

export async function handleReport(distributorId, status, userLocation) {
    if (!currentUser) {
        console.error("User not authenticated.");
        return false;
    }

    if (!userLocation) {
        alert("Please enable location services to report stock status.");
        return false;
    }

    try {
        // Create the report
        await addDoc(collection(db, 'reports'), {
            distributor_id: distributorId,
            status: status, // 'available', 'low', 'out'
            timestamp: serverTimestamp(),
            user_id: currentUser.uid,
            lat: userLocation.lat,
            lng: userLocation.lng
        });
        
        return true;
    } catch (error) {
        console.error("Error adding report: ", error);
        return false;
    }
}
