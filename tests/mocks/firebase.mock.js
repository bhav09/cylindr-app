import { jest } from '@jest/globals';

export const app = {};
export const db = {};
export const auth = {
    onAuthStateChanged: jest.fn(),
    currentUser: { uid: 'mock-user-123', isAnonymous: true }
};

export const collection = jest.fn();
export const doc = jest.fn();
export const setDoc = jest.fn();
export const addDoc = jest.fn();
export const getDocs = jest.fn();
export const onSnapshot = jest.fn();
export const serverTimestamp = jest.fn(() => new Date());

export const signInAnonymously = jest.fn();
export const onAuthStateChanged = jest.fn();
export const signInWithEmailAndPassword = jest.fn();
export const signOut = jest.fn();
