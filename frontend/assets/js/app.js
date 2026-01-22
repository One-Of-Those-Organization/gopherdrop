/**
 * GopherDrop - Main Application
 */

// Detect base path based on current location
function getBasePath() {
    const path = window.location.pathname;
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

// Fetch and display Network SSID
async function loadNetworkInfo() {
    try {
        const response = await fetch('/api/v1/network');
        if (response.ok) {
            const json = await response.json();
            // Data format: { success: true, message: "...", data: { ssid: "..." } }
            if (json.success && json.data && json.data.ssid) {
                const ssidEls = document.querySelectorAll('[data-network-ssid]');
                ssidEls.forEach(el => el.textContent = json.data.ssid);
            }
        }
    } catch (e) {
        console.warn('Failed to fetch network info:', e);
        const ssidEls = document.querySelectorAll('[data-network-ssid]');
        ssidEls.forEach(el => el.textContent = 'Local Network');
    }
}

// Initialize Components
async function initializeApp() {
    // Load components
    await loadComponent('sidebar-container', 'components/sidebar.html');
    await loadComponent('upload-zone-container', 'components/upload-zone.html');

    highlightActiveNav();

    // 1. Fetch Network Info
    loadNetworkInfo();

    // 2. Initialize Auth & WebSocket
    if (window.GopherDropAuth && window.GopherDropAuth.initAuth) {
        await window.GopherDropAuth.initAuth();

        // After auth init, check if we are logged in so we can connect WS
        if (window.GopherDropAuth.isRegistered()) {
            console.log('[App] Registered, attempting auto-login to get token...');
            const loginResult = await window.GopherDropAuth.autoLogin();

            if (loginResult.success && loginResult.data && loginResult.data.data) {
                const token = loginResult.data.data; // Structure: { ..., data: "jwt-token-string" }
                // Connect WebSocket
                if (window.GopherSocket) {
                    window.GopherSocket.connect(token);
                }
                // Init WebRTC
                if (window.initWebRTC) {
                    window.initWebRTC();
                }
            } else {
                console.warn('[App] Login failed, cannot connect to WS');
                // Maybe redirect to register page?
            }
        } else {
            // Redirect to register if needed, or show modal
            console.log('[App] Not registered.');
            // For now, since we are on dashboard, maybe prompt registration?
            if (!window.location.pathname.includes('register')) {
                // Register flow logic here if needed
            }
        }
    }
}

// Highlight Active Navigation
function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
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

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initializeApp);
