import { API_BASE_URL, API_HEADERS, STORAGE_KEYS } from './config.js';
import {
    getPrivateKey, getPublicKey, getDeviceName,
    generateKeyPair, saveKeys, initDeviceIdentity,
    importPrivateKey, signData
} from './helper.js';

const ENDPOINTS = {
    REGISTER: `${API_BASE_URL}/register`,
    CHALLENGE: `${API_BASE_URL}/challenge`,
    LOGIN: `${API_BASE_URL}/login`
};

// ==========================================
// Main Auth Entry Point
// ==========================================
export async function initAuth() {
    try {
        // Is the User Has Credentials?
        let privateKey = getPrivateKey();
        let publicKey = getPublicKey();

        // If not, perform REGISTRATION
        if (!privateKey || !publicKey) {
            await performRegistration();

            // Refresh variables after registration
            privateKey = getPrivateKey();
            publicKey = getPublicKey();

            // Set default theme and discoverable
            localStorage.setItem(STORAGE_KEYS.THEME, 'light');
            localStorage.setItem(STORAGE_KEYS.DISCOVERABLE, 'true');
        }

        // Do LOGIN, if success, return token
        const token = await performLogin(publicKey);

        return token;

    } catch (error) {
        console.error("[Auth Error]", error);
        if (error.message.includes("User not found") || error.message.includes("Authentication failed")) {
            window.showToast('Credentials rejected. Restarting authentication...', 'error');
            localStorage.clear();
            window.location.reload();
        }

        return null;
    }
}

// ==========================================
// Helper: Registration Flow
// ==========================================
async function performRegistration() {
    // Generate & Save Keys
    const keyPair = await generateKeyPair();
    await saveKeys(keyPair);
    await initDeviceIdentity(); // Set ID & Name

    // Send Public Key to Server
    const response = await fetch(ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
            username: getDeviceName(),
            public_key: getPublicKey()
        })
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${await response.text()}`);
    }
}

// ==========================================
// Helper: Login Flow
// ==========================================
async function performLogin(publicKey) {
    // Request Challenge
    const challengeRes = await fetch(ENDPOINTS.CHALLENGE, { headers: API_HEADERS });
    if (!challengeRes.ok) throw new Error('Network error: Failed to get challenge');

    const challengeJson = await challengeRes.json();
    const challengeBase64 = challengeJson.data;

    // Sign Challenge
    const privateKeyObj = await importPrivateKey();
    const signature = await signData(challengeBase64, privateKeyObj); // FIX: Gunakan helper signData

    // Verify with Server
    const loginRes = await fetch(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
            public_key: publicKey,
            challenge: challengeBase64,
            signature: signature
        })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.message || "Authentication failed");
    }

    // Save Token
    localStorage.setItem(STORAGE_KEYS.TOKEN, loginData.data);
    return loginData.data;
}