/**
 * GopherDrop - Main Application
 */

import { initAuth } from "./auth.js";

// Global WebSocket Connection
let signalingSocket = null;
let isSocketConnected = false;

// Detect base path based on current location
function getBasePath() {
    const path = window.location.pathname;
    // If we're in a subdirectory like /pages/, go up one level
    if (path.includes('/pages/')) {
        return '../';
    }
    return '';
}

// Load HTML Component
async function loadComponent(elementId, componentPath) {
    const container = document.getElementById(elementId);
    if (!container) return;

    try {
        const basePath = getBasePath();
        const fullPath = basePath + componentPath;
        const response = await fetch(fullPath);
        if (!response.ok) throw new Error(`Failed to load ${fullPath}`);
        const html = await response.text();
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading component:', error);
    }
}

// Initialize Components
async function initializeApp() {
    // Initialize Authentication
    const token = await initAuth(); // token langsung dari auth.js
    if (token) {
        connectToSignalingServer(token);
    }

    // Load sidebar
    await loadComponent('sidebar-container', 'components/sidebar.html');

    // Load upload zone (only if container exists)
    await loadComponent('upload-zone-container', 'components/upload-zone.html');

    // Initialize file upload after upload-zone is loaded
    if (typeof initFileUpload === 'function') {
        initFileUpload();
    }

    // Highlight active nav item
    highlightActiveNav();
    // Start network speed indicator
    startNetworkSpeedIndicator();

    // Initialize devices (only if function exists and container exists)
    if (typeof renderDevices === 'function' && document.getElementById('device-list')) {
        renderDevices(sampleDevices, 'device-list');
    }

    // // Check for existing token and connect if available -> Replaced by auth.js initAuth call
    // const token = localStorage.getItem('gdrop_token');
    // if (token) {
    //     connectToSignalingServer(token);
    // }
}

// Highlight Active Navigation
function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
        // Check if href matches current page
        if (currentPath.includes('groups') && href.includes('groups')) {
            item.classList.add('active');
        } else if (currentPath.includes('settings') && href.includes('settings')) {
            item.classList.add('active');
        } else if ((currentPath.endsWith('/') || currentPath.includes('index')) && href.includes('index')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ==========================================
// Network Speed Indicator
// ==========================================

function startNetworkSpeedIndicator() {
    const speedElements = document.querySelectorAll('[data-network-speed]');
    if (!speedElements.length) return;

    setInterval(() => {
        const speed = (8 + Math.random() * 6).toFixed(1);
        speedElements.forEach(el => {
            el.textContent = `${speed} MB/s`;
        });
    }, 1500);
}

// ==========================================
// WebSocket & Signaling Logic
// ==========================================

function connectToSignalingServer(token) {
    if (signalingSocket && (signalingSocket.readyState === WebSocket.OPEN || signalingSocket.readyState === WebSocket.CONNECTING)) {
        console.log('[WS] Already connected or connecting');
        return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use localhost:8080 if running locally, otherwise relative path might fail if ports differ
    const wsUrl = `ws://localhost:8080/api/v1/protected/ws?token=${token}`;

    console.log('[WS] Connecting to:', wsUrl);

    signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = () => {
        console.log('[WS] Connected');
        isSocketConnected = true;
    };

    signalingSocket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleSignalingMessage(msg);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    };

    signalingSocket.onerror = (error) => {
        console.error('[WS] Error:', error);
    };

    signalingSocket.onclose = () => {
        console.log('[WS] Disconnected');
        isSocketConnected = false;
        signalingSocket = null;
        // Optionally retry connection here
    };
}

function handleSignalingMessage(msg) {
    console.log('[WS] Received:', msg);

    switch (msg.type) {
        case 2: // CONFIG_DISCOVERABLE
            console.log('[WS] Discoverable status update:', msg.data);
            // Verify success if needed
            break;
        case 4: // USER_SHARE_LIST
            // TODO: Update device list logic
            break;
        case 1: // ERROR
            console.error('[WS] Server error:', msg.data);
            break;
    }
}

// Set Discoverable Status (called from Settings page)
function setDiscoverable(isDiscoverable) {
    if (!signalingSocket || signalingSocket.readyState !== WebSocket.OPEN) {
        console.error('[WS] Not connected');
        return;
    }

    // Type 2 = CONFIG_DISCOVERABLE
    const msg = {
        type: 2,
        data: isDiscoverable
    };

    signalingSocket.send(JSON.stringify(msg));
    console.log('[WS] Sent discoverable config:', isDiscoverable);
}

// Expose setDiscoverable to global scope for HTML onclick
window.setDiscoverable = setDiscoverable;

// Listen for auth ready event from auth.js -> Deleted cuz duplicate
// window.addEventListener('gdrop:auth-ready', (e) => {
//     if (e.detail && e.detail.token) {
//         connectToSignalingServer(e.detail.token);
//     }
// });

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initializeApp);
