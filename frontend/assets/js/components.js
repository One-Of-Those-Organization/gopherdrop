// ==========================================
// Global State
// ==========================================
let currentDevices = [];
const DEVICES_PER_PAGE = 6;
let currentPage = 1;

// ==========================================
// Backend Integration Logic
// ==========================================

function updateDeviceListFromBackend(backendUsers) {

    if (!backendUsers || !Array.isArray(backendUsers)) {
        console.warn('Invalid device list from backend', backendUsers);
        return;
    }

    const myPublicKey = localStorage.getItem('gdrop_public_key');

    // Simpan state checked biar gak ilang pas refresh polling
    const checkedIds = new Set(currentDevices.filter(d => d.checked).map(d => d.id));

    currentDevices = backendUsers
        .filter(item => {
            // Filter diri sendiri
            return item.user && item.user.public_key !== myPublicKey;
        })
        .map((item) => {
            const userId = item.user.public_key;
            return {
                id: userId,
                name: item.user.username || 'Unknown Device',
                icon: 'computer',
                status: 'Connected',
                checked: checkedIds.has(userId) // Restore checked state
            };
        });

    // Handle Pagination Reset
    const totalPages = Math.ceil(currentDevices.length / DEVICES_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    } else if (currentPage === 0 && totalPages > 0) {
        currentPage = 1;
    }

    renderDevicesWithPagination();
}

// ==========================================
// UI Rendering
// ==========================================

function createDeviceCard(device) {
    const statusClass = 'bg-green-500'; // Selalu hijau karena yang dapet dari WS pasti online
    const selectedClass = device.checked ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50';
    const checkClass = device.checked ? 'bg-primary text-white border-primary' : 'bg-transparent border-2 border-slate-300 text-transparent';

    return `
        <div class="device-card bg-white p-4 rounded-2xl flex items-center gap-4 cursor-pointer border-2 ${selectedClass} transition-all shadow-sm hover:shadow-md" 
             onclick="toggleDeviceSelection('${device.id}')">
            
            <div class="w-6 h-6 rounded-lg ${checkClass} flex items-center justify-center flex-shrink-0 transition-all">
                <span class="material-symbols-outlined text-sm">check</span>
            </div>
            
            <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                <span class="material-symbols-outlined text-2xl">${device.icon}</span>
            </div>
            
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 truncate">${device.name}</p>
                <div class="flex items-center gap-2 mt-0.5">
                    <span class="w-2 h-2 rounded-full ${statusClass} animate-pulse"></span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online</span>
                </div>
            </div>
        </div>
    `;
}

