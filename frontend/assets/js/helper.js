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
// ==========================================
// Device ID Functions
// ==========================================
export async function initDeviceID() {
    // 1. Ensure Unique Device ID (UUID)
    let deviceId = localStorage.getItem('gdrop_device_id');
    if (!deviceId) {
        // Fallback if crypto.randomUUID is missing (e.g. non-secure context)
        if (typeof crypto.randomUUID === 'function') {
            deviceId = crypto.randomUUID();
        } else {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        localStorage.setItem('gdrop_device_id', deviceId);
    }

    // 2. Ensure Readable Device Name (with unique suffix to prevent DB collisions)
    let deviceName = localStorage.getItem('gdrop_device_name');
    if (!deviceName) {
        const userAgent = navigator.userAgent;
        let platform = "Browser";
        if (userAgent.includes("Win")) platform = "Windows";
        else if (userAgent.includes("Mac")) platform = "Mac";
        else if (userAgent.includes("Linux")) platform = "Linux";
        else if (userAgent.includes("Android")) platform = "Android";
        else if (userAgent.includes("iPhone")) platform = "iPhone";

        const browser = userAgent.includes("Chrome") ? "Chrome" :
            userAgent.includes("Firefox") ? "Firefox" :
                userAgent.includes("Safari") ? "Safari" : "Web";

        // Append short random string to ensure uniqueness in DB
        const suffix = Math.random().toString(36).substr(2, 4).toUpperCase();
        deviceName = `${platform} ${browser} (${suffix})`;

        localStorage.setItem('gdrop_device_name', deviceName);
    }

    return { deviceId, deviceName };
}