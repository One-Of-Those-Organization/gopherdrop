// ==========================================
// Constants and Imports
// ==========================================
import {bufferToBase64, base64ToBuffer, generateKeyPair, initDeviceID, savePrivateKey, importPrivateKey} from './helper.js';

// LocalStorage Keys
const STORAGE_KEYS = {
    PRIVATE_KEY: 'gdrop_private_key',
    PUBLIC_KEY: 'gdrop_public_key',
    DEVICE_ID: 'gdrop_device_id'
};

// API Endpoints
// const API_BASE = 'http://localhost:8080/api/v1'; // Adjust to match your Go server port/address
const API_BASE = `http://${window.location.hostname}:8080/api/v1`; // DEBUG ONLY
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

// ==========================================
// Creating initAuth Function
// ==========================================
export async function initAuth() {
    try {
        // [DEBUG LOGIC] Cek apakah Browser HP memblokir Crypto
        // Comment this block if not needed
        // if (!window.crypto || !window.crypto.subtle) {
        //     alert("FATAL ERROR: Fitur Crypto diblokir Browser!\n\nSolusi: Buka chrome://flags, cari 'insecure origin', set Enabled untuk IP laptop ini.");
        //     return null;
        // }

        let privateKey = getPrivateKey();
        let deviceID = getDeviceName();

        // Kalau belum ada kunci, generate dan registrasi
        if (!privateKey || !deviceID) {

            const generatedKeyPair = await generateKeyPair();

            await savePrivateKey(generatedKeyPair);

            const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', generatedKeyPair.publicKey);
            const publicKeyBase64 = bufferToBase64(publicKeyBuffer);
            localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKeyBase64);

            await initDeviceID();

            const response = await fetch(ENDPOINTS.REGISTER, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: getDeviceName(),
                    public_key: publicKeyBase64
                })
            });

            if (!response.ok) throw new Error('Registration failed');

            // Attempt login after successful registration
            return await initAuth();

        } else {
            // Login Flow
            const publicKey = getPublicKey();
            const privateKeyVal = getPrivateKey();

            if (!publicKey || !privateKeyVal) {
                return { success: false, error: 'No stored credentials' };
            }

            // 1. Get Challenge from server
            const challengeRes = await fetch(ENDPOINTS.CHALLENGE);
            if (!challengeRes.ok) throw new Error('Gagal konek ke Laptop (Challenge)');
            
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

            if (loginRes.ok && loginData.token) {
                localStorage.setItem('gdrop_token', loginData.token);
                // alert("Info: Berhasil Login!"); // Uncomment untuk konfirmasi
                return loginData.token;
            }

            return null;
        }
    } catch (error) {
        alert("System Error: " + error.message);
        console.error('[Auth] Error:', error);
        return { success: false, error: error.message };
    }
};