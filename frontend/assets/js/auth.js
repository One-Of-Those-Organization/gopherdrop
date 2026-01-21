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
// TODO : Finish this Backend Registration Function
// try {
//     const response = await fetch(ENDPOINTS.REGISTER, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//             username: getDeviceName(),
//             public_key: getPrivateKey()
//         })
//     });
//
// } catch (e) {
//     console.error('[Auth] Registration failed:', e);
// }


//     try {
//         const response = await fetch(ENDPOINTS.REGISTER, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 username: deviceName,
//                 public_key: publicKeyBase64
//             })
//         });
//
//         const data = await response.json();
//
//         // Save Device ID if backend returns it (it might return user object with id)
//         if (response.ok) {
//             // Check where the ID is located in the response
//             const id = data.data?.id || data.id;
//             if (id) {
//                 localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
//                 console.log('[Auth] Device registered successfully. ID:', id);
//             }
//         }
//
//         return { success: response.ok, data };
//     } catch (error) {
//         console.error('[Auth] Registration failed:', error);
//         // Still save locally even if server is unavailable
//         return {
//             success: false,
//             error: error.message,
//             localOnly: true
//         };
//     }
// }

async function autoLogin() {
    const deviceID = getDeviceName();
    const privateKey = getPrivateKey();

    if (!deviceID || !privateKey) {
        console.log('[Auth] Cannot auto-login: missing credentials');
        return { success: false, error: 'No stored credentials' };
    }

    try {
        // 1. Get Challenge from server
        const challengeRes = await fetch(ENDPOINTS.CHALLENGE);
        const challengeData = await challengeRes.json();
        const challengeBase64 = challengeData.data;

        console.log('[Auth] Received challenge:', challengeBase64.substring(0, 20) + '...');

        // 2. Sign the challenge
        const signature = await signChallenge(challengeBase64, privateKey);
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

/**
 * Initialize authentication on page load
 */
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
