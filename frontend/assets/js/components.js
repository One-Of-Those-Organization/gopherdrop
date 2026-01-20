/**
 * GopherDrop - Reusable Components
 */

// Device Card Component
function createDeviceCard(device) {
    const statusClass = device.status === 'Connected' ? 'bg-green-500' : 'bg-primary/40';
    const statusText = device.status.toUpperCase();
    const checkedAttr = device.checked ? 'checked' : '';

    return `
        <div class="device-card p-5 rounded-2xl flex items-center gap-4">
            <input ${checkedAttr} class="custom-checkbox" type="checkbox" data-device-id="${device.id}"/>
            <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <span class="material-symbols-outlined text-2xl">${device.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-900 truncate">${device.name}</p>
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${statusClass}"></span>
                    <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">${statusText}</span>
                </div>
            </div>
            <button class="text-slate-400 hover:text-slate-600" onclick="showDeviceMenu('${device.id}')">
                <span class="material-symbols-outlined">more_vert</span>
            </button>
        </div>
    `;
}

// Render Device List
function renderDevices(devices, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = devices.map(device => createDeviceCard(device)).join('');
}

// Sample Device Data
const sampleDevices = [
    { id: '1', name: "Daniel's MacBook Pro", icon: 'laptop_mac', status: 'Connected', checked: true },
    { id: '2', name: "Siti Android Phone", icon: 'smartphone', status: 'Available', checked: false },
    { id: '3', name: "Office-Workstation", icon: 'desktop_windows', status: 'Available', checked: false },
    { id: '4', name: "Marketing iPad Air", icon: 'tablet_mac', status: 'Available', checked: false },
    { id: '5', name: "HR-Laptop-04", icon: 'laptop_windows', status: 'Connected', checked: false },
    { id: '6', name: "Guest iPhone 13", icon: 'smartphone', status: 'Available', checked: false },
];

// Device Menu Handler
function showDeviceMenu(deviceId) {
    console.log('Show menu for device:', deviceId);
    // Add your menu logic here
}

// Get Selected Devices
function getSelectedDevices() {
    const checkboxes = document.querySelectorAll('.custom-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.deviceId);
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Auto-render devices if container exists
    if (document.getElementById('device-list')) {
        renderDevices(sampleDevices, 'device-list');
    }
});
