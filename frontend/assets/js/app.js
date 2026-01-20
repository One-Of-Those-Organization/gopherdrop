/**
 * GopherDrop - Main Application
 */

// Load HTML Component
async function loadComponent(elementId, componentPath) {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) throw new Error(`Failed to load ${componentPath}`);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Error loading component:', error);
    }
}

// Initialize Components
async function initializeApp() {
    // Load sidebar
    await loadComponent('sidebar-container', 'components/sidebar.html');
    
    // Load upload zone
    await loadComponent('upload-zone-container', 'components/upload-zone.html');
    
    // Highlight active nav item
    highlightActiveNav();
    
    // Initialize devices
    if (typeof renderDevices === 'function') {
        renderDevices(sampleDevices, 'device-list');
    }
}

// Highlight Active Navigation
function highlightActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initializeApp);
