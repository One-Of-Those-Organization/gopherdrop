// ==========================================
// Encoding and Decoding Functions
// ==========================================

// Convert ArrayBuffer to Base64 string (Encoding)
export function bufferToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Convert Base64 string to Uint8Array (Decoding)
export function base64ToBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// ==========================================
// Helper Read Device Name and Private Key
// ==========================================
export function getPrivateKey() {
    return localStorage.getItem('gdrop_private_key');
}

export function getDeviceName() {
    return localStorage.getItem('gdrop_device_name');
}

// ==========================================
// Cryptographic Functions
// ==========================================

export async function generateKeyPair() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "Ed25519" },
            true, // extractable
            ["sign", "verify"]
        );
        console.log('[Auth] Key pair generated successfully');
        console.log('Key Pair:', keyPair);
        return keyPair;
    } catch (error) {
        console.error('[Auth] Failed to generate key pair:', error);
        throw error;
    }
}

// Initialize keys
export async function savePrivateKey(keyPair) {
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = bufferToBase64(privateKeyBuffer);
    localStorage.setItem('gdrop_private_key', privateKeyBase64);
    console.log('[Auth] Private key stored in localStorage');
}

export async function importPrivateKey() {
    const base64 = getPrivateKey();
    if (!base64) return null;

    const keyBuffer = base64ToBuffer(base64);

    return await window.crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "Ed25519" },
        false,
        ["sign"]
    );
}


// ==========================================
// Device ID Functions
// ==========================================
export async function initDeviceID() {
    let deviceName = getDeviceName();
    if (!deviceName) {
        deviceName = crypto.randomUUID();
        localStorage.setItem('gdrop_device_id', deviceName);
    }

    if (!localStorage.getItem('gdrop_device_name')) {
        // NOTE: CHANGE THIS TO A BETTER DEFAULT NAME IF NEEDED
        const defaultName = navigator.userAgent.split(' ')[0];
        localStorage.setItem('gdrop_device_name', defaultName);
    }

    return { deviceName, name: localStorage.getItem('gdrop_device_name') };
}

// ==========================================
// UI/UX Helper Functions
// ==========================================
function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) return '../';
    return '';
}

export async function loadComponent(elementId, componentPath) {
    const container = document.getElementById(elementId);
    if (!container) return;
    try {
        const basePath = getBasePath();
        const fullPath = basePath + componentPath;
        const response = await fetch(fullPath);
        if (!response.ok) throw new Error(`Failed to load ${fullPath}`);
        container.innerHTML = await response.text();
    } catch (error) {
        console.error('Error loading component:', error);
    }
}