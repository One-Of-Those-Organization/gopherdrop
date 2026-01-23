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

function showIncomingModal(senderName, files) {
    const modal = document.getElementById('incoming-request-modal');
    if (!modal) return;

    // 1. Update Nama & Jumlah
    document.getElementById('incoming-sender').textContent = senderName;
    const countEl = document.getElementById('incoming-file-count');
    if(countEl) countEl.textContent = `${files.length} ITEMS`;

    // 2. Render List File (Miro Style)
    const listContainer = document.getElementById('incoming-file-list');
    if (listContainer) {
        if (!files || files.length === 0) {
            listContainer.innerHTML = `<p class="text-slate-400 text-center py-4">No metadata available</p>`;
        } else {
            // Di dalam function showIncomingModal(senderName, files)
            listContainer.innerHTML = files.map(file => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/30 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                            <span class="material-symbols-outlined text-xl">${getFileIcon(file.type || '')}</span>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-slate-700 truncate pr-2">${file.name}</span>
                            <span class="text-[9px] text-slate-400 font-black uppercase tracking-wider">${formatFileSize(file.size)}</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-blue-400 text-sm">check_circle</span>
                </div>
            `).join('');
        }
    }

    modal.classList.remove('hidden');
}

// Helper pendukung (Tambahkan di bawah jika belum ada)
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (type.includes('image')) return 'image';
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('video')) return 'movie';
    return 'description';
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

    // --- LOGIC RESET UNTUK TOP BAR (Biar gak dianggurin) ---
    const overallText = document.getElementById('overall-percentage');
    if(overallText) overallText.textContent = "0%";
    const mainBar = document.getElementById('main-progress-bar');
    if(mainBar) mainBar.style.width = "0%";
    // -------------------------------------------------------

    // 1. Update Text Header
    document.getElementById('total-items-badge').textContent = `${files.length} files`;
    document.getElementById('recipient-count').textContent = `${deviceCount || 1} devices`;

    // 2. Render Queue (Card Style)
    const queueContainer = document.getElementById('transfer-queue');
    if (queueContainer) {
        queueContainer.innerHTML = files.map(file => {
            let icon = 'draft';
            let color = 'text-slate-400 bg-slate-50';
            if (file.type && file.type.includes('image')) { icon = 'image'; color = 'text-blue-500 bg-blue-50'; }
            else if (file.type && file.type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-500 bg-red-50'; }

            const safeID = file.name.replace(/[^a-zA-Z0-9]/g, '');
            return `
            <div class="file-card-item bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-2xl">${icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between mb-1">
                        <p class="font-bold text-sm text-slate-800 dark:text-slate-200 truncate pr-2">${file.name}</p>
                        <span class="text-[10px] font-bold text-slate-400" id="percent-${safeID}">0%</span>
                    </div>
                    <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div id="bar-${safeID}" class="h-full bg-primary rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p class="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider" id="status-${safeID}">Queued</p>
                </div>
            </div>`;
        }).join('');
    }

    // 3. Render Mesh
    renderMeshNetwork(deviceCount || 1);

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
}

// Fungsi Pembantu Render Mesh
function renderMeshNetwork(count) {
    const container = document.getElementById('mesh-network-view');
    if(!container) return;

    // Hapus satelit lama (sisakan center node)
    const oldNodes = container.querySelectorAll('.mesh-node, .connection-line');
    oldNodes.forEach(n => n.remove());

    const radius = 180; // Jarak dari tengah
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;

    for (let i = 0; i < count; i++) {
        const angle = (i * (360 / count)) * (Math.PI / 180);
        const x = Math.cos(angle) * radius; // Koordinat relatif
        const y = Math.sin(angle) * radius;

        // Buat Garis
        const line = document.createElement('div');
        line.className = 'connection-line active';
        line.style.width = `${radius - 40}px`; // Panjang garis
        line.style.top = '50%';
        line.style.left = '50%';
        line.style.transform = `translateY(-50%) rotate(${i * (360 / count)}deg)`;
        container.appendChild(line);

        // Buat Node Satelit
        const node = document.createElement('div');
        node.className = 'mesh-node absolute flex flex-col items-center';
        node.style.top = `50%`;
        node.style.left = `50%`;
        node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        node.innerHTML = `
            <div class="w-16 h-16 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center mb-2 animate-bounce" style="animation-delay: ${i * 0.2}s">
                <span class="material-symbols-outlined text-slate-400">smartphone</span>
            </div>
            <span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase">Connected</span>
        `;
        container.appendChild(node);
    }
}

window.updateFileProgressUI = function(fileName, percentage) {
    const safeName = fileName.replace(/[^a-zA-Z0-9]/g, '');

    // 1. Update Card File Satuan (Bagian Bawah)
    const statusEl = document.getElementById(`status-${safeName}`);
    const percentEl = document.getElementById(`percent-${safeName}`);
    const barEl = document.getElementById(`bar-${safeName}`);

    if (statusEl) {
        if (percentage >= 100) {
            statusEl.textContent = "COMPLETED";
            statusEl.className = "text-[10px] font-bold text-green-500 mt-1 uppercase tracking-wider";
        } else {
            statusEl.textContent = "SENDING...";
            // Tambahkan animasi pulse biar keren pas ngirim
            statusEl.className = "text-[10px] text-primary font-bold mt-1 uppercase tracking-wider animate-pulse";
        }
    }
    if (percentEl) percentEl.textContent = `${Math.round(percentage)}%`;
    if (barEl) barEl.style.width = `${percentage}%`;

    // 2. UPDATE TOP BAR (Agar Gak Dianggurin)
    // Ambil semua persentase file yang ada di layar, lalu hitung rata-ratanya
    const allPercentEls = document.querySelectorAll('[id^="percent-"]');
    let total = 0;
    allPercentEls.forEach(el => {
        total += parseInt(el.textContent) || 0;
    });

    const averageProgress = Math.round(total / (allPercentEls.length || 1));

    // Update Progress Bar Besar di Atas (Miro Gambar 4)
    const mainBar = document.getElementById('main-progress-bar');
    const overallText = document.getElementById('overall-percentage');

    if (mainBar) mainBar.style.width = `${averageProgress}%`;
    if (overallText) overallText.textContent = `${averageProgress}%`;

    // 3. TRIGGER SELESAI (Hanya jika rata-rata sudah 100%)
    if (averageProgress >= 100) {
        setTimeout(() => {
            showTransferCompleteUI(); // Panggil layar centang hijau (Miro Gambar 5)
        }, 800);
    }
};

function showTransferCompleteUI() {
    const mainContent = document.querySelector('#transfer-progress-overlay main');
    if (!mainContent) return;

    // Ganti isi overlay dengan tampilan Centang Hijau (Miro Style)
    mainContent.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
            <div class="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40 mb-8">
                <span class="material-symbols-outlined text-6xl">check</span>
            </div>
            <h1 class="text-5xl font-bold text-slate-900 mb-4">Transfer Complete!</h1>
            <p class="text-slate-500 text-lg max-w-md">Successfully delivered all files to the recipients in the group.</p>
            
            <div class="mt-12 flex gap-4">
                <button onclick="endTransferSession()" class="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:brightness-110 transition-all">
                    Return Home
                </button>
                <button onclick="window.location.reload()" class="px-8 py-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all">
                    Share Again
                </button>
            </div>
        </div>
    `;
}

// function endTransferSession() {
//     const overlay = document.getElementById('transfer-progress-overlay');
//     if (overlay) {
//         overlay.classList.add('hidden');
//         overlay.classList.remove('flex');
//     }
//     // Refresh page untuk reset koneksi (bersih-bersih)
//     window.location.reload();
// }

function endTransferSession() {
    // Panggil fungsi reset di app.js daripada reload halaman
    if (window.resetTransferState) {
        window.resetTransferState();
        if(window.showToast) window.showToast('Transfer session ended', 'info');
    } else {
        window.location.reload(); // Fallback jika fungsi reset belum ke-load
    }
}

// ==========================================
// UPLOAD ZONE LOGIC
// ==========================================

// 1. Global Click Listener (Event Delegation)
// Menangani klik tombol "Select Files" dengan aman (Anti-Gagal)
document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'select-files-btn' || e.target.closest('#select-files-btn'))) {
        console.log("[UI] Select Files button clicked.");

        let input = document.getElementById('file-upload-input');

        // SAFETY NET: Jika input hilang dari DOM (karena re-render), buat baru secara manual
        if (!input) {
            console.warn("[UI] Input element missing. Creating manually...");
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-upload-input';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);

            // Pasang listener khusus untuk input buatan ini
            input.addEventListener('change', function(evt) {
                if (evt.target.files.length > 0) {
                    handleFiles(evt.target.files);
                }
            });
        }

        input.click();
    }
});

// 2. Global Change Listener (Untuk input bawaan HTML jika ada)
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'file-upload-input') {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    }
});

// 3. Init Drag & Drop (Polling elemen dinamis)
function initFileUpload() {
    console.log("[UI] Initializing Drag & Drop...");

    // Cek elemen tiap detik sampai ketemu
    const checkInterval = setInterval(() => {
        const dropZone = document.getElementById('upload-zone');

        if (dropZone) {
            console.log("[UI] Drop Zone found. Listeners attached.");
            clearInterval(checkInterval);

            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.classList.add('border-primary', 'bg-blue-50');
            };
            dropZone.ondragleave = (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-blue-50');
            };
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-blue-50');
                handleFiles(e.dataTransfer.files);
            };
        }
    }, 1000);
}

// 4. Central File Handler
function handleFiles(files) {
    console.log("[UI] Processing files:", files);

    // Kirim ke App.js
    if (window.handleFilesSelected) {
        window.handleFilesSelected(files);

        // UI Feedback
        if(window.showToast) window.showToast(`${files.length} files READY to send!`, 'success');

        // Update Teks di Kotak Upload
        const titleEl = document.querySelector('#upload-zone h4');
        const descEl = document.querySelector('#upload-zone p');

        if(titleEl) {
            titleEl.textContent = `${files.length} File(s) Selected`;
            titleEl.classList.add('text-primary');
        }
        if(descEl) descEl.textContent = "Click 'Create Group' above to send.";

    } else {
        console.error("[UI] Error: App.js not ready (handleFilesSelected missing)");
    }
}

// Expose Global
window.initFileUpload = initFileUpload;
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