import { STORAGE_KEYS} from "./config.js";

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
// Storage Helpers (Getters)
// ==========================================
export const getPrivateKey = () => localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
export const getPublicKey = () => localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
export const getDeviceName = () => localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);
export const getDeviceId = () => localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

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
        return keyPair;
    } catch (error) {
        throw error;
    }
}

export async function saveKeys(keyPair) {
    // Export Private Key
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, bufferToBase64(privateKeyBuffer));

    // Export Public Key
    const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, bufferToBase64(publicKeyBuffer));
}

export async function importPrivateKey() {
    const base64 = getPrivateKey();
    if (!base64) return null;
    return await window.crypto.subtle.importKey(
        "pkcs8",
        base64ToBuffer(base64),
        { name: "Ed25519" },
        false,
        ["sign"]
    );
}
export async function signData(dataBase64, privateKey) {
    const dataBytes = base64ToBuffer(dataBase64);
    const signature = await window.crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        dataBytes
    );
    return bufferToBase64(signature);
}

// ==========================================
// Device ID Functions
// ==========================================
export async function initDeviceIdentity() {
    // Check or Create Device ID
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }

    // Set Default Name
    if (!localStorage.getItem(STORAGE_KEYS.DEVICE_NAME)) {
        localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceId);
    }

    // Set Default Theme
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
        localStorage.setItem(STORAGE_KEYS.THEME, "light");
    }
}

// ==========================================
// UI Helpers
// ==========================================
export async function loadComponent(elementId, componentPath) {
    const container = document.getElementById(elementId);
    if (!container) return;
    try {
        // Handle path relative to pages folder
        const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
        const response = await fetch(prefix + componentPath);
        if (!response.ok) throw new Error(`Failed to load ${componentPath}`);
        container.innerHTML = await response.text();
    } catch (error) {
        console.error("Component Load Error:", error);
    }
}

export function updateProfileUI() {
    const nameElements = document.querySelectorAll('#user-name-display, .profile-name');
    const name = getDeviceName();
    nameElements.forEach(el => { el.textContent = name; });
}

export function setTheme(theme) {
    localStorage.setItem('gopherdrop-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
}
