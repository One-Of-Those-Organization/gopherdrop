// ==========================================
// Constants and Imports
// ==========================================
import { bufferToBase64, base64ToBuffer, generateKeyPair, initDeviceID, savePrivateKey, importPrivateKey } from './helper.js';

// LocalStorage Keys
const STORAGE_KEYS = {
    PRIVATE_KEY: 'gdrop_private_key',
    PUBLIC_KEY: 'gdrop_public_key',
    DEVICE_ID: 'gdrop_device_id'
};

// API Endpoints
const API_BASE = 'http://localhost:8080/api/v1'; // Adjust to match your Go server port/address
const ENDPOINTS = {
    REGISTER: `${API_BASE}/register`, // Generate new user/device
    CHALLENGE: `${API_BASE}/challenge`, // Provide challenge for signing
    LOGIN: `${API_BASE}/login` // Sign challenge to authenticate
};

// ==========================================
// Authentication Functions
// ==========================================
async function signChallenge(challengeBase64, privateKey) {
    const challengeBytes = base64ToBuffer(challengeBase64);
    const signature = await window.crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        challengeBytes
    );
    return bufferToBase64(signature);
}

function getPrivateKey() {
    return localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
}

function getPublicKey() {
    return localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
}

function getDeviceName() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
}

function isRegistered() {
    const hasPrivateKey = getPrivateKey();
    const hasDeviceID = getDeviceName();
    return hasPrivateKey && hasDeviceID;
}

// ==========================================
// Logout Function
// ==========================================
function clearCredentials() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    console.log('[Auth] All credentials cleared');
}

// Export getToken function
export function getToken() {
    return localStorage.getItem('gdrop_token'); // Or manage in memory
}

// ==========================================
// Core Login Logic
// ==========================================
export async function performLogin() {
    const publicKey = getPublicKey();
    const privateKey = getPrivateKey();

    if (!publicKey || !privateKey) {
        console.warn('[Auth] Missing credentials for login');
        return {
            success: false,
            error: 'No stored credentials'
        };
    }

    try {
        console.log('[Auth] Starting login...');
        // 1. Get Challenge from server
        const challengeRes = await fetch(ENDPOINTS.CHALLENGE);
        const challengeData = await challengeRes.json();
        const challengeBase64 = challengeData.data;

        // 2. Sign the challenge
        const importedKey = await importPrivateKey();
        const signature = await signChallenge(challengeBase64, importedKey);

        // 3. Send login request
        const loginRes = await fetch(ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                public_key: publicKey,
                challenge: challengeBase64,
                signature: signature
            })
        });

        const loginData = await loginRes.json();

        // Store token globally or in storage for WebSocket use
        if (loginData.success && loginData.data && loginData.data.token) {
            localStorage.setItem('gdrop_token', loginData.data.token);
            // Trigger global event that auth is ready
            console.log('[Auth] Login successful. Token saved.');
            window.dispatchEvent(new CustomEvent('gdrop:auth-ready', { detail: { token: loginData.data.token } }));
        } else {
            console.warn('[Auth] Login failed or no token returned:', loginData);
        }

        return { success: loginRes.ok, data: loginData };
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// DOM Content Loaded Initialization with Auto-Registration
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    let privateKey = getPrivateKey();
    let deviceID = getDeviceName();

    // Kalau belum ada kunci, generate dan registrasi
    if (!privateKey || !deviceID) {
        try {
            const generatedKeyPair = await generateKeyPair();
            await savePrivateKey(generatedKeyPair);

            const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', generatedKeyPair.publicKey);
            const publicKeyBase64 = bufferToBase64(publicKeyBuffer);
            localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKeyBase64);

            await initDeviceID();

            const registerRes = await fetch(ENDPOINTS.REGISTER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: getDeviceName(),
                    public_key: publicKeyBase64
                })
            });

            if (registerRes.ok) {
                console.log('[Auth] Registration successful via API. Now logging in...');
                await performLogin();
            } else {
                console.error('[Auth] Registration API returned error', await registerRes.text());
            }

        } catch (e) {
            console.error('[Auth] Registration process failed:', e);
        }
    } else {
        // Already registered, just login
        await performLogin();
    }
});
