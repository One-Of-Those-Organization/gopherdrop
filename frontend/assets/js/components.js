/**
 * GopherDrop - Reusable Components
 */

// Pagination Settings
const DEVICES_PER_PAGE = 6;
let currentPage = 1;

// Sample Device Data (more devices for pagination demo)
const sampleDevices = [
    { id: '1', name: "Daniel's MacBook Pro", icon: 'laptop_mac', status: 'Connected', checked: false },
    { id: '2', name: "Siti Android Phone", icon: 'smartphone', status: 'Available', checked: false },
    { id: '3', name: "Office-Workstation", icon: 'desktop_windows', status: 'Available', checked: false },
    { id: '4', name: "Marketing iPad Air", icon: 'tablet_mac', status: 'Available', checked: false },
    { id: '5', name: "HR-Laptop-04", icon: 'laptop_windows', status: 'Connected', checked: false },
    { id: '6', name: "Guest iPhone 13", icon: 'smartphone', status: 'Available', checked: false },
    { id: '7', name: "Server Room PC", icon: 'desktop_windows', status: 'Connected', checked: false },
    { id: '8', name: "CEO MacBook Air", icon: 'laptop_mac', status: 'Available', checked: false },
    { id: '9', name: "Reception Tablet", icon: 'tablet_mac', status: 'Available', checked: false },
    { id: '10', name: "Developer Linux Box", icon: 'computer', status: 'Connected', checked: false },
    { id: '11', name: "QA Testing Phone", icon: 'smartphone', status: 'Available', checked: false },
    { id: '12', name: "Meeting Room Display", icon: 'tv', status: 'Connected', checked: false },
    { id: '13', name: "Finance Laptop", icon: 'laptop_windows', status: 'Available', checked: false },
    { id: '14', name: "Security Camera Hub", icon: 'videocam', status: 'Connected', checked: false },
    { id: '15', name: "Intern Chromebook", icon: 'laptop_chromebook', status: 'Available', checked: false },
    { id: '16', name: "Lab Raspberry Pi", icon: 'memory', status: 'Connected', checked: false },
    { id: '17', name: "Admin Desktop", icon: 'desktop_windows', status: 'Available', checked: false },
    { id: '18', name: "Guest Android", icon: 'smartphone', status: 'Available', checked: false },
];

// Device Card Component - With new checkbox style
function createDeviceCard(device) {
    const statusClass = device.status === 'Connected' ? 'bg-green-500' : 'bg-primary/40';
    const statusText = device.status.toUpperCase();
    
    // Checkbox style - visible in both light and dark mode
    const selectedClass = device.checked 
        ? 'border-primary bg-primary/10' 
        : '';
    const checkClass = device.checked 
        ? 'bg-primary text-white border-primary' 
        : 'bg-transparent border-2 border-slate-400 text-transparent';

    return `
        <div class="device-card p-3 lg:p-5 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 cursor-pointer border-2 ${selectedClass} transition-all" 
             onclick="toggleDeviceSelection('${device.id}')">
            <!-- Checkbox -->
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

// Toggle device selection
function toggleDeviceSelection(deviceId) {
    const device = sampleDevices.find(d => d.id === deviceId);
    if (device) {
        device.checked = !device.checked;
        renderDevicesWithPagination();
    }
}

// Get paginated devices
function getPaginatedDevices() {
    const startIndex = (currentPage - 1) * DEVICES_PER_PAGE;
    const endIndex = startIndex + DEVICES_PER_PAGE;
    return sampleDevices.slice(startIndex, endIndex);
}

// Get total pages
function getTotalPages() {
    return Math.ceil(sampleDevices.length / DEVICES_PER_PAGE);
}

// Render Device List with Pagination
function renderDevicesWithPagination() {
    const container = document.getElementById('device-list');
    if (!container) return;
    
    const paginatedDevices = getPaginatedDevices();
    container.innerHTML = paginatedDevices.map(device => createDeviceCard(device)).join('');
    
    // Update device count
    const countEl = document.getElementById('device-count');
    if (countEl) {
        countEl.textContent = `${sampleDevices.length} FOUND`;
    }
    
    // Render pagination
    renderPagination();
}

// Render Pagination
function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const totalPages = getTotalPages();
    
    let paginationHTML = `
        <button class="pagination-btn w-8 h-8 lg:w-10 lg:h-10 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
    `;
    
    // Generate page numbers
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
    
    // Scroll to top of device list
    document.getElementById('device-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Legacy function for compatibility
function renderDevices(devices, containerId) {
    renderDevicesWithPagination();
}

// Device Menu Handler
function showDeviceMenu(deviceId) {
    console.log('Show menu for device:', deviceId);
    // Add your menu logic here
}

// Get Selected Devices
function getSelectedDevices() {
    return sampleDevices.filter(d => d.checked);
}

// Get Selected Device IDs
function getSelectedDeviceIds() {
    return sampleDevices.filter(d => d.checked).map(d => d.id);
}

// Open Create Group Modal
function openCreateGroupModal() {
    const selectedDevices = getSelectedDevices();
    
    if (selectedDevices.length === 0) {
        alert('Please select at least one device to create a group.');
        return;
    }
    
    // Render selected devices in modal
    renderSelectedDevicesInModal(selectedDevices);
    
    // Show modal
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Focus on input
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
        
        // Clear input
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
    
    // Here you would normally send to backend
    console.log('Creating group:', {
        name: groupName,
        devices: selectedDevices.map(d => d.id)
    });
    
    // Show success message
    alert(`Group "${groupName}" created with ${selectedDevices.length} devices!`);
    
    // Clear selections
    sampleDevices.forEach(d => d.checked = false);
    renderDevicesWithPagination();
    
    // Close modal
    closeCreateGroupModal();
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Auto-render devices if container exists
    if (document.getElementById('device-list')) {
        renderDevicesWithPagination();
    }
    
    // Attach Create Group button handler
    document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupModal);
});
