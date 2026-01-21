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
export async function initKeys() {
    console.log('[Auth] Generating key pair...');
    const keyPair = await generateKeyPair();

    // Export private & public key ke ArrayBuffer
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const publicKeyBuffer  = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

    // Convert ArrayBuffer ke Base64 agar bisa simpan di localStorage
    const privateKeyBase64 = bufferToBase64(privateKeyBuffer);
    const publicKeyBase64  = bufferToBase64(publicKeyBuffer);

    // Set Private Key as User Identifier
    localStorage.setItem('gdrop_private_key', privateKeyBase64);

    // Send Public key to Backend


    console.log('[Auth] Keys stored in localStorage');
}

// // TODO : Finish this function
// async function exportPublicKey(publicKey) {
//     const rawKey = await window.crypto.subtle.exportKey("raw", publicKey);
//     console.log('Export Public Key:', publicKey);
//     return bufferToBase64(rawKey);
// }

// ==========================================
// Device ID Functions
// ==========================================
export async function initDeviceID() {
    let generate_device_id = localStorage.getItem('gdrop_device_id')

    if (!generate_device_id){
        generate_device_id = crypto.randomUUID()
        localStorage.setItem('gdrop_device_id', generate_device_id)
    }
}