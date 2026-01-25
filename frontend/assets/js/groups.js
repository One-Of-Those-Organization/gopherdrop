/**
 * GopherDrop - Groups Page Components
 */

// Sample Groups Data
const sampleGroups = [
    { id: '1', name: 'Engineering Team', description: 'Cross-functional group for internal file synchronization.', deviceCount: 12, onlineCount: 8 },
    { id: '2', name: 'Home Network', description: 'Personal devices at home.', deviceCount: 4, onlineCount: 2 },
    { id: '3', name: 'Design Studio', description: 'Creative team workspace.', deviceCount: 6, onlineCount: 5 },
    { id: '4', name: 'Marketing Lab', description: 'Marketing department devices.', deviceCount: 15, onlineCount: 3 },
];

// Sample Group Devices Data (keyed by group id)
const groupDevicesData = {
    '1': [
        { id: '1', name: "Daniel's MacBook Pro", icon: 'laptop_mac', os: 'macOS 14.5', status: 'Online' },
        { id: '2', name: "Main-Workstation-01", icon: 'desktop_windows', os: 'Windows 11', status: 'Online' },
        { id: '3', name: "Lead Android Test", icon: 'smartphone', os: '2h ago', status: 'Offline' },
    ],
    '2': [
        { id: '4', name: "Living Room PC", icon: 'desktop_windows', os: 'Windows 10', status: 'Online' },
        { id: '5', name: "Smart TV", icon: 'tv', os: 'Android TV', status: 'Online' },
    ],
    '3': [
        { id: '6', name: "Designer MacBook", icon: 'laptop_mac', os: 'macOS 14.2', status: 'Online' },
        { id: '7', name: "iPad Pro", icon: 'tablet_mac', os: 'iPadOS 17', status: 'Online' },
    ],
    '4': [
        { id: '8', name: "Marketing Laptop", icon: 'laptop_windows', os: 'Windows 11', status: 'Online' },
    ]
};

// Current selected group
let selectedGroupId = null;

// Create Group Item
function createGroupItem(group) {
    const isActive = group.id === selectedGroupId;
    const activeClass = isActive ? 'active' : '';
    const textClass = isActive ? 'text-slate-900' : 'text-slate-700';

    return `
        <div class="group-item ${activeClass} p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 border-transparent cursor-pointer" data-group-id="${group.id}" onclick="selectGroup('${group.id}')">
            <div class="flex items-center gap-3 lg:gap-4">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold ${textClass} text-sm lg:text-base">${group.name}</h4>
                    <p class="text-[10px] lg:text-xs text-slate-500 font-medium">${group.deviceCount} Devices • ${group.onlineCount} Online</p>
                </div>
                <span class="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
        </div>
    `;
}

// Create Group Device Card
function createGroupDeviceCard(device) {
    const isOnline = device.status === 'Online';
    const statusColor = isOnline ? 'bg-green-500' : 'bg-slate-300';
    const textColor = isOnline ? 'text-slate-900' : 'text-slate-400';
    const bgClass = isOnline ? '' : 'border-dashed bg-slate-50/30';
    const iconBg = isOnline ? 'bg-slate-50' : 'bg-slate-100';
    const iconColor = isOnline ? 'text-slate-600' : 'text-slate-400';
    const osLabel = isOnline ? 'OS' : 'Last seen';

    return `
        <div class="device-card p-3 lg:p-4 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 ${bgClass}">
            <div class="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl ${iconBg} flex items-center justify-center ${iconColor}">
                <span class="material-symbols-outlined text-xl lg:text-2xl">${device.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold ${textColor} truncate text-sm lg:text-base">${device.name}</p>
                <div class="flex items-center gap-1.5 lg:gap-2">
                    <span class="w-1.5 h-1.5 rounded-full ${statusColor}"></span>
                    <span class="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-wider">${device.status}</span>
                </div>
            </div>
            <div class="text-right hidden sm:block">
                <p class="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase">${osLabel}</p>
                <p class="text-[10px] lg:text-xs font-bold ${isOnline ? 'text-slate-700' : 'text-slate-500'}">${device.os}</p>
            </div>
        </div>
    `;
}

// Add Device Button
function createAddDeviceButton() {
    return `
        <button class="p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 lg:gap-3 text-slate-400 hover:border-primary hover:text-primary transition-all text-sm lg:text-base" id="add-device-btn">
            <span class="material-symbols-outlined">add</span>
            <span class="font-bold">Add Device</span>
        </button>
    `;
}

// Render Groups List
function renderGroups(groups, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = groups.map(group => createGroupItem(group)).join('');
}

// Render Group Devices
function renderGroupDevices(devices, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const deviceCards = devices.map(device => createGroupDeviceCard(device)).join('');
    container.innerHTML = deviceCards + createAddDeviceButton();
}

// Select Group Handler (toggles detail panel)
function selectGroup(groupId) {
    // If clicking the same group, close detail panel
    if (selectedGroupId === groupId) {
        hideGroupDetail();
        return;
    }

    selectedGroupId = groupId;

    // Remove active from all group items
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
        item.querySelector('h4').classList.remove('text-slate-900');
        item.querySelector('h4').classList.add('text-slate-700');
    });

    // Add active to selected group item
    const selectedItem = document.querySelector(`[data-group-id="${groupId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
        selectedItem.querySelector('h4').classList.remove('text-slate-700');
        selectedItem.querySelector('h4').classList.add('text-slate-900');
    }

    // Get group data
    const group = sampleGroups.find(g => g.id === groupId);
    if (!group) return;

    // Update group detail header
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-description').textContent = group.description;

    // Update online count
    const onlineCountEl = document.getElementById('online-count-text');
    if (onlineCountEl) {
        onlineCountEl.textContent = `${group.onlineCount} Online`;
    }

    // Render devices for this group
    const devices = groupDevicesData[groupId] || [];
    renderGroupDevices(devices, 'group-devices');

    // Show detail panel
    showGroupDetail();
}

// Show Group Detail Panel
function showGroupDetail() {
    const detail = document.getElementById('group-detail-container');
    const groupList = document.getElementById('group-list-container');

    if (detail) {
        detail.classList.remove('hidden');
        detail.classList.add('flex');
    }

    // Shrink group list to fixed width when detail is shown
    if (groupList) {
        groupList.classList.remove('lg:flex-1');
        groupList.classList.add('lg:w-96', 'lg:flex-shrink-0');
    }
}

// Hide Group Detail (back to list - for mobile)
function hideGroupDetail() {
    const detail = document.getElementById('group-detail-container');
    const groupList = document.getElementById('group-list-container');

    if (detail) {
        detail.classList.add('hidden');
        detail.classList.remove('flex');
    }

    // Expand group list to fill space when detail is hidden
    if (groupList) {
        groupList.classList.add('lg:flex-1');
        groupList.classList.remove('lg:w-96', 'lg:flex-shrink-0');
    }

    // Clear selection
    selectedGroupId = null;
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
        item.querySelector('h4').classList.remove('text-slate-900');
        item.querySelector('h4').classList.add('text-slate-700');
    });
}

// Navigate to Edit Group page
function navigateToEditGroup() {
    if (selectedGroupId) {
        window.location.href = `edit-group.html?id=${selectedGroupId}`;
    }
}

// Initialize Groups Page
function initGroupsPage() {
    // Load group list only (no detail shown initially)
    renderGroups(sampleGroups, 'group-list');
}

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initGroupsPage);
