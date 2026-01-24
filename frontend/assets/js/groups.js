/**
 * GopherDrop - Groups Page Components
 * Persistent Groups with localStorage
 */

// Storage Key
const GROUPS_STORAGE_KEY = 'gdrop_saved_groups';

// Current selected group
let selectedGroupId = null;

// ==========================================
// LOCAL STORAGE FUNCTIONS
// ==========================================

function loadGroupsFromStorage() {
    try {
        const data = localStorage.getItem(GROUPS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('[Groups] Error loading from storage:', e);
        return [];
    }
}

function saveGroupsToStorage(groups) {
    try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
        return true;
    } catch (e) {
        console.error('[Groups] Error saving to storage:', e);
        return false;
    }
}

function addGroupToStorage(group) {
    const groups = loadGroupsFromStorage();
    groups.push(group);
    return saveGroupsToStorage(groups);
}

function deleteGroupFromStorage(groupId) {
    const groups = loadGroupsFromStorage();
    const filtered = groups.filter(g => g.id !== groupId);
    return saveGroupsToStorage(filtered);
}

function updateGroupInStorage(groupId, updates) {
    const groups = loadGroupsFromStorage();
    const index = groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
        groups[index] = {...groups[index], ...updates};
        return saveGroupsToStorage(groups);
    }
    return false;
}

