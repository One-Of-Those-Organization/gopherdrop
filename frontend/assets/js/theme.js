/**
 * GopherDrop - Theme Manager
 * Handles dark/light theme switching across all pages
 */

// Theme constants
const THEME_KEY = 'gopherdrop-theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
};

// Get current theme from localStorage or default to light
function getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || THEMES.LIGHT;
}

// Set theme and save to localStorage
function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}

// Apply theme to document
function applyTheme(theme) {
    const html = document.documentElement;
    
    if (theme === THEMES.AUTO) {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
    } else if (theme === THEMES.DARK) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
    
    // Update theme buttons if on settings page
    updateThemeButtons(theme);
}

// Update theme button states
function updateThemeButtons(theme) {
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => {
        const btnTheme = btn.dataset.theme;
        btn.classList.toggle('active', btnTheme === theme);
    });
}

// Select theme (called from settings page)
function selectTheme(btn) {
    const theme = btn.dataset.theme;
    if (theme) {
        setTheme(theme);
    }
}

// Listen for system theme changes (for auto mode)
function setupAutoThemeListener() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (getCurrentTheme() === THEMES.AUTO) {
            applyTheme(THEMES.AUTO);
        }
    });
}

// Initialize theme on page load
function initTheme() {
    const theme = getCurrentTheme();
    applyTheme(theme);
    setupAutoThemeListener();
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initTheme);

// Also run immediately in case DOM is already loaded
if (document.readyState !== 'loading') {
    initTheme();
}
