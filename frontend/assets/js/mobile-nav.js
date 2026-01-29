document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. Mobile Menu Logic (Toggle)
    // ==========================================
    const sidebarContainer = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-btn');

    function openMobileMenu() {
        if (!sidebarContainer || !overlay) return;
        // Hapus translate (biar masuk layar)
        sidebarContainer.classList.remove('-translate-x-full');
        // Tampilkan overlay
        overlay.classList.remove('hidden');
        // Kunci scroll body
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        if (!sidebarContainer || !overlay) return;
        // Kembalikan ke luar layar
        sidebarContainer.classList.add('-translate-x-full');
        // Sembunyikan overlay
        overlay.classList.add('hidden');
        // Buka scroll body
        document.body.style.overflow = '';
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openMobileMenu();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }

    // Expose global biar bisa dipanggil dari HTML onclick
    window.closeMobileMenu = closeMobileMenu;


    // ==========================================
    // 2. Active Link Highlighter (Tailwind Version)
    // ==========================================
    function initSidebarNavigation() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-item');

        // Class untuk kondisi AKTIF (Biru + Background tipis)
        const activeClasses = ['bg-primary/10', 'text-primary', 'font-bold'];
        // Class untuk kondisi NON-AKTIF (Abu-abu + Hover effect)
        const inactiveClasses = ['text-slate-500', 'dark:text-slate-400', 'hover:bg-slate-50', 'dark:hover:bg-slate-800', 'hover:text-slate-900', 'dark:hover:text-white', 'font-medium'];

        navLinks.forEach(link => {
            const href = link.getAttribute('href');

            // Logika Cek URL: Apakah link ini sesuai dengan halaman sekarang?
            // Kita pakai .includes() biar cover sub-halaman
            let isActive = false;

            if (href === '/' || href.endsWith('index.html')) {
                // Khusus Dashboard (Home)
                isActive = currentPath === '/' || currentPath.endsWith('index.html');
            } else {
                // Halaman lain (Groups, Settings)
                // Hapus '../' atau './' biar pencocokan string lebih akurat
                const cleanHref = href.replace(/^(\.\.\/|\.\/)/, '');
                isActive = currentPath.includes(cleanHref.replace('.html', ''));
            }

            // Reset Class (Hapus semua dulu biar bersih)
            link.classList.remove(...activeClasses, ...inactiveClasses);

            if (isActive) {
                // Apply Active Tailwind Classes
                link.classList.add(...activeClasses);
            } else {
                // Apply Inactive Tailwind Classes
                link.classList.add(...inactiveClasses);
            }
        });
    }

    // Jalankan logic highlight saat load
    initSidebarNavigation();
});