function generateGroupId() {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// UI RENDERING FUNCTIONS
// ==========================================

function createGroupItem(group) {
    const isActive = group.id === selectedGroupId;
    const activeClass = isActive
        ? 'active border-primary/50 bg-primary/5 dark:bg-primary/10'
        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50';

    const textClass = isActive
        ? 'text-primary font-bold'
        : 'text-slate-900 dark:text-white font-semibold';

    const descClass = isActive
        ? 'text-primary/80'
        : 'text-slate-500 dark:text-slate-400';

    const deviceCount = group.devices ? group.devices.length : 0;
    const onlineCount = (group.devices || []).filter(d => window.isDeviceOnline && window.isDeviceOnline(d.id)).length;

    return `
        <div class="group-item ${activeClass} p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 cursor-pointer transition-all duration-200" data-group-id="${group.id}" onclick="selectGroup('${group.id}')">
            <div class="flex items-center gap-3 lg:gap-4">
                <div class="flex-1 min-w-0">
                    <h4 class="${textClass} text-sm lg:text-base truncate transition-colors">${group.name}</h4>
                    <p class="text-[10px] lg:text-xs ${descClass} font-medium transition-colors">${deviceCount} Devices • ${onlineCount} Online</p>
                </div>
                <span class="material-symbols-outlined ${isActive ? 'text-primary' : 'text-slate-300 dark:text-slate-600'} transition-colors">chevron_right</span>
            </div>
        </div>
    `;
}

function createAddDeviceButton() {
    return `
        <button class="p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 lg:gap-3 text-slate-400 hover:border-primary hover:text-primary transition-all text-sm lg:text-base w-full h-full min-h-[100px]" id="add-device-btn" onclick="triggerAddDeviceToGroup()">
            <span class="material-symbols-outlined">add</span>
            <span class="font-bold">Add Device</span>
        </button>
    `;
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function renderGroups(groups, containerId, searchQuery = "") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!groups || groups.length === 0) {
        const message = searchQuery ? `No groups found matching "${searchQuery}"` : "No Groups Yet";
        const subMsg = searchQuery ? "Try different keywords" : "Create a group to get started";

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-3xl text-slate-300">search_off</span>
                </div>
                <h3 class="text-slate-900 dark:text-white font-bold text-base mb-1">${message}</h3>
                <p class="text-slate-500 text-sm max-w-xs">${subMsg}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = groups.map(group => createGroupItem(group)).join('');
}

function renderGroupDevices(devices, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const onlineCount = (devices || []).filter(d => window.isDeviceOnline && window.isDeviceOnline(d.id)).length;
    const countText = document.getElementById('online-count-text');
    if (countText) countText.textContent = `${onlineCount} Online`;

    let deviceCards = '';
    if (devices && devices.length > 0) {
        deviceCards = devices.map(device => {
            const isOnline = window.isDeviceOnline ? window.isDeviceOnline(device.id) : false;

            let displayName = device.name;
            if (isOnline && window.currentDevices) {
                const liveDevice = window.currentDevices.find(d => d.id === device.id);
                if (liveDevice) displayName = liveDevice.name;
            }

            const statusText = isOnline ? 'Online' : 'Saved';
            const statusColor = isOnline ? 'bg-green-500' : 'bg-slate-300';
            const textColor = isOnline
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-slate-500';

            const bgClass = isOnline
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/50 border-dashed';

            const iconBg = isOnline ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-700 text-slate-400';

            return `
                <div class="device-card p-4 rounded-2xl border ${bgClass} flex items-center gap-4 transition-all">
                    <div class="w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-2xl">${device.icon || 'computer'}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold ${textColor} truncate text-sm lg:text-base">${displayName}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full ${statusColor} ${isOnline ? 'animate-pulse' : ''}"></span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${statusText}</span>
                        </div>
                    </div>
                    <button onclick="confirmRemoveDevice('${device.id}')" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Remove Device">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            `;
        }).join('');
    } else {
        deviceCards = `
            <div class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl h-full min-h-[100px]">
                <p class="text-slate-400 text-sm font-medium">No devices yet.</p>
            </div>
        `;
    }

    container.innerHTML = deviceCards + createAddDeviceButton();
}

// ==========================================
// INTERACTION HANDLERS
// ==========================================

function selectGroup(groupId) {
    selectedGroupId = groupId;

    document.querySelectorAll('.group-item').forEach(item => {
        const h4 = item.querySelector('h4');
        item.classList.remove('active');
        if (h4) {
            h4.classList.remove('text-slate-900', 'dark:text-white');
            h4.classList.add('text-slate-700', 'dark:text-slate-300');
        }
    });

    const selectedItem = document.querySelector(`[data-group-id="${groupId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
        const h4 = selectedItem.querySelector('h4');
        if (h4) {
            h4.classList.remove('text-slate-700', 'dark:text-slate-300');
            h4.classList.add('text-slate-900', 'dark:text-white');
        }
    }

    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-description').textContent = group.description || 'No description';

    const onlineCount = (group.devices || []).filter(d => window.isDeviceOnline && window.isDeviceOnline(d.id)).length;
    const onlineCountEl = document.getElementById('online-count-text');
    if (onlineCountEl) onlineCountEl.textContent = `${onlineCount} Online`;

    renderGroupDevices(group.devices || [], 'group-devices');
    showGroupDetail();
}

function showGroupDetail() {
    const detail = document.getElementById('group-detail-container');
    const groupList = document.getElementById('group-list-container');

    if (detail) {
        detail.classList.remove('hidden');
        detail.classList.add('flex');
    }
    if (groupList) {
        groupList.classList.remove('lg:flex-1');
        groupList.classList.add('lg:w-96', 'lg:flex-shrink-0');
    }
}

function hideGroupDetail() {
    const detail = document.getElementById('group-detail-container');
    const groupList = document.getElementById('group-list-container');

    if (detail) {
        detail.classList.add('hidden');
        detail.classList.remove('flex');
    }
    if (groupList) {
        groupList.classList.add('lg:flex-1');
        groupList.classList.remove('lg:w-96', 'lg:flex-shrink-0');
    }

    selectedGroupId = null;
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
        const h4 = item.querySelector('h4');
        if (h4) {
            h4.classList.remove('text-slate-900', 'dark:text-white');
            h4.classList.add('text-slate-700', 'dark:text-slate-300');
        }
    });
}

// --- ADD DEVICE LOGIC ---

let tempAvailableDeviceMap = {};

function triggerAddDeviceToGroup() {
    if (!selectedGroupId) return;

    // FIX THEME: Modal Structure now uses Theme Colors
    document.getElementById('add-device-to-group-modal').classList.remove('hidden');
    window.devicesToAddSet = new Set();

    refreshAddDeviceList();

    if (window.addDeviceInterval) clearInterval(window.addDeviceInterval);
    window.addDeviceInterval = setInterval(refreshAddDeviceList, 2000);
}

function refreshAddDeviceList() {
    if (!selectedGroupId) return;

    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    const currentMemberIds = (group.devices || []).map(d => d.id);
    const availableToAdd = window.getOnlineDevicesNotInList ? window.getOnlineDevicesNotInList(currentMemberIds) : [];

    tempAvailableDeviceMap = {};
    availableToAdd.forEach(d => {
        tempAvailableDeviceMap[d.id] = d;
    });

    const listContainer = document.getElementById('add-device-list-container');
    if (!listContainer) return;

    if (availableToAdd.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-8">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">wifi_off</span>
                <p class="text-slate-500 text-sm">No new online devices found.</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = availableToAdd.map(d => {
            const isSelected = window.devicesToAddSet && window.devicesToAddSet.has(d.id);
            const activeClass = isSelected ? 'border-primary bg-primary/5' : 'border-transparent';
            const checkClass = isSelected ? 'bg-primary border-primary' : 'border-slate-300';
            const iconOpacity = isSelected ? '' : 'opacity-0';

            return `
                <div onclick="toggleAddDeviceSelection('${d.id}')" class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border ${activeClass}" id="add-dev-${d.id}">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-slate-500">computer</span>
                        <span class="font-bold text-slate-700 dark:text-slate-200 text-sm truncate max-w-[180px]">${d.name}</span>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 ${checkClass} flex items-center justify-center checkbox-indicator transition-colors">
                        <span class="material-symbols-outlined text-xs text-white ${iconOpacity}">check</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.toggleAddDeviceSelection = function (id) {
    if (!window.devicesToAddSet) window.devicesToAddSet = new Set();

    if (window.devicesToAddSet.has(id)) {
        window.devicesToAddSet.delete(id);
    } else {
        window.devicesToAddSet.add(id);
    }
    refreshAddDeviceList();
};

window.confirmAddDevicesToGroup = function () {
    if (!selectedGroupId || !window.devicesToAddSet || window.devicesToAddSet.size === 0) {
        closeAddDeviceToGroupModal();
        return;
    }

    const groups = loadGroupsFromStorage();
    const groupIndex = groups.findIndex(g => g.id === selectedGroupId);
    if (groupIndex === -1) return;

    window.devicesToAddSet.forEach(id => {
        const dev = tempAvailableDeviceMap[id];
        if (dev) {
            const exists = groups[groupIndex].devices.some(existing => existing.id === dev.id);
            if (!exists) {
                groups[groupIndex].devices.push({
                    id: dev.id,
                    name: dev.name,
                    icon: 'computer',
                    status: 'Saved'
                });
            }
        }
    });

    saveGroupsToStorage(groups);
    selectGroup(selectedGroupId);
    closeAddDeviceToGroupModal();
    if (window.showToast) window.showToast(`${window.devicesToAddSet.size} devices added!`, 'success');
};

window.closeAddDeviceToGroupModal = function () {
    document.getElementById('add-device-to-group-modal').classList.add('hidden');
    if (window.addDeviceInterval) clearInterval(window.addDeviceInterval);
};

// --- REMOVE DEVICE & GROUP LOGIC (CUSTOM MODAL FIX) ---

// 1. Helper: Tampilkan Modal Delete (Reusable)
function showDeleteModal(titleText, messageText, onConfirm) {
    let modal = document.getElementById('delete-group-modal');

    // Create on the fly
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'delete-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';

        // Modal HTML dengan Dark Mode & Animasi
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeDeleteGroupModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl z-10 text-center transition-all scale-95 opacity-0 transform" id="delete-modal-content">
                <div class="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl text-red-500">delete_forever</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2" id="delete-modal-title">Delete?</h3>
                <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm" id="delete-modal-desc">Are you sure?</p>
                <div class="flex gap-3">
                    <button onclick="closeDeleteGroupModal()" class="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">Cancel</button>
                    <button id="btn-confirm-delete" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-red-500/20 transition-all">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update Text
    document.getElementById('delete-modal-title').textContent = titleText;
    document.getElementById('delete-modal-desc').innerHTML = messageText;

    // Attach Handler (Clone to prevent multiple listeners)
    const btn = document.getElementById('btn-confirm-delete');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = onConfirm;

    // Show with Animation
    modal.classList.remove('hidden');
    const content = document.getElementById('delete-modal-content');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.closeDeleteGroupModal = function () {
    const modal = document.getElementById('delete-group-modal');
    const content = document.getElementById('delete-modal-content');

    if (content) {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
    }

    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 200);
}

// 2. Logic: Remove Device
let deviceIdToDelete = null;

window.confirmRemoveDevice = function (deviceId) {
    if (window.event) window.event.stopPropagation();
    deviceIdToDelete = deviceId;

    showDeleteModal(
        "Remove Device?",
        "Are you sure you want to remove this device from the group?",
        () => executeRemoveDevice()
    );
}

function executeRemoveDevice() {
    if (!deviceIdToDelete || !selectedGroupId) return;

    const groups = loadGroupsFromStorage();
    const groupIndex = groups.findIndex(g => g.id === selectedGroupId);

    if (groupIndex !== -1) {
        groups[groupIndex].devices = groups[groupIndex].devices.filter(d => d.id !== deviceIdToDelete);
        saveGroupsToStorage(groups);

        selectGroup(selectedGroupId);
        const searchInput = document.getElementById('group-search');
        renderGroups(groups, 'group-list', searchInput ? searchInput.value : "");

        if (window.showToast) window.showToast('Device removed', 'info');
    }

    closeDeleteGroupModal();
}

// 3. Logic: Remove Group
window.deleteSelectedGroup = function () {
    if (!selectedGroupId) return;
    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);

    if (!group) return;

    showDeleteModal(
        "Delete Group?",
        `Are you sure you want to delete "<strong>${group.name}</strong>"?<br>This action cannot be undone.`,
        () => confirmDeleteGroup()
    );
}

function confirmDeleteGroup() {
    if (!selectedGroupId) return;
    deleteGroupFromStorage(selectedGroupId);
    hideGroupDetail();
    const groups = loadGroupsFromStorage();
    renderGroups(groups, 'group-list');

    closeDeleteGroupModal();
    if (window.showToast) window.showToast('Group deleted successfully', 'success');
}

// ==========================================
// CRUD GROUP MODALS
// ==========================================

function openAddGroupModal() {
    let modal = document.getElementById('add-group-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeAddGroupModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10 transition-colors">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white">Create New Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all" onclick="closeAddGroupModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Group Name</label>
                        <input type="text" id="add-group-name-input" placeholder="e.g. Work Team" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description (optional)</label>
                        <input type="text" id="add-group-desc-input" placeholder="e.g. Devices for project X" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button class="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" onclick="closeAddGroupModal()">Cancel</button>
                    <button class="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.99] transition-all" onclick="confirmAddGroup()">Create Group</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Reset Value & Focus
    document.getElementById('add-group-name-input').value = '';
    document.getElementById('add-group-desc-input').value = '';

    // Keybind Enter
    const nameInput = document.getElementById('add-group-name-input');
    if (nameInput) {
        nameInput.onkeyup = function (e) {
            if (e.key === 'Enter') confirmAddGroup();
        };
        setTimeout(() => nameInput.focus(), 50);
    }

    modal.classList.remove('hidden');
}

function closeAddGroupModal() {
    document.getElementById('add-group-modal')?.classList.add('hidden');
}

function confirmAddGroup() {
    const nameInput = document.getElementById('add-group-name-input');
    const descInput = document.getElementById('add-group-desc-input');
    const name = nameInput.value.trim();

    if (!name) {
        if (window.showToast) window.showToast('Please enter a group name', 'error');
        nameInput.focus();
        return;
    }

    const desc = descInput.value.trim() ? descInput.value.trim() : "No description provided";
    const newGroup = {
        id: generateGroupId(),
        name: name,
        description: desc,
        devices: [],
        createdAt: new Date().toISOString()
    };

    addGroupToStorage(newGroup);
    closeAddGroupModal();
    // Manual Refresh
    const groups = loadGroupsFromStorage();
    renderGroups(groups, 'group-list');

    if (window.showToast) window.showToast('Group created!', 'success');
}

function openEditGroupModal() {
    if (!selectedGroupId) return;
    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    let modal = document.getElementById('edit-group-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeEditGroupModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10 transition-colors">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white">Edit Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all" onclick="closeEditGroupModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Group Name</label>
                        <input type="text" id="edit-group-name-input" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                        <input type="text" id="edit-group-desc-input" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button class="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" onclick="closeEditGroupModal()">Cancel</button>
                    <button class="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.99] transition-all" onclick="confirmEditGroup()">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('edit-group-name-input').value = group.name || '';
    document.getElementById('edit-group-desc-input').value = group.description || '';

    // Keybind Enter
    const nameInput = document.getElementById('edit-group-name-input');
    if (nameInput) {
        nameInput.onkeyup = function (e) {
            if (e.key === 'Enter') confirmEditGroup();
        };
        setTimeout(() => nameInput.focus(), 50);
    }

    modal.classList.remove('hidden');
}

function closeEditGroupModal() {
    document.getElementById('edit-group-modal')?.classList.add('hidden');
}

function confirmEditGroup() {
    if (!selectedGroupId) return;
    const nameInput = document.getElementById('edit-group-name-input');
    const descInput = document.getElementById('edit-group-desc-input');

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (!name) {
        if (window.showToast) window.showToast('Group name is required', 'error');
        return;
    }

    // FIX: UX CHECK NO CHANGES
    const currentName = document.getElementById('group-name').textContent;
    const currentDesc = document.getElementById('group-description').textContent;
    const descToCheck = desc === "" ? "No description" : desc;

    if (name === currentName && descToCheck === currentDesc) {
        if (window.showToast) window.showToast('No changes made', 'warning');
        closeEditGroupModal();
        return;
    }

    updateGroupInStorage(selectedGroupId, {name: name, description: desc});

    document.getElementById('group-name').textContent = name;
    document.getElementById('group-description').textContent = desc || 'No description';

    const groups = loadGroupsFromStorage();
    renderGroups(groups, 'group-list');

    closeEditGroupModal();
    if (window.showToast) window.showToast('Group updated!', 'success');
}

function navigateToEditGroup() {
    openEditGroupModal();
}

// ==========================================
// FILE SENDING
// ==========================================

function sendFilesToGroup() {
    if (!selectedGroupId) {
        if (window.showToast) window.showToast('Please select a group first', 'warning');
        return;
    }
    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group || !group.devices || group.devices.length === 0) {
        if (window.showToast) window.showToast('No devices in this group', 'warning');
        return;
    }

    const filesData = sessionStorage.getItem('gdrop_transfer_files');
    const hasFiles = filesData && JSON.parse(filesData).length > 0;

    if (!hasFiles) {
        showGroupFileUploadModal(group);
        return;
    }
    startGroupTransfer(group);
}

function showGroupFileUploadModal(group) {
    let modal = document.getElementById('group-file-upload-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'group-file-upload-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeGroupFileUploadModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white">Send Files to Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" onclick="closeGroupFileUploadModal()">
                        <span class="material-symbols-outlined dark:text-slate-400">close</span>
                    </button>
                </div>
                <div class="text-center py-4">
                    <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-3xl text-primary">upload_file</span>
                    </div>
                    <p class="text-slate-600 dark:text-slate-400 mb-2">Send files to <strong id="group-upload-target-name" class="text-slate-900 dark:text-white"></strong></p>
                    <p class="text-sm text-slate-400 mb-6" id="group-upload-device-count"></p>
                    <input type="file" id="group-file-input" multiple class="hidden" />
                    <button onclick="triggerGroupFileSelect()" class="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-105 transition-all mb-3">
                        <span class="material-symbols-outlined mr-2 align-middle">folder_open</span>
                        Select Files & Send
                    </button>
                    <button onclick="closeGroupFileUploadModal()" class="w-full py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('group-upload-target-name').textContent = group.name;
    document.getElementById('group-upload-device-count').textContent = `${group.devices.length} device(s)`;
    window._currentUploadGroup = group;

    const fileInput = document.getElementById('group-file-input');
    fileInput.value = '';
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            if (window.handleFilesSelected) window.handleFilesSelected(e.target.files);
            closeGroupFileUploadModal();
            if (window._currentUploadGroup) {
                startGroupTransfer(window._currentUploadGroup);
                window._currentUploadGroup = null;
            }
        }
    };
    modal.classList.remove('hidden');
}

function closeGroupFileUploadModal() {
    document.getElementById('group-file-upload-modal')?.classList.add('hidden');
    window._currentUploadGroup = null;
}

function triggerGroupFileSelect() {
    document.getElementById('group-file-input').click();
}

function startGroupTransfer(group) {
    const devices = group.devices.map(d => ({
        id: d.id,
        name: d.name,
        icon: d.icon || 'computer'
    }));
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(devices));
    sessionStorage.setItem('gdrop_group_name', group.name);
    sessionStorage.setItem('gdrop_current_group_id', group.id);

    if (window.startTransferProcess) {
        window.startTransferProcess();
        if (window.showToast) window.showToast(`Sending to "${group.name}"...`, 'success');
    } else {
        if (window.showToast) window.showToast('Transfer system not available', 'error');
    }
}

// ==========================================
// INIT & AUTO REFRESH LOOP
// ==========================================

function initGroupsPage() {
    const groups = loadGroupsFromStorage();
    renderGroups(groups, 'group-list');

    const searchInput = document.getElementById('group-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const allGroups = loadGroupsFromStorage();
            const filtered = allGroups.filter(g =>
                g.name.toLowerCase().includes(query) ||
                (g.description && g.description.toLowerCase().includes(query))
            );
            renderGroups(filtered, 'group-list', query);
        });
    }

    const addGroupBtn = document.getElementById('add-group-btn');
    if (addGroupBtn) addGroupBtn.onclick = openAddGroupModal;

    const sendFilesBtn = document.getElementById('send-files-btn');
    if (sendFilesBtn) sendFilesBtn.onclick = sendFilesToGroup;

    // --- LIVE STATUS UPDATE ONLY (No Name Sync) ---
    setInterval(() => {
        const currentGroups = loadGroupsFromStorage();

        // 1. Refresh Detail Online Count & Status
        if (selectedGroupId) {
            const activeGroup = currentGroups.find(g => g.id === selectedGroupId);
            if (activeGroup) {
                renderGroupDevices(activeGroup.devices, 'group-devices');
            }
        }
    }, 3000);

    // --- UX KEYBIND (Escape to Close) ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('[id$="-modal"]');
            let modalClosed = false;
            modals.forEach(m => {
                if (!m.classList.contains('hidden')) {
                    m.classList.add('hidden');
                    modalClosed = true;
                }
            });

            if (!modalClosed && selectedGroupId) {
                hideGroupDetail();
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', initGroupsPage);

// EXPOSE GLOBAL
window.addGroupToStorage = addGroupToStorage;
window.loadGroupsFromStorage = loadGroupsFromStorage;
window.generateGroupId = generateGroupId;
window.updateGroupInStorage = updateGroupInStorage;
window.selectGroup = selectGroup;
window.hideGroupDetail = hideGroupDetail;
window.navigateToEditGroup = navigateToEditGroup;
window.openAddGroupModal = openAddGroupModal;
window.closeAddGroupModal = closeAddGroupModal;
window.confirmAddGroup = confirmAddGroup;
window.openEditGroupModal = openEditGroupModal;
window.closeEditGroupModal = closeEditGroupModal;
window.confirmEditGroup = confirmEditGroup;
window.deleteSelectedGroup = deleteSelectedGroup;
window.sendFilesToGroup = sendFilesToGroup;
window.showGroupFileUploadModal = showGroupFileUploadModal;
window.closeGroupFileUploadModal = closeGroupFileUploadModal;
window.triggerGroupFileSelect = triggerGroupFileSelect;
window.closeDeleteGroupModal = closeDeleteGroupModal;
window.confirmDeleteGroup = confirmDeleteGroup;
window.triggerAddDeviceToGroup = triggerAddDeviceToGroup;
window.confirmAddDevicesToGroup = confirmAddDevicesToGroup;
window.closeAddDeviceToGroupModal = closeAddDeviceToGroupModal;
window.toggleAddDeviceSelection = toggleAddDeviceSelection;
window.confirmRemoveDevice = confirmRemoveDevice;