import { jest } from '@jest/globals';
import { scoreDistributors } from '../../js/score.js';

describe('Heuristic Scoring Engine', () => {
    
    let userLocation;
    
    beforeEach(() => {
        // Base user location in Bangalore
        userLocation = { lat: 12.9352, lng: 77.6245 };
    });

    test('should rank an IN STOCK agency higher than OUT OF STOCK', () => {
        const distributors = [
            { id: '1', name: 'Agency A', stock_status: 'out', lat: 12.9352, lng: 77.6245 },
            { id: '2', name: 'Agency B', stock_status: 'available', lat: 12.9352, lng: 77.6245 }
        ];

        const best = scoreDistributors(distributors, userLocation);
        
        expect(best.id).toBe('2');
        expect(best._score).toBeGreaterThan(distributors[0]._score);
    });

    test('should heavily penalize an agency that is far away', () => {
        const distributors = [
            { id: '1', name: 'Nearby Agency', stock_status: 'available', lat: 12.9352, lng: 77.6245 }, // 0km
            { id: '2', name: 'Far Agency', stock_status: 'available', lat: 13.0, lng: 77.6 } // ~10km+ away
        ];

        const best = scoreDistributors(distributors, userLocation);
        
        expect(best.id).toBe('1');
        expect(distributors[0]._score).toBeGreaterThan(distributors[1]._score);
    });

    test('should rank partner-updated statuses higher than user reports', () => {
        const distributors = [
            { id: '1', name: 'User Reported', stock_status: 'available', updated_by: 'user', lat: 12.9352, lng: 77.6245 },
            { id: '2', name: 'Partner Reported', stock_status: 'available', updated_by: 'partner', lat: 12.9352, lng: 77.6245 }
        ];

        const best = scoreDistributors(distributors, userLocation);
        
        expect(best.id).toBe('2');
        expect(distributors[1]._score).toBeGreaterThan(distributors[0]._score);
    });

    test('should apply a penalty to distributors with a conflict flag', () => {
        const distributors = [
            { id: '1', name: 'No Conflict', stock_status: 'available', conflict_flag: false, lat: 12.9352, lng: 77.6245 },
            { id: '2', name: 'Conflict Flagged', stock_status: 'available', conflict_flag: true, lat: 12.9352, lng: 77.6245 }
        ];

        const best = scoreDistributors(distributors, userLocation);
        
        expect(best.id).toBe('1');
        expect(distributors[0]._score).toBeGreaterThan(distributors[1]._score);
    });

    test('should return null if no distributors are provided', () => {
        const best = scoreDistributors([], userLocation);
        expect(best).toBeNull();
    });

    test('should return null if no user location is provided', () => {
        const distributors = [{ id: '1', stock_status: 'available' }];
        const best = scoreDistributors(distributors, null);
        expect(best).toBeNull();
    });
});
