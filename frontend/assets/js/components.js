// ==========================================
// Global State & Configuration
// ==========================================

// Menyimpan daftar device yang diterima dari backend
let currentDevices = []; 

const DEVICES_PER_PAGE = 6;
let currentPage = 1;

// ==========================================
// Backend Integration Logic
// ==========================================

// Ambil data device dari backend dan update UI
function updateDeviceListFromBackend(backendUsers) {
    // Ambil public key sendiri untuk filter
    const myPublicKey = localStorage.getItem('gdrop_public_key');

    // Simpan state checked dari currentDevices sebelum update
    const checkedIds = new Set(currentDevices.filter(d => d.checked).map(d => d.id));

    // Mapping data dari backend ke format yang dibutuhkan UI
    currentDevices = backendUsers
        .filter(item => {
            // Tidak menampilkan diri sendiri di list
            return item.user.public_key !== myPublicKey;
        })
        .map((item) => {
            const userId = item.user.public_key;
            return {
                id: userId, // Public Key digunakan sebagai Unique ID
                name: item.user.username,
                icon: 'computer', // Default icon (bisa dikembangkan nanti)
                status: 'Connected', // User di list ini pasti statusnya Online/Connected
                // [RESTORE STATE] Jika ID ini ada di checkedIds, kembalikan status checked-nya
                checked: checkedIds.has(userId)
            };
        });

    // Reset ke halaman 1 jika halaman saat ini melebihi total halaman baru
    const totalPages = Math.ceil(currentDevices.length / DEVICES_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render ulang daftar device dengan pagination
    renderDevicesWithPagination();
}

// ==========================================
// Device Card UI Component
// ==========================================

function createDeviceCard(device) {
    // Styling status dot (Hijau jika connected)
    const statusClass = device.status === 'Connected' ? 'bg-green-500' : 'bg-primary/40';
    const statusText = device.status.toUpperCase();
    
    // Styling Checkbox & Border Card (Active state)
    // Mengubah tampilan border jadi biru jika dicentang
    const selectedClass = device.checked 
        ? 'border-primary bg-primary/10' 
        : '';
        
    const checkClass = device.checked 
        ? 'bg-primary text-white border-primary' 
        : 'bg-transparent border-2 border-slate-400 text-transparent';

    return `
        <div class="device-card p-3 lg:p-5 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 cursor-pointer border-2 ${selectedClass} transition-all" 
             onclick="toggleDeviceSelection('${device.id}')">
            
            <div class="checkbox-indicator w-6 h-6 lg:w-7 lg:h-7 rounded-md ${checkClass} flex items-center justify-center flex-shrink-0 transition-all">
                <span class="material-symbols-outlined text-sm lg:text-base">check</span>
            </div>
            
            <div class="device-icon w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-xl lg:text-2xl">${device.icon}</span>
            </div>
            
            <div class="flex-1 min-w-0">
                <p class="font-bold truncate text-sm lg:text-base">${device.name}</p>
                <div class="flex items-center gap-1.5 lg:gap-2">
                    <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${statusClass}"></span>
                    <span class="text-[9px] lg:text-[11px] font-bold uppercase tracking-wider">${statusText}</span>
                </div>
            </div>
            
            <button class="p-1 flex-shrink-0" onclick="event.stopPropagation(); showDeviceMenu('${device.id}')">
                <span class="material-symbols-outlined text-lg lg:text-xl">more_vert</span>
            </button>
        </div>
    `;
}

// ==========================================
// Interaction Logic
// ==========================================

// Ubah status checked device saat diklik
function toggleDeviceSelection(deviceId) {
    // Cari device di array data yang asli
    const device = currentDevices.find(d => d.id === deviceId);
    
    if (device) {
        // Toggle nilai checked (true <-> false)
        device.checked = !device.checked;
        
        // Render ulang untuk memperbarui tampilan CSS (border biru dsb)
        renderDevicesWithPagination(); 
    }
}

// ==========================================
// Pagination System
// ==========================================

function getPaginatedDevices() {
    const startIndex = (currentPage - 1) * DEVICES_PER_PAGE;
    const endIndex = startIndex + DEVICES_PER_PAGE;
    return currentDevices.slice(startIndex, endIndex);
}

function getTotalPages() {
    return Math.ceil(currentDevices.length / DEVICES_PER_PAGE);
}

function renderDevicesWithPagination() {
    const container = document.getElementById('device-list');
    if (!container) return;
    
    const paginatedDevices = getPaginatedDevices();
    
    // Handling empty state
    if (currentDevices.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 opacity-60">
                <span class="material-symbols-outlined text-4xl mb-2">radar</span>
                <p>Scanning for devices...</p>
                <p class="text-xs mt-1">No active users found nearby.</p>
            </div>
        `;
    } else {
        container.innerHTML = paginatedDevices.map(device => createDeviceCard(device)).join('');
    }
    
    // Update counter text
    const countEl = document.getElementById('device-count');
    if (countEl) {
        countEl.textContent = `${currentDevices.length} FOUND`;
    }
    
    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const totalPages = getTotalPages();
    
    // Sembunyikan pagination jika cuma 1 halaman atau kosong
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    // Generate tombol Previous
    let paginationHTML = `
        <button class="pagination-btn w-8 h-8 lg:w-10 lg:h-10 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
    `;
    
    // Generate nomor halaman
    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHTML += `
            <button class="pagination-btn ${activeClass} w-8 h-8 lg:w-10 lg:h-10 text-xs lg:text-sm" 
                    onclick="goToPage(${i})">${i}</button>
        `;
    }
    
    // Generate tombol Next
    paginationHTML += `
        <button class="pagination-btn w-8 h-8 lg:w-10 lg:h-10 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
        </button>
    `;
    
    container.innerHTML = paginationHTML;
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderDevicesWithPagination();
}

// Legacy function support (Agar tidak error jika dipanggil function lama)
function renderDevices(devices, containerId) {
    renderDevicesWithPagination();
}

function showDeviceMenu(deviceId) {
    console.log('Show menu for:', deviceId);
}

// ==========================================
// Group & Modal Logic
// ==========================================

function getSelectedDevices() {
    // Filter device yang property .checked === true
    return currentDevices.filter(d => d.checked);
}

function openCreateGroupModal() {
    const selectedDevices = getSelectedDevices();
    
    if (selectedDevices.length === 0) {
        alert('Please select at least one device to create a group.');
        return;
    }
    
    renderSelectedDevicesInModal(selectedDevices);
    
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            document.getElementById('new-group-name')?.focus();
        }, 100);
    }
}

function closeCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        const input = document.getElementById('new-group-name');
        if (input) input.value = '';
    }
}

function renderSelectedDevicesInModal(devices) {
    const container = document.getElementById('selected-devices-list');
    const countEl = document.getElementById('selected-count-modal');
    
    if (countEl) countEl.textContent = `(${devices.length})`;
    if (!container) return;
    
    container.innerHTML = devices.map(device => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div class="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                <span class="material-symbols-outlined text-lg">${device.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-900 text-sm truncate">${device.name}</p>
                <p class="text-[10px] text-slate-500 uppercase">${device.status}</p>
            </div>
            <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-white text-sm">check</span>
            </div>
        </div>
    `).join('');
}

function confirmCreateGroup() {
    const nameInput = document.getElementById('new-group-name');
    const groupName = nameInput?.value.trim();
    
    if (!groupName) {
        alert('Please enter a group name.');
        nameInput?.focus();
        return;
    }
    
    const selectedDevices = getSelectedDevices();
    
    // NOTE FOR TEAM: Di sini nanti integrasi ke endpoint 'CREATE_GROUP' backend (belum ada)
    console.log('Creating group:', {
        name: groupName,
        devices: selectedDevices.map(d => d.id)
    });
    
    alert(`Group "${groupName}" created!`);
    
    // Uncheck selected devices after group created
    selectedDevices.forEach(d => d.checked = false);
    renderDevicesWithPagination();
    
    closeCreateGroupModal();
}

// ==========================================
// File Selection & Upload Handlers
// ==========================================

let selectedFiles = [];

function initFileUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const selectFilesBtn = document.getElementById('select-files-btn');
    
    if (!uploadZone) return;
    
    // Create hidden file input element dynamically
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    selectFilesBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    // Logic: Kalau sudah ada file, klik upload zone buka modal review
    // Kalau belum, buka file picker
    uploadZone.addEventListener('click', () => {
        if (selectedFiles.length > 0) {
            // Note: Pastikan fungsi showFileSelectionModal ada di scope ini atau global
            if(typeof showFileSelectionModal === 'function') showFileSelectionModal(); 
        } else {
            fileInput.click();
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
        fileInput.value = ''; // Reset value agar bisa pilih file yang sama lagi
    });
    
    // Drag & Drop Visual Feedback
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-primary', 'bg-primary/5');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary', 'bg-primary/5');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary', 'bg-primary/5');
        handleFileSelect(e.dataTransfer.files);
    });
}

