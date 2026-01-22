document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const sidebarContainer = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-btn');

    // Function to Open
    function openMobileMenu() {
        if (!sidebarContainer || !overlay) return;
        sidebarContainer.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Function to Close
    function closeMobileMenu() {
        if (!sidebarContainer || !overlay) return;
        sidebarContainer.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Event Listeners
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openMobileMenu();
        });
    }

    // Close when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }

    // Expose close function globally
    window.closeMobileMenu = closeMobileMenu;
});