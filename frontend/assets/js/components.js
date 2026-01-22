/**
 * GopherDrop - Reusable Components
 */

// Pagination Settings
const DEVICES_PER_PAGE = 6;
let currentPage = 1;

// Device Data (Empty by default, populated via WebSocket)
let availableDevices = [];

// Device Card Component
function createDeviceCard(device) {
    const statusClass = device.status === 'Connected' ? 'bg-green-500' : 'bg-primary/40';
    const statusText = device.status ? device.status.toUpperCase() : 'AVAILABLE';

    // Checkbox style
    const selectedClass = device.checked
        ? 'border-primary bg-primary/10'
        : '';
    const checkClass = device.checked
        ? 'bg-primary text-white border-primary'
        : 'bg-transparent border-2 border-slate-400 text-transparent';

    // Determine icon based on name (simple heuristic)
    let icon = 'smartphone';
    if (device.name.toLowerCase().includes('mac') || device.name.toLowerCase().includes('laptop')) icon = 'laptop_mac';
    else if (device.name.toLowerCase().includes('windows') || device.name.toLowerCase().includes('pc')) icon = 'desktop_windows';
    else if (device.name.toLowerCase().includes('tablet') || device.name.toLowerCase().includes('ipad')) icon = 'tablet_mac';

    return `
        <div class="device-card p-3 lg:p-5 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 cursor-pointer border-2 ${selectedClass} transition-all" 
             onclick="toggleDeviceSelection('${device.public_key}')">
            <!-- Checkbox -->
            <div class="checkbox-indicator w-6 h-6 lg:w-7 lg:h-7 rounded-md ${checkClass} flex items-center justify-center flex-shrink-0 transition-all">
                <span class="material-symbols-outlined text-sm lg:text-base">check</span>
            </div>
            <div class="device-icon w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-xl lg:text-2xl">${icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold truncate text-sm lg:text-base">${device.name}</p>
                <div class="flex items-center gap-1.5 lg:gap-2">
                    <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${statusClass}"></span>
                    <span class="text-[9px] lg:text-[11px] font-bold uppercase tracking-wider">${statusText}</span>
                </div>
            </div>
            <button class="p-1 flex-shrink-0" onclick="event.stopPropagation(); showDeviceMenu('${device.public_key}')">
                <span class="material-symbols-outlined text-lg lg:text-xl">more_vert</span>
            </button>
        </div>
    `;
}

// Toggle device selection
function toggleDeviceSelection(publicKey) {
    const device = availableDevices.find(d => d.public_key === publicKey);
    if (device) {
        device.checked = !device.checked;
        renderDevicesWithPagination();
    }
}

// Get paginated devices
function getPaginatedDevices() {
    const startIndex = (currentPage - 1) * DEVICES_PER_PAGE;
    const endIndex = startIndex + DEVICES_PER_PAGE;
    return availableDevices.slice(startIndex, endIndex);
}

// Get total pages
function getTotalPages() {
    return Math.ceil(availableDevices.length / DEVICES_PER_PAGE);
}

// Render Device List with Pagination
function renderDevicesWithPagination() {
    const container = document.getElementById('device-list');
    if (!container) return;

    if (availableDevices.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400">
                <span class="material-symbols-outlined text-4xl mb-2">radar</span>
                <p>Scanning for devices...</p>
            </div>
        `;
        document.getElementById('device-count').textContent = 'SEARCHING...';
        document.getElementById('pagination').innerHTML = ''; // Clear pagination
        return;
    }

    const paginatedDevices = getPaginatedDevices();
    container.innerHTML = paginatedDevices.map(device => createDeviceCard(device)).join('');

    // Update device count
    const countEl = document.getElementById('device-count');
    if (countEl) {
        countEl.textContent = `${availableDevices.length} FOUND`;
    }

    // Render pagination
    renderPagination();
}

// Update Device List (Called from WebSocket)
function updateDeviceList(devices) {
    if (!devices) return;

    console.log("Updating UI with devices:", devices);

    // Map backend data to frontend format, preserving checked state
    const newDevices = devices.map(d => {
        const existing = availableDevices.find(old => old.public_key === d.public_key);
        return {
            name: d.username,
            public_key: d.public_key,
            status: 'Available',
            checked: existing ? existing.checked : false
        };
    });

    // Filter out self (optional, dependent on if backend sends self)
    const myName = localStorage.getItem('gdrop_device_name');
    availableDevices = newDevices.filter(d => d.name !== myName);

    renderDevicesWithPagination();
}
window.updateDeviceList = updateDeviceList; // Export globally

// Render Pagination
function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = getTotalPages();

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="pagination-btn w-8 h-8 lg:w-10 lg:h-10 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHTML += `
            <button class="pagination-btn ${activeClass} w-8 h-8 lg:w-10 lg:h-10 text-xs lg:text-sm" 
                    onclick="goToPage(${i})">${i}</button>
        `;
    }

    paginationHTML += `
        <button class="pagination-btn w-8 h-8 lg:w-10 lg:h-10 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
        </button>
    `;

    container.innerHTML = paginationHTML;
}

// Go to specific page
function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderDevicesWithPagination();
    document.getElementById('device-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Legacy function stub to prevent errors
function renderDevices(devices, containerId) {
    // No-op or redirect to updateDeviceList if format matches
}

// Device Menu Handler
function showDeviceMenu(deviceId) {
    console.log('Show menu for device:', deviceId);
}

// Get Selected Devices
function getSelectedDevices() {
    return availableDevices.filter(d => d.checked);
}

// Open Create Group Modal
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

// Close Create Group Modal
function closeCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        const input = document.getElementById('new-group-name');
        if (input) input.value = '';
    }
}

// Render selected devices in modal
function renderSelectedDevicesInModal(devices) {
    const container = document.getElementById('selected-devices-list');
    const countEl = document.getElementById('selected-count-modal');

    if (countEl) {
        countEl.textContent = `(${devices.length})`;
    }

    if (!container) return;

    // Determine icon (duplicate logic, should refactor helper if used widely)
    const getIcon = (name) => {
        if (name.toLowerCase().includes('mac') || name.toLowerCase().includes('laptop')) return 'laptop_mac';
        return 'smartphone';
    };

    container.innerHTML = devices.map(device => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div class="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                <span class="material-symbols-outlined text-lg">${getIcon(device.name)}</span>
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

// Confirm Create Group
function confirmCreateGroup() {
    const nameInput = document.getElementById('new-group-name');
    const groupName = nameInput?.value.trim();

    if (!groupName) {
        alert('Please enter a group name.');
        nameInput?.focus();
        return;
    }

    const selectedDevices = getSelectedDevices();

    console.log('Creating group:', {
        name: groupName,
        devices: selectedDevices.map(d => d.public_key)
    });

    alert(`Group "${groupName}" created with ${selectedDevices.length} devices!`);

    availableDevices.forEach(d => d.checked = false);
    renderDevicesWithPagination();
    closeCreateGroupModal();
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('device-list')) {
        renderDevicesWithPagination(); // Render empty/scanning state initially
    }
    document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupModal);
});
