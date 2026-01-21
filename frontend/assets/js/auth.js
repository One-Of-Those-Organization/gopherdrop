// ==========================================
// Constants and Imports
// ==========================================
import { bufferToBase64, base64ToBuffer, generateKeyPair, initKeys, initDeviceID } from './helper.js';

// LocalStorage Keys
const STORAGE_KEYS = {
    PRIVATE_KEY: 'gdrop_private_key',
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

function getDeviceName() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
}

function isRegistered() {
    const hasPrivateKey = getPrivateKey();
    const hasDeviceID = getDeviceName();
    return hasPrivateKey && hasDeviceID;
}

// ==========================================
// Send to Backend Functions
// ==========================================
const publicKeyBuffer  = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
const publicKeyBase64  = bufferToBase64(publicKeyBuffer);
try {
    const response = await fetch(ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: getDeviceName(),
            public_key: publicKeyBase64
        })
    });
    console.log('[Auth] Registration response status:', response.status);
} catch (e) {
    console.error('[Auth] Registration failed:', e);
}

async function autoLogin() {
    const deviceID = getDeviceName();
    const privateKey = getPrivateKey();

    if (!deviceID || !privateKey) {
        return {
            success: false,
            error: 'No stored credentials'
        };
    }

    try {
        // 1. Get Challenge from server
        const challengeRes = await fetch(ENDPOINTS.CHALLENGE);
        const challengeData = await challengeRes.json();
        const challengeBase64 = challengeData.data;

        console.log('[Auth] Received challenge:', challengeBase64.substring(0, 20) + '...');

        // 2. Sign the challenge
        const importedKey = await importPrivateKey();
        const signature = await signChallenge(challengeBase64, importedKey);

        console.log('[Auth] Challenge signed');

        // 3. Send login request
        const loginRes = await fetch(ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: deviceID,
                challenge: challengeBase64,
                signature: signature
            })
        });

        const loginData = await loginRes.json();

        if (loginRes.ok) {
            console.log('[Auth] Auto-login successful');
        }

        return { success: loginRes.ok, data: loginData };
    } catch (error) {
        console.error('[Auth] Auto-login failed:', error);
        return { success: false, error: error.message };
    }
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

// ==========================================
// Initialization
// ==========================================
async function initAuth() {
    console.log('[Auth] Initializing...');

    if (isRegistered()) {
        console.log('[Auth] Device is registered:', localStorage.getItem(STORAGE_KEYS.DEVICE_ID));
        const result = await autoLogin();
        if (!result.success) {
            console.log('[Auth] Auto-login failed, but local keys exist');
        }
    } else {
        console.log('[Auth] Device not registered');
    }
}

// ==========================================
// DOM Content Loaded Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async() => {
    let privateKey= getPrivateKey();
    let deviceID= getDeviceName();
    console.log('Private Key:', privateKey);

    // Generate keys if not present
    if (!privateKey || !deviceID) {
        await initKeys()
        await initDeviceID()
    } else {
        console.log('[Auth] Device already has keys.');
    }

    // Initialize authentication
    await initAuth()
});
