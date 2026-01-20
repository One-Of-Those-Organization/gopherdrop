/**
 * GopherDrop - Main Application
 */

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
    // Load sidebar
    await loadComponent('sidebar-container', 'components/sidebar.html');
    
    // Load upload zone (only if container exists)
    await loadComponent('upload-zone-container', 'components/upload-zone.html');
    
    // Highlight active nav item
    highlightActiveNav();
    
    // Initialize devices (only if function exists and container exists)
    if (typeof renderDevices === 'function' && document.getElementById('device-list')) {
        renderDevices(sampleDevices, 'device-list');
    }
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

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initializeApp);
