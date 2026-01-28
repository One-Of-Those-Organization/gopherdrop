// ==========================================
// CENTRAL CONFIGURATION
// ==========================================

const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL Config
const PROD_HOST = 'ahmad-heliochromic-astoundedly.ngrok-free.dev';
const LOCAL_HOST = 'localhost:8080';

export const API_BASE_URL = IS_LOCALHOST
    ? `http://${LOCAL_HOST}/api/v1`
    : `https://${PROD_HOST}/api/v1`;

// Headers untuk Ngrok
export const API_HEADERS = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
};

// Storage Keys
export const STORAGE_KEYS = {
    PRIVATE_KEY: 'gdrop_private_key',
    PUBLIC_KEY: 'gdrop_public_key',
    DEVICE_ID: 'gdrop_device_id',
    DEVICE_NAME: 'gdrop_device_name',
    THEME: 'gopherdrop-theme',
    TOKEN: 'gdrop_token',
    DISCOVERABLE: 'gdrop_is_discoverable'
};