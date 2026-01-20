/**
 * GopherDrop - Authentication Module
 * Ed25519 Public/Private Key Authentication
 * 
 * Public key: sent to backend during registration
 * Private key: stored in localStorage (JWK format)
 */

// LocalStorage Keys
const STORAGE_KEYS = {
    PRIVATE_KEY: 'gdrop_private_key',
    DEVICE_NAME: 'gdrop_device_name',
    DEVICE_ID: 'gdrop_device_id'
};

// API Endpoints
const API_BASE = 'http://localhost:8080/api/v1'; // Adjust to match your Go server port/address
const ENDPOINTS = {
    REGISTER: `${API_BASE}/register`,
    CHALLENGE: `${API_BASE}/challenge`,
    LOGIN: `${API_BASE}/login`
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// ==========================================
// Key Management Functions
// ==========================================

/**
 * Generate Ed25519 Key Pair
 * @returns {Promise<CryptoKeyPair>}
 */
async function generateKeyPair() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "Ed25519" },
            true, // extractable
            ["sign", "verify"]
        );
        console.log('[Auth] Key pair generated successfully');
        return keyPair;
    } catch (error) {
        console.error('[Auth] Failed to generate key pair:', error);
        throw error;
    }
}

/**
 * Export Public Key as Base64
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
async function exportPublicKey(publicKey) {
    const rawKey = await window.crypto.subtle.exportKey("raw", publicKey);
    return bufferToBase64(rawKey);
}

/**
 * Save Private Key to localStorage (JWK format)
 * @param {CryptoKey} privateKey
 */
async function savePrivateKey(privateKey) {
    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
    localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, JSON.stringify(jwk));
    console.log('[Auth] Private key saved to localStorage');
}

/**
 * Load Private Key from localStorage
 * @returns {Promise<CryptoKey|null>}
 */
async function loadPrivateKey() {
    const jwkString = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
    if (!jwkString) {
        console.log('[Auth] No private key found in localStorage');
        return null;
    }

    try {
        const jwk = JSON.parse(jwkString);
        const privateKey = await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "Ed25519" },
            true,
            ["sign"]
        );
        console.log('[Auth] Private key loaded from localStorage');
        return privateKey;
    } catch (error) {
        console.error('[Auth] Failed to load private key:', error);
        return null;
    }
}

/**
 * Sign a challenge with private key
 * @param {string} challengeBase64
 * @param {CryptoKey} privateKey
 * @returns {Promise<string>} Signature as Base64
 */
async function signChallenge(challengeBase64, privateKey) {
    const challengeBytes = base64ToBuffer(challengeBase64);
    const signature = await window.crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        challengeBytes
    );
    return bufferToBase64(signature);
}

// ==========================================
// Authentication Functions
// ==========================================

/**
 * Check if device is registered
 * @returns {boolean}
 */
function isRegistered() {
    const hasPrivateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY) !== null;
    const hasDeviceName = localStorage.getItem(STORAGE_KEYS.DEVICE_NAME) !== null;
    return hasPrivateKey && hasDeviceName;
}

/**
 * Get stored device name
 * @returns {string|null}
 */
function getDeviceName() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);
}

/**
 * Get stored device ID
 * @returns {string|null}
 */
function getDeviceId() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
}

/**
 * Get stored public key (Base64)
 * @returns {string|null}
 */
function getPublicKey() {
    return localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
}

/**
 * Register a new device
 * @param {string} deviceName - Display name for this device
 * @returns {Promise<Object>} Response from server
 */
async function registerDevice(deviceName) {
    console.log('[Auth] Starting device registration:', deviceName);

    // 1. Generate Key Pair
    const keyPair = await generateKeyPair();

    // 2. Export Public Key
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    console.log('[Auth] Public key generated:', publicKeyBase64.substring(0, 20) + '...');

    // 3. Save Private Key locally
    await savePrivateKey(keyPair.privateKey);

    // 4. Save device name locally (Public Key NOT saved locally)
    localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceName);
    
    // 5. Send to backend
    try {
        const response = await fetch(ENDPOINTS.REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: deviceName,
                public_key: publicKeyBase64
            })
        });

        const data = await response.json();

        // Save Device ID if backend returns it (it might return user object with id)
        if (response.ok) {
            // Check where the ID is located in the response
            const id = data.data?.id || data.id; 
            if (id) {
                localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
                console.log('[Auth] Device registered successfully. ID:', id);
            }
        }

        return { success: response.ok, data };
    } catch (error) {
        console.error('[Auth] Registration failed:', error);
        // Still save locally even if server is unavailable
        return { 
            success: false, 
            error: error.message,
            localOnly: true 
        };
    }
}

/**
 * Auto-login using stored credentials
 * @returns {Promise<Object>} Response from server
 */
async function autoLogin() {
    const deviceName = getDeviceName();
    const privateKey = await loadPrivateKey();

    if (!deviceName || !privateKey) {
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
                username: deviceName,
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

/**
 * Clear all stored credentials (logout)
 */
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
        console.log('[Auth] Device is registered:', getDeviceName());
        // Attempt auto-login
        const result = await autoLogin();
        if (!result.success) {
            console.log('[Auth] Auto-login failed, but local keys exist');
        }
    } else {
        console.log('[Auth] Device not registered');
        // Could show registration prompt here
    }
}

// Export for use in other modules
window.GopherDropAuth = {
    // Key Management
    generateKeyPair,
    exportPublicKey,
    savePrivateKey,
    loadPrivateKey,
    signChallenge,
    
    // Authentication
    isRegistered,
    getDeviceName,
    getDeviceId,
    getPublicKey,
    registerDevice,
    autoLogin,
    clearCredentials,
    
    // Init
    initAuth,
    
    // Constants
    STORAGE_KEYS
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay init slightly to let other modules load
    setTimeout(initAuth, 100);
});