function renderDevicesWithPagination() {
    const container = document.getElementById('device-list');
    if (!container) return;

    // Empty State
    if (currentDevices.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 flex flex-col items-center justify-center text-center">
                <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 relative">
                    <span class="material-symbols-outlined text-4xl text-slate-300">radar</span>
                    <div class="absolute inset-0 rounded-full border-2 border-slate-100 animate-ping"></div>
                </div>
                <h3 class="text-slate-900 font-bold text-lg">Scanning for devices...</h3>
                <p class="text-slate-500 text-sm mt-1">Ensure other devices are on the same network.</p>
            </div>
        `;
        renderPagination(); // Clear pagination
        const countEl = document.getElementById('device-count');
        if(countEl) countEl.textContent = '0 FOUND';
        return;
    }

    const startIndex = (currentPage - 1) * DEVICES_PER_PAGE;
    const paginatedDevices = currentDevices.slice(startIndex, startIndex + DEVICES_PER_PAGE);

    container.innerHTML = paginatedDevices.map(device => createDeviceCard(device)).join('');

    // Update Counter
    const countEl = document.getElementById('device-count');
    if (countEl) countEl.textContent = `${currentDevices.length} FOUND`;

    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.ceil(currentDevices.length / DEVICES_PER_PAGE);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button class="w-10 h-10 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 disabled:opacity-50" 
                onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
        <span class="text-sm font-bold text-slate-500 px-2">Page ${currentPage} / ${totalPages}</span>
        <button class="w-10 h-10 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 disabled:opacity-50" 
                onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
        </button>
    `;

    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderDevicesWithPagination();
}

function toggleDeviceSelection(deviceId) {
    const device = currentDevices.find(d => d.id === deviceId);
    if (device) {
        device.checked = !device.checked;
        renderDevicesWithPagination();
    }
}

function getSelectedDevices() {
    return currentDevices.filter(d => d.checked);
}

// ==========================================
// Modal & Group Logic (Legacy Support)
// ==========================================

function openCreateGroupModal() {
    const selected = getSelectedDevices();
    if (selected.length === 0) {
        if(window.showToast) window.showToast('Select a device first!', 'warning');
        return;
    }

    const container = document.getElementById('selected-devices-list');
    if(container) {
        container.innerHTML = selected.map(d => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-2">
                <span class="font-bold text-sm text-slate-700">${d.name}</span>
                <span class="material-symbols-outlined text-green-500 text-sm">check_circle</span>
            </div>
        `).join('');
    }

    const countEl = document.getElementById('selected-count-modal');
    if(countEl) countEl.textContent = `(${selected.length})`;

    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
}

function confirmCreateGroup() {
    // Logic Create Transaction disini nanti
    const name = document.getElementById('new-group-name').value;
    if(!name) {
        if(window.showToast) window.showToast('Enter group name', 'error');
        return;
    }

    // Simpan ke Session Storage buat dikirim via WS app.js
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(getSelectedDevices()));
    sessionStorage.setItem('gdrop_group_name', name);

    if(window.startTransferProcess) {
        window.startTransferProcess(); // Panggil fungsi di app.js
        closeCreateGroupModal();
        if(window.showToast) window.showToast('Group Created! Waiting for accept...', 'success');
    }
}

// ==========================================
// Toast Notification
// ==========================================

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    const MAX_TOASTS = 1;

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-10 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none items-center';
        document.body.appendChild(container);
    }

    // Hapus toast lama jika kebanyakan
    while (container.childElementCount >= MAX_TOASTS) {
        container.firstChild.remove();
    }

    const toast = document.createElement('div');

    // Config warna icon & border
    let icon = 'info';
    let colorClass = 'border-blue-500 bg-white text-slate-800'; // Default info

    if (type === 'success') {
        icon = 'check_circle';
        colorClass = 'border-green-500 bg-white text-slate-800';
    } else if (type === 'error') {
        icon = 'error';
        colorClass = 'border-red-500 bg-white text-slate-800';
    } else if (type === 'warning') {
        icon = 'warning';
        colorClass = 'border-yellow-500 bg-white text-slate-800';
    }

    toast.className = `flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-l-4 transform transition-all duration-500 -translate-y-full opacity-0 pointer-events-auto min-w-[300px] max-w-sm ${colorClass}`;

    toast.innerHTML = `
        <span class="material-symbols-outlined text-2xl">${icon}</span>
        <div class="flex flex-col flex-1">
            <span class="font-bold text-xs uppercase tracking-wider opacity-70">${type}</span>
            <span class="font-bold text-sm">${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <span class="material-symbols-outlined text-lg">close</span>
        </button>
    `;

    container.appendChild(toast);

    // Animasi Masuk
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-full', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto Hapus
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('-translate-y-full', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }
    }, 4000);
}

// ==========================================
// Incoming Request UI Logic
// ==========================================

function showIncomingModal(senderName, fileName) {
    const modal = document.getElementById('incoming-request-modal');
    if (!modal) return;

    document.getElementById('incoming-sender').textContent = senderName;
    document.getElementById('incoming-file').textContent = fileName;

    modal.classList.remove('hidden');
    // Sound effect ping (optional)
}

function closeIncomingModal() {
    const modal = document.getElementById('incoming-request-modal');
    if (modal) modal.classList.add('hidden');
}

// ==========================================
// Transfer Progress UI Logic
// ==========================================

function showTransferProgressUI(files, deviceCount) {
    const overlay = document.getElementById('transfer-progress-overlay');
    if (!overlay) return;

    // Update Header Info
    document.getElementById('total-items-badge').textContent = `${files.length} files`;
    document.getElementById('recipient-count').textContent = `${deviceCount} devices`;

    // Render Queue (Simple Version)
    const queueContainer = document.getElementById('transfer-queue');
    if (queueContainer) {
        queueContainer.innerHTML = files.map(file => `
            <div class="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined">description</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm text-slate-800 truncate">${file.name}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider" id="status-${file.name.replace(/\s/g, '')}">Pending</p>
                </div>
            </div>
        `).join('');
    }

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
}

function updateFileProgressUI(fileName, percentage) {
    // Update Text Status per File
    const safeName = fileName.replace(/\s/g, '');
    const statusEl = document.getElementById(`status-${safeName}`);
    if (statusEl) {
        if(percentage >= 100) {
            statusEl.textContent = "COMPLETED";
            statusEl.classList.add("text-green-500");
        } else {
            statusEl.textContent = `SENDING ${percentage}%`;
        }
    }

    // Update Main Bar (Simplifikasi: cuma visual gerak)
    const mainBar = document.getElementById('main-progress-bar');
    if(mainBar) mainBar.style.width = `${percentage}%`;
}

function endTransferSession() {
    const overlay = document.getElementById('transfer-progress-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
    // Refresh page untuk reset koneksi (bersih-bersih)
    window.location.reload();
}

// Expose globals
window.showTransferProgressUI = showTransferProgressUI;
window.updateFileProgressUI = updateFileProgressUI;
window.endTransferSession = endTransferSession;
window.showToast = showToast;
window.showIncomingModal = showIncomingModal;
window.closeIncomingModal = closeIncomingModal;
window.toggleDeviceSelection = toggleDeviceSelection;
window.goToPage = goToPage;
window.updateDeviceListFromBackend = updateDeviceListFromBackend;
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.confirmCreateGroup = confirmCreateGroup;