function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    
    // Convert FileList to Array of metadata objects
    // (Karena File object tidak bisa disimpan langsung ke sessionStorage)
    const newFiles = Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified
    }));
    
    // Ambil file lama dari session (jika ada)
    let currentFiles = [];
    try {
        const existing = sessionStorage.getItem('gdrop_transfer_files');
        if (existing) currentFiles = JSON.parse(existing);
    } catch(e) {}
    
    const updatedFiles = [...currentFiles, ...newFiles];
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(updatedFiles));
    
    // Simpan devices yang sedang DIPILIH (Checked)
    const devices = getSelectedDevices();
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(devices));
    
    // Simpan SEMUA devices yang TERSEDIA (untuk modal 'Add Device' di halaman review)
    sessionStorage.setItem('gdrop_available_devices', JSON.stringify(currentDevices));
    
    // Redirect ke halaman Review Transfer
    const isPagesDir = window.location.pathname.includes('/pages/');
    const reviewPageUrl = isPagesDir ? 'transfer-review.html' : 'pages/transfer-review.html';
    window.location.href = reviewPageUrl;
}

// Export functions to Global Window Object
// Agar bisa dipanggil oleh app.js atau inline HTML onclick=""
window.handleFileSelect = handleFileSelect;
window.updateDeviceListFromBackend = updateDeviceListFromBackend; // [IMPORTANT] Dipanggil WebSocket

// Init on DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Render awal (bisa jadi kosong sampai WebSocket connect)
    if (document.getElementById('device-list')) {
        renderDevicesWithPagination();
    }
    document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupModal);
});