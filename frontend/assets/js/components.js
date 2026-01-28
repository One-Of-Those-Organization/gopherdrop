// ==========================================
// Global State
// ==========================================
window.currentDevices = window.currentDevices || [];
const DEVICES_PER_PAGE = 6;
let currentPage = 1;

// ==========================================
// Backend Integration Logic
// ==========================================

function updateDeviceListFromBackend(backendUsers) {

    if (!backendUsers || !Array.isArray(backendUsers)) {
        return;
    }

    const myPublicKey = localStorage.getItem('gdrop_public_key');

    // Simpan state checked biar gak ilang pas refresh polling
    const checkedIds = new Set(window.currentDevices.filter(d => d.checked).map(d => d.id));

    window.currentDevices = backendUsers
        .filter(item => item.user && item.user.public_key !== myPublicKey)
        .map((item) => {
            const userId = item.user.public_key;
            return {
                id: userId,
                name: item.user.username || 'Unknown Device',
                icon: 'computer',
                status: 'Connected',
                checked: checkedIds.has(userId)
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
    if (window.currentDevices.length === 0) {
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
        if (countEl) countEl.textContent = '0 FOUND';
        return;
    }

    const startIndex = (currentPage - 1) * DEVICES_PER_PAGE;
    const paginatedDevices = window.currentDevices.slice(startIndex, startIndex + DEVICES_PER_PAGE);

    container.innerHTML = paginatedDevices.map(device => createDeviceCard(device)).join('');

    // Update Counter
    const countEl = document.getElementById('device-count');
    if (countEl) countEl.textContent = `${currentDevices.length} FOUND`;

    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.ceil(window.currentDevices.length / DEVICES_PER_PAGE);

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
    const device = window.currentDevices.find(d => d.id === deviceId);
    if (device) {
        device.checked = !device.checked;
        renderDevicesWithPagination();
    }
}

function getSelectedDevices() {
    return window.currentDevices.filter(d => d.checked);
}

// ==========================================
// Modal & Group Logic (Legacy Support)
// ==========================================

function openCreateGroupModal() {
    const selected = getSelectedDevices();
    if (selected.length === 0) {
        if (window.showToast) window.showToast('Select a device first!', 'warning');
        return;
    }

    const container = document.getElementById('selected-devices-list');
    if (container) {
        // Render selected devices
        let html = selected.map(d => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-2">
                <span class="font-bold text-sm text-slate-700">${d.name}</span>
                <span class="material-symbols-outlined text-green-500 text-sm">check_circle</span>
            </div>
        `).join('');

        // Add existing groups section if any exist
        const existingGroups = window.loadGroupsFromStorage ? window.loadGroupsFromStorage() : [];
        if (existingGroups.length > 0) {
            html += `
                <div class="mt-4 pt-4 border-t border-slate-200">
                    <label class="block text-[10px] lg:text-xs font-black uppercase tracking-[0.15em] text-slate-400 mb-3">Or Send to Existing Group</label>
                    <div class="space-y-2">
                        ${existingGroups.map(g => `
                            <button onclick="sendToExistingGroup('${g.id}')" class="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all">
                                <div class="flex items-center gap-3">
                                    <span class="material-symbols-outlined text-primary">group</span>
                                    <div class="text-left">
                                        <span class="font-bold text-sm text-slate-700 block">${g.name}</span>
                                        <span class="text-[10px] text-slate-400">${g.devices ? g.devices.length : 0} members</span>
                                    </div>
                                </div>
                                <span class="material-symbols-outlined text-slate-300">arrow_forward</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    const countEl = document.getElementById('selected-count-modal');
    if (countEl) countEl.textContent = `(${selected.length})`;

    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
}

// Send selected devices to an existing group
function sendToExistingGroup(groupId) {
    const selectedDevices = getSelectedDevices();
    if (selectedDevices.length === 0) return;

    // Get the group
    const groups = window.loadGroupsFromStorage ? window.loadGroupsFromStorage() : [];
    const group = groups.find(g => g.id === groupId);
    if (!group) {
        if (window.showToast) window.showToast('Group not found', 'error');
        return;
    }

    // Check if files are selected
    const filesData = sessionStorage.getItem('gdrop_transfer_files');
    const hasFiles = filesData && JSON.parse(filesData).length > 0;

    if (!hasFiles) {
        // Show file upload prompt
        showFileUploadPrompt(() => {
            // Continue with sending after files selected
            proceedWithSendToExistingGroup(groupId, group, selectedDevices);
        });
        return;
    }

    proceedWithSendToExistingGroup(groupId, group, selectedDevices);
}

function proceedWithSendToExistingGroup(groupId, group, selectedDevices) {
    const sendBtn = document.getElementById('send-direct-btn');

    if (sendBtn && sendBtn.disabled) return;

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Sending...';
    }

    if (window.resetTransferState) window.resetTransferState(false);
    // Add devices to group (avoid duplicates)
    const existingIds = new Set((group.devices || []).map(d => d.id));
    const newDevices = selectedDevices
        .filter(d => !existingIds.has(d.id))
        .map(d => ({
            id: d.id,
            name: d.name,
            icon: d.icon || 'computer',
            status: 'Saved'
        }));

    if (newDevices.length > 0 && window.updateGroupInStorage) {
        group.devices = [...(group.devices || []), ...newDevices];
        window.updateGroupInStorage(groupId, { devices: group.devices });
    }

    // Set session storage for transfer
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));
    sessionStorage.setItem('gdrop_group_name', group.name);
    sessionStorage.setItem('gdrop_current_group_id', groupId);

    // Start transfer
    if (window.startTransferProcess) {
        window.startTransferProcess();
        closeCreateGroupModal();

        const addedMsg = newDevices.length > 0 ? ` (${newDevices.length} new added to group)` : '';
        if (window.showToast) window.showToast(`Sending to "${group.name}"${addedMsg}`, 'success');
    }
}

function confirmCreateGroup() {
    const name = document.getElementById('new-group-name').value;
    if (!name) {
        if (window.showToast) window.showToast('Enter group name', 'error');
        return;
    }

    const selectedDevices = getSelectedDevices();

    // Check if files are selected
    const filesData = sessionStorage.getItem('gdrop_transfer_files');
    const hasFiles = filesData && JSON.parse(filesData).length > 0;

    if (!hasFiles) {
        // Show file upload prompt
        showFileUploadPrompt(() => {
            // Callback after file upload - continue with group creation
            proceedWithGroupCreation(name, selectedDevices);
        });
        return;
    }

    proceedWithGroupCreation(name, selectedDevices);
}

function proceedWithGroupCreation(name, selectedDevices) {
    const sendBtn = document.getElementById('send-direct-btn');

    if (sendBtn && sendBtn.disabled) return;

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Sending...';
    }

    if (window.resetTransferState) window.resetTransferState(false);
    // Simpan ke Session Storage buat dikirim via WS app.js
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));
    sessionStorage.setItem('gdrop_group_name', name);

    let groupId = null;
    if (window.addGroupToStorage && window.generateGroupId) {
        groupId = window.generateGroupId();
        const newGroup = {
            id: groupId,
            name: name,
            description: `Created on ${new Date().toLocaleDateString()} with ${selectedDevices.length} device(s)`,
            devices: selectedDevices.map(d => ({
                id: d.id,
                name: d.name,
                icon: d.icon || 'computer',
                status: 'Saved'
            })),
            createdAt: new Date().toISOString()
        };
        window.addGroupToStorage(newGroup);
        sessionStorage.setItem('gdrop_current_group_id', groupId);
    }
    // ================================================

    if (window.startTransferProcess) {
        window.startTransferProcess();
        closeCreateGroupModal();
        if (window.showToast) window.showToast('Group Created & Saved! Waiting for accept...', 'success');
    }
}

// Show file upload prompt modal
function showFileUploadPrompt(onFilesSelected) {
    let modal = document.getElementById('file-upload-prompt-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'file-upload-prompt-modal';
        modal.className = 'fixed inset-0 z-[110] flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeFileUploadPrompt()"></div>
            <div class="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900">No Files Selected</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 transition-all" onclick="closeFileUploadPrompt()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="text-center py-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-3xl text-primary">upload_file</span>
                    </div>
                    <p class="text-slate-600 mb-6">Please select files to send before creating the group.</p>
                    <input type="file" id="prompt-file-input" multiple class="hidden" />
                    <button onclick="triggerPromptFileSelect()" class="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-105 transition-all mb-3">
                        <span class="material-symbols-outlined mr-2 align-middle">folder_open</span>
                        Select Files
                    </button>
                    <button onclick="closeFileUploadPrompt()" class="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Store callback
    window._fileUploadCallback = onFilesSelected;

    // Setup file input listener
    const fileInput = document.getElementById('prompt-file-input');
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            if (window.handleFilesSelected) {
                window.handleFilesSelected(e.target.files);
            }
            closeFileUploadPrompt();
            if (window._fileUploadCallback) {
                window._fileUploadCallback();
                window._fileUploadCallback = null;
            }
        }
    };

    modal.classList.remove('hidden');
}

function closeFileUploadPrompt() {
    const modal = document.getElementById('file-upload-prompt-modal');
    if (modal) modal.classList.add('hidden');
    window._fileUploadCallback = null;
}

function triggerPromptFileSelect() {
    document.getElementById('prompt-file-input').click();
}

// ==========================================
// Toast Notification
// ==========================================

let toastTimeoutId;

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');

    // Create some New Container if not exists
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        // Styling container (Fixed position top-center)
        container.className = 'fixed top-10 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center w-full max-w-sm pointer-events-none';
        document.body.appendChild(container);
    }

    // Delete the Previous Toast and replace with new one
    container.innerHTML = '';
    if (toastTimeoutId) clearTimeout(toastTimeoutId);

    // Create Toast Element
    const toast = document.createElement('div');

    // Config Color
    let icon = 'info';
    let colorClass = 'border-blue-500 bg-white text-slate-800';

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

    // Add some styling and content
    toast.className = `flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-l-4 transform transition-all duration-500 -translate-y-full opacity-0 pointer-events-auto min-w-[300px] w-full ${colorClass}`;

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

    // Append to container
    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-full', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Timer to auto-remove
    toastTimeoutId = setTimeout(() => {
        if (toast) {
            // Animate Out
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('-translate-y-full', 'opacity-0');

            // Delete after animation
            setTimeout(() => {
                // Check if still in DOM
                if (toast.parentElement) toast.remove();
            }, 500);
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
    if (countEl) countEl.textContent = `${files.length} ITEMS`;

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

// ==========================================
// Transfer Progress UI Logic (Dynamic Loading)
// ==========================================

async function loadTransferProgressView() {
    let overlay = document.getElementById('transfer-progress-overlay');
    if (overlay) return overlay;

    try {
        const response = await fetch('pages/transfer-progress.html');
        if (!response.ok) throw new Error("Failed to load transfer page");

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract content from body
        const nav = doc.querySelector('nav');
        const main = doc.querySelector('main');

        if (!nav || !main) throw new Error("Invalid page structure");

        // Create overlay container
        overlay = document.createElement('div');
        overlay.id = 'transfer-progress-overlay';
        overlay.className = 'fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col transition-all duration-300 font-sans';

        // Inject content
        overlay.appendChild(nav.cloneNode(true));
        overlay.appendChild(main.cloneNode(true));

        document.body.appendChild(overlay);

        // Alias cancelTransfer for compatibility
        window.cancelTransfer = window.endTransferSession;

        return overlay;
    } catch (e) {
        return null;
    }
}

async function showTransferProgressUI(files, deviceCount, isReceiver = false) {
    // Save state for completion screen
    window.lastTransferFiles = files;
    window.transferStartTime = Date.now();
    window.transferRecipientCount = deviceCount;
    window.isReceiverMode = isReceiver; // Save for completion screen

    // 1. Ensure view is loaded
    let overlay = document.getElementById('transfer-progress-overlay');
    if (!overlay) {
        overlay = await loadTransferProgressView();
        if (!overlay) {
            alert("Failed to load transfer UI");
            return;
        }
    }

    // --- LOGIC RESET UNTUK TOP BAR (Biar gak dianggurin) ---
    const overallText = document.getElementById('overall-percentage');
    if (overallText) overallText.textContent = "0%";
    const mainBar = document.getElementById('main-progress-bar');
    if (mainBar) mainBar.style.width = "0%";
    // -------------------------------------------------------

    // 2. Update Text Header & Save Device Name
    const peerName = (!isReceiver && (window.selectedDeviceName || sessionStorage.getItem('gdrop_group_name')))
        ? (window.selectedDeviceName || sessionStorage.getItem('gdrop_group_name'))
        : (isReceiver ? (window.senderDeviceName || "Sender") : "Device"); // Use sender name for receiver

    window.peerDeviceName = peerName; // Save for completion screen

    const actionText = isReceiver ? "Receiving" : "Sending";
    const subText = isReceiver ? "Receiving from" : "Transferring to";

    // Update specific text spans (Adaptive UI)
    const actionTextEl = overlay.querySelector('#transfer-action-text');
    const directionTextEl = overlay.querySelector('#transfer-direction-text');
    const recipientCountEl = overlay.querySelector('#recipient-count');

    if (actionTextEl) actionTextEl.textContent = actionText;
    if (directionTextEl) directionTextEl.textContent = subText;

    // For Sender: Display Target Name. For Receiver: Display Count or Sender Name if avail.
    if (recipientCountEl) {
        if (!isReceiver && peerName && peerName !== "Device") {
            recipientCountEl.textContent = peerName;
        } else {
            recipientCountEl.textContent = `${deviceCount || 1} devices`;
        }
    }

    // Update numeric values
    const badgeEl = overlay.querySelector('#total-items-badge');
    if (badgeEl) badgeEl.textContent = `${files.length} files`;

    // 3. Render Queue (Card Style)
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
    if (!container) return;

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

        const peerName = (count === 1 && (window.selectedDeviceName || sessionStorage.getItem('gdrop_group_name')))
            ? (window.selectedDeviceName || sessionStorage.getItem('gdrop_group_name'))
            : `Device ${i + 1}`;

        node.innerHTML = `
            <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-2 animate-bounce" style="animation-delay: ${i * 0.2}s">
                <span class="material-symbols-outlined text-slate-400 dark:text-slate-500">smartphone</span>
            </div>
            <p class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px] mb-1">${peerName}</p>
            <span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase">Connected</span>
        `;
        container.appendChild(node);
    }
}

window.updateFileProgressUI = function (fileName, percentage) {
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
            showTransferCompleteUI(); // Panggil layar completion screen
        }, 800);
    }
};

function endTransferSession() {
    if (window.resetTransferState) {
        window.resetTransferState();
        if (window.showToast) window.showToast('Transfer session ended', 'info');
    } else {
        window.location.reload();
    }
}

// ==========================================
// UPLOAD ZONE LOGIC
// ==========================================

// 1. Global Click Listener (Event Delegation)
// Menangani klik tombol "Select Files" dengan aman (Anti-Gagal)
document.addEventListener('click', function (e) {
    if (e.target && (e.target.id === 'select-files-btn' || e.target.closest('#select-files-btn'))) {

        let input = document.getElementById('file-upload-input');

        // SAFETY NET: Jika input hilang dari DOM (karena re-render), buat baru secara manual
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-upload-input';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);

            // Pasang listener khusus untuk input buatan ini
            input.addEventListener('change', function (evt) {
                if (evt.target.files.length > 0) {
                    handleFiles(evt.target.files);
                }
            });
        }

        input.click();
    }
});

// 2. Global Change Listener (Untuk input bawaan HTML jika ada)
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'file-upload-input') {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    }
});

// 3. Init Drag & Drop (Polling elemen dinamis)
function initFileUpload() {

    // Cek elemen tiap detik sampai ketemu
    const checkInterval = setInterval(() => {
        const dropZone = document.getElementById('upload-zone');

        if (dropZone) {
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

    // Kirim ke App.js
    if (window.handleFilesSelected) {
        window.handleFilesSelected(files);

        // Save to IndexedDB for persistence
        if (window.saveFilesToDB) {
            window.saveFilesToDB(Array.from(files)).then(() => {
            }).catch(err => {
            });
        }

        // UI Feedback
        if (window.showToast) window.showToast(`${files.length} files READY to send!`, 'success');

        // Update Teks di Kotak Upload
        const titleEl = document.querySelector('#upload-zone h4');
        const descEl = document.querySelector('#upload-zone p');

        if (titleEl) {
            titleEl.textContent = `${files.length} File(s) Selected`;
            titleEl.classList.add('text-primary');
        }
        if (descEl) descEl.textContent = "Click 'Create Group' above to send.";

    } else {
    }
}

// 5. Load Saved Files on Page Load
async function loadSavedFiles() {
    if (!window.loadFilesFromDB) {
        return;
    }

    try {
        const savedFiles = await window.loadFilesFromDB();
        if (savedFiles && savedFiles.length > 0) {

            // Restore to App.js
            if (window.handleFilesSelected) {
                window.handleFilesSelected(savedFiles);
            }

            // Update UI
            const titleEl = document.querySelector('#upload-zone h4');
            const descEl = document.querySelector('#upload-zone p');

            if (titleEl) {
                titleEl.textContent = `${savedFiles.length} File(s) Restored`;
                titleEl.classList.add('text-primary');
            }
            if (descEl) descEl.textContent = "Files restored from previous session.";

            if (window.showToast) {
                window.showToast(`${savedFiles.length} file(s) restored from previous session!`, 'info');
            }
        }
    } catch (error) {
    }
}

// Auto-load saved files when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for upload zone to be rendered
    setTimeout(loadSavedFiles, 2000);
});

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
window.sendToExistingGroup = sendToExistingGroup;
window.showFileUploadPrompt = showFileUploadPrompt;
window.closeFileUploadPrompt = closeFileUploadPrompt;
window.triggerPromptFileSelect = triggerPromptFileSelect;

// ==========================================
// Transfer Complete UI Logic (Dynamic Loading)
// ==========================================

async function loadTransferCompleteView() {
    let overlay = document.getElementById('transfer-complete-overlay');
    if (overlay) return overlay;

    try {
        const response = await fetch('pages/transfer-complete.html');
        if (!response.ok) throw new Error("Failed to load complete page");

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const nav = doc.querySelector('nav');
        const main = doc.querySelector('main');
        const footer = doc.querySelector('footer');
        const decorative = doc.querySelectorAll('body > div'); // Background confettis

        if (!main) throw new Error("Invalid structure");

        // Create overlay container (Full Screen, High Z-Index)
        overlay = document.createElement('div');
        overlay.id = 'transfer-complete-overlay';
        overlay.className = 'fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-all duration-500 opacity-0';

        // Inject Decorative
        decorative.forEach(el => overlay.appendChild(el.cloneNode(true)));

        // Inject Content
        if (nav) overlay.appendChild(nav.cloneNode(true));
        overlay.appendChild(main.cloneNode(true));
        if (footer) overlay.appendChild(footer.cloneNode(true));

        document.body.appendChild(overlay);

        // Alias reload for compatibility
        window.reloadApp = () => window.location.reload();

        // Fade In
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
        });

        return overlay;
    } catch (e) {
        return null;
    }
}

async function showTransferCompleteUI() {
    // 1. Sembunyikan Progress Bar
    const progressOverlay = document.getElementById('transfer-progress-overlay');
    if (progressOverlay) progressOverlay.style.display = 'none';

    // 2. Load View
    let overlay = await loadTransferCompleteView();
    if (!overlay) {
        window.location.reload();
        return;
    }

    // Mengambil settingan terakhir user, default ke 'light'
    const storedTheme = localStorage.getItem('gopherdrop-theme') || 'light';
    if (window.applyTheme) {
        window.applyTheme(storedTheme);
    }
    // Safety check: Paksa hapus class dark jika settingan light
    if (storedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        overlay.classList.remove('dark'); // Pastikan overlay juga bersih
    }
    // -------------------------------------------------------

    // 3. Persiapan Data
    const files = window.lastTransferFiles || [];
    const isReceiver = window.isReceiverMode || false;

    // Logika Nama: Jika Receiver -> Tampilkan Nama Pengirim. Jika Sender -> Tampilkan Penerima.
    const peerName = isReceiver
        ? (window.senderDeviceName || "Unknown Sender")
        : (window.peerDeviceName || (window.transferRecipientCount > 1 ? "Multiple Devices" : "Recipient"));

    const startTime = window.transferStartTime || Date.now();
    let duration = Date.now() - startTime;
    if (duration < 1000) duration = 1000;

    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

    // Formatter Helpers
    const formatTime = (ms) => {
        const s = Math.floor(ms / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
    };
    const formatSize = (b) => {
        if (b === 0) return '0 B';
        const i = Math.floor(Math.log(b) / Math.log(1024));
        return (b / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    // 4. Update Elemen Teks Dasar
    const timeEl = overlay.querySelector('#complete-time-elapsed');
    const sizeEl = overlay.querySelector('#complete-total-size');
    const groupNameEl = overlay.querySelector('#complete-group-name');
    const titleEl = overlay.querySelector('h1');
    const descEl = overlay.querySelector('main > section > p');

    // Label kecil di atas nama (Group Insights / Sent By)
    const cardTitleLabel = overlay.querySelector('#complete-group-name').previousElementSibling;

    if (timeEl) timeEl.textContent = formatTime(duration);
    if (sizeEl) sizeEl.textContent = formatSize(totalSize);
    if (groupNameEl) groupNameEl.textContent = peerName;

    // 5. LOGIKA ADAPTIF (SENDER vs RECEIVER)
    if (isReceiver) {
        // --- TAMPILAN PENERIMA ---
        if (titleEl) titleEl.innerHTML = 'Files <span class="font-bold text-green-500">Received!</span>';
        if (descEl) descEl.textContent = `Successfully received files from ${peerName}.`;

        // Ubah "Group Insights" menjadi "SENT BY"
        if (cardTitleLabel) cardTitleLabel.textContent = "SENT BY";
        // Pastikan nama pengirim muncul
        if (groupNameEl) groupNameEl.textContent = peerName;
    } else {
        // --- TAMPILAN PENGIRIM ---
        if (titleEl) titleEl.innerHTML = 'Transfer <span class="font-bold text-primary">Complete!</span>';
        if (descEl) descEl.textContent = `Successfully delivered files to ${peerName}.`;

        if (cardTitleLabel) cardTitleLabel.textContent = "RECIPIENT";
        if (groupNameEl) groupNameEl.textContent = peerName;
    }

    // 6. RENDER LIST FILE
    const fileListContainer = overlay.querySelector('#complete-file-list');
    if (fileListContainer) {
        fileListContainer.innerHTML = '';

        // Jika Receiver, ambil data dari blobs agar punya URL download
        const fileSource = isReceiver ? (window.receivedFileBlobs || []) : files;

        fileSource.forEach(file => {
            // Icon Logic Sederhana
            let icon = 'description';
            if (file.type && file.type.includes('image')) icon = 'image';
            else if (file.type && file.type.includes('video')) icon = 'movie';
            else if (file.type && file.type.includes('audio')) icon = 'audio_file';

            // Tombol Aksi di Kanan (Download vs Centang)
            let actionButton = '';
            if (isReceiver && file.url) {
                // Tombol Re-Download (Receiver)
                actionButton = `
                    <a href="${file.url}" download="${file.name}" class="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all" title="Download Again">
                        <span class="material-symbols-outlined">download</span>
                    </a>
                `;
            } else {
                // Centang (Sender)
                actionButton = `
                    <div class="w-10 h-10 flex items-center justify-center text-green-500">
                        <span class="material-symbols-outlined">check_circle</span>
                    </div>
                `;
            }

            const newItem = document.createElement('div');
            // Gunakan class border netral agar mengikuti tema
            newItem.className = 'glass-panel p-4 rounded-3xl flex items-center gap-4 border border-slate-200 dark:border-slate-700';
            newItem.innerHTML = `
                <div class="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 text-slate-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-2xl">${icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-800 dark:text-white truncate text-sm">${file.name}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">${file.size ? formatFileSize(file.size) : ''}</p>
                </div>
                ${actionButton}
            `;
            fileListContainer.appendChild(newItem);
        });
    }

    // 7. FIX TOMBOL FOOTER (Download All & Dashboard)
    const footerBtnContainer = overlay.querySelector('footer div:last-child');
    if (footerBtnContainer) {
        footerBtnContainer.innerHTML = ''; // Reset tombol bawaan HTML

        if (isReceiver) {
            // --- Tombol Khusus Receiver: DOWNLOAD ALL ---
            footerBtnContainer.innerHTML += `
                <button onclick="triggerDownloadAll()" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:brightness-105 transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                    <span class="material-symbols-outlined">download_for_offline</span>
                    <span>Download All</span>
                </button>
            `;
        } else {
            // --- Tombol Khusus Sender: SEND MORE ---
            footerBtnContainer.innerHTML += `
                <button onclick="endTransferSession()" class="px-6 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    Send More
                </button>
            `;
        }

        footerBtnContainer.innerHTML += `
            <button onclick="endTransferSession()" class="px-6 py-3 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold hover:bg-slate-900 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined">home</span>
                <span>Dashboard</span>
            </button>
        `;
    }
}

window.sendDirectlyToSelection = function() {
    const selectedDevices = getSelectedDevices();

    if (selectedDevices.length === 0) {
        if (window.showToast) window.showToast('Please select at least one device', 'warning');
        return;
    }

    // Cek apakah ada file yang dipilih?
    const filesData = sessionStorage.getItem('gdrop_transfer_files');
    const hasFiles = filesData && JSON.parse(filesData).length > 0;

    if (!hasFiles) {
        // Jika tidak ada file, munculkan prompt upload, lalu lanjut kirim
        showFileUploadPrompt(() => {
            proceedDirectTransfer(selectedDevices);
        });
        return;
    }

    proceedDirectTransfer(selectedDevices);
};

// Helper untuk eksekusi transfer
function proceedDirectTransfer(selectedDevices) {
    // Ambil button untuk prevent spam klik
    const sendBtn = document.getElementById('send-direct-btn');

    if (sendBtn && sendBtn.disabled) return;

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Sending...';
    }

    // Reset state transfer sebelumnya jika ada
    if (window.resetTransferState) window.resetTransferState(false);

    // 1. Simpan target device ke session
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));

    // 2. Set nama sesi sementara (misal: "2 Devices" atau nama device kalau cuma 1)
    const sessionName = selectedDevices.length === 1 ? selectedDevices[0].name : `${selectedDevices.length} Devices`;
    sessionStorage.setItem('gdrop_group_name', sessionName);

    // 3. Mulai proses transfer (panggil fungsi core di app.js)
    if (window.startTransferProcess) {
        window.startTransferProcess();
        if (window.showToast) window.showToast(`Sending to ${sessionName}...`, 'success');
    }
}

window.showTransferCompleteUI = showTransferCompleteUI;