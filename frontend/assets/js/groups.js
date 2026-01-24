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
        groups[index] = { ...groups[index], ...updates };
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
    const activeClass = isActive ? 'active' : '';
    const textClass = isActive ? 'text-slate-900' : 'text-slate-700';
    const deviceCount = group.devices ? group.devices.length : 0;
    const onlineCount = group.onlineCount || 0;

    return `
        <div class="group-item ${activeClass} p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 border-transparent cursor-pointer" data-group-id="${group.id}" onclick="selectGroup('${group.id}')">
            <div class="flex items-center gap-3 lg:gap-4">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold ${textClass} text-sm lg:text-base">${group.name}</h4>
                    <p class="text-[10px] lg:text-xs text-slate-500 font-medium">${deviceCount} Devices • ${onlineCount} Online</p>
                </div>
                <span class="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
        </div>
    `;
}

function createGroupDeviceCard(device) {
    const isOnline = device.status === 'Online' || device.status === 'Connected';
    const statusColor = isOnline ? 'bg-green-500' : 'bg-slate-300';
    const textColor = isOnline ? 'text-slate-900' : 'text-slate-400';
    const bgClass = isOnline ? '' : 'border-dashed bg-slate-50/30';
    const iconBg = isOnline ? 'bg-slate-50' : 'bg-slate-100';
    const iconColor = isOnline ? 'text-slate-600' : 'text-slate-400';

    return `
        <div class="device-card p-3 lg:p-4 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 ${bgClass}">
            <div class="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl ${iconBg} flex items-center justify-center ${iconColor}">
                <span class="material-symbols-outlined text-xl lg:text-2xl">${device.icon || 'computer'}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold ${textColor} truncate text-sm lg:text-base">${device.name}</p>
                <div class="flex items-center gap-1.5 lg:gap-2">
                    <span class="w-1.5 h-1.5 rounded-full ${statusColor}"></span>
                    <span class="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-wider">${device.status || 'Saved'}</span>
                </div>
            </div>
        </div>
    `;
}

function createAddDeviceButton() {
    return `
        <button class="p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 lg:gap-3 text-slate-400 hover:border-primary hover:text-primary transition-all text-sm lg:text-base" id="add-device-btn">
            <span class="material-symbols-outlined">add</span>
            <span class="font-bold">Add Device</span>
        </button>
    `;
}

function createEmptyState() {
    return `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span class="material-symbols-outlined text-4xl text-slate-300">group_off</span>
            </div>
            <h3 class="text-slate-900 font-bold text-lg mb-2">No Groups Yet</h3>
            <p class="text-slate-500 text-sm max-w-xs mb-4">Create a group by clicking the <strong>Add Group</strong> button below, or select devices on the home page</p>
        </div>
    `;
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function renderGroups(groups, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!groups || groups.length === 0) {
        container.innerHTML = createEmptyState();
        return;
    }

    container.innerHTML = groups.map(group => createGroupItem(group)).join('');
}

function renderGroupDevices(devices, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!devices || devices.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8">No devices in this group</p>`;
        return;
    }

    const deviceCards = devices.map(device => createGroupDeviceCard(device)).join('');
    container.innerHTML = deviceCards + createAddDeviceButton();
}

// ==========================================
// INTERACTION HANDLERS
// ==========================================

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

    // Get group data from storage
    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Update group detail header
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-description').textContent = group.description || 'No description';

    // Update online count
    const onlineCountEl = document.getElementById('online-count-text');
    if (onlineCountEl) {
        const onlineCount = group.devices ? group.devices.filter(d => d.status === 'Online' || d.status === 'Connected').length : 0;
        onlineCountEl.textContent = `${onlineCount} Online`;
    }

    // Render devices for this group
    const devices = group.devices || [];
    renderGroupDevices(devices, 'group-devices');

    // Show detail panel
    showGroupDetail();
}

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
        item.querySelector('h4')?.classList.remove('text-slate-900');
        item.querySelector('h4')?.classList.add('text-slate-700');
    });
}

function openEditGroupModal() {
    if (!selectedGroupId) return;

    // Get current group data
    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    // Create or get modal
    let modal = document.getElementById('edit-group-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeEditGroupModal()"></div>
            <div class="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900">Edit Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 transition-all" onclick="closeEditGroupModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Group Name</label>
                        <input type="text" id="edit-group-name-input" placeholder="Group name" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <input type="text" id="edit-group-desc-input" placeholder="Description" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all" onclick="closeEditGroupModal()">Cancel</button>
                    <button class="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.99] transition-all" onclick="confirmEditGroup()">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Populate fields with current data
    document.getElementById('edit-group-name-input').value = group.name || '';
    document.getElementById('edit-group-desc-input').value = group.description || '';

    // Show modal
    modal.classList.remove('hidden');
    document.getElementById('edit-group-name-input').focus();
}

function closeEditGroupModal() {
    const modal = document.getElementById('edit-group-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmEditGroup() {
    if (!selectedGroupId) return;

    const nameInput = document.getElementById('edit-group-name-input');
    const descInput = document.getElementById('edit-group-desc-input');

    const name = nameInput.value.trim();
    if (!name) {
        if (window.showToast) window.showToast('Group name is required', 'error');
        nameInput.focus();
        return;
    }

    // Update group in storage
    updateGroupInStorage(selectedGroupId, {
        name: name,
        description: descInput.value.trim()
    });

    // Update UI immediately
    document.getElementById('group-name').textContent = name;
    document.getElementById('group-description').textContent = descInput.value.trim() || 'No description';

    closeEditGroupModal();
    initGroupsPage(); // Refresh list

    // Re-select the group to show updated details
    setTimeout(() => selectGroup(selectedGroupId), 100);

    if (window.showToast) window.showToast('Group updated!', 'success');
}

// Legacy support - redirect to modal
function navigateToEditGroup() {
    openEditGroupModal();
}

// Open delete confirmation modal
function deleteSelectedGroup() {
    if (!selectedGroupId) return;

    const groups = loadGroupsFromStorage();
    const group = groups.find(g => g.id === selectedGroupId);
    const groupName = group ? group.name : 'this group';

    // Check if modal exists
    let modal = document.getElementById('delete-group-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'delete-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeDeleteGroupModal()"></div>
            <div class="relative bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl z-10 text-center">
                <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl text-red-500">delete_forever</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">Delete Group?</h3>
                <p class="text-slate-500 mb-6">Are you sure you want to delete "<strong id="delete-modal-group-name"></strong>"? This action cannot be undone.</p>
                <div class="flex gap-3">
                    <button onclick="closeDeleteGroupModal()" class="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">
                        Cancel
                    </button>
                    <button onclick="confirmDeleteGroup()" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-red-500/20 transition-all">
                        Delete
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('delete-modal-group-name').textContent = groupName;
    modal.classList.remove('hidden');
}

function closeDeleteGroupModal() {
    const modal = document.getElementById('delete-group-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteGroup() {
    if (!selectedGroupId) return;

    deleteGroupFromStorage(selectedGroupId);
    hideGroupDetail();
    initGroupsPage();
    closeDeleteGroupModal();

    if (window.showToast) window.showToast('Group deleted successfully', 'success');
}

// ==========================================
// INITIALIZATION
// ==========================================

function initGroupsPage() {
    const groups = loadGroupsFromStorage();
    renderGroups(groups, 'group-list');

    // Setup delete button handler
    const deleteBtn = document.getElementById('delete-group-btn');
    if (deleteBtn) {
        deleteBtn.onclick = deleteSelectedGroup;
    }

    // Setup add group button handler
    const addGroupBtn = document.getElementById('add-group-btn');
    if (addGroupBtn) {
        addGroupBtn.onclick = openAddGroupModal;
    }

    // Setup send files to group button handler
    const sendFilesBtn = document.getElementById('send-files-btn');
    if (sendFilesBtn) {
        sendFilesBtn.onclick = sendFilesToGroup;
    }
}

// Send files to the currently selected group
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

    // Check for files
    const filesData = sessionStorage.getItem('gdrop_transfer_files');
    const hasFiles = filesData && JSON.parse(filesData).length > 0;

    if (!hasFiles) {
        // Show file upload modal
        showGroupFileUploadModal(group);
        return;
    }

    // Start transfer to group devices
    startGroupTransfer(group);
}

// File upload modal for groups page
function showGroupFileUploadModal(group) {
    let modal = document.getElementById('group-file-upload-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'group-file-upload-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeGroupFileUploadModal()"></div>
            <div class="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900">Send Files to Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 transition-all" onclick="closeGroupFileUploadModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="text-center py-4">
                    <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-3xl text-primary">upload_file</span>
                    </div>
                    <p class="text-slate-600 mb-2">Send files to <strong id="group-upload-target-name"></strong></p>
                    <p class="text-sm text-slate-400 mb-6" id="group-upload-device-count"></p>
                    <input type="file" id="group-file-input" multiple class="hidden" />
                    <button onclick="triggerGroupFileSelect()" class="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-105 transition-all mb-3">
                        <span class="material-symbols-outlined mr-2 align-middle">folder_open</span>
                        Select Files & Send
                    </button>
                    <button onclick="closeGroupFileUploadModal()" class="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update modal content
    document.getElementById('group-upload-target-name').textContent = group.name;
    document.getElementById('group-upload-device-count').textContent = `${group.devices.length} device(s) in this group`;

    // Store current group for callback
    window._currentUploadGroup = group;

    // Setup file input listener
    const fileInput = document.getElementById('group-file-input');
    fileInput.value = ''; // Reset
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            if (window.handleFilesSelected) {
                window.handleFilesSelected(e.target.files);
            }
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
    const modal = document.getElementById('group-file-upload-modal');
    if (modal) modal.classList.add('hidden');
    window._currentUploadGroup = null;
}

function triggerGroupFileSelect() {
    document.getElementById('group-file-input').click();
}

// Start transfer to group members
function startGroupTransfer(group) {
    // Map group devices to transfer format
    const devices = group.devices.map(d => ({
        id: d.id,
        name: d.name,
        icon: d.icon || 'computer'
    }));

    // Set session storage
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(devices));
    sessionStorage.setItem('gdrop_group_name', group.name);
    sessionStorage.setItem('gdrop_current_group_id', group.id);

    // Start transfer
    if (window.startTransferProcess) {
        window.startTransferProcess();
        if (window.showToast) window.showToast(`Sending to "${group.name}" (${devices.length} devices)...`, 'success');
    } else {
        if (window.showToast) window.showToast('Transfer system not available', 'error');
    }
}

// ==========================================
// ADD GROUP MODAL
// ==========================================

function openAddGroupModal() {
    // Check if modal already exists
    let modal = document.getElementById('add-group-modal');
    if (!modal) {
        // Create modal dynamically
        modal = document.createElement('div');
        modal.id = 'add-group-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeAddGroupModal()"></div>
            <div class="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl z-10">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900">Create New Group</h3>
                    <button class="p-2 rounded-lg hover:bg-slate-100 transition-all" onclick="closeAddGroupModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Group Name</label>
                        <input type="text" id="add-group-name-input" placeholder="e.g. Work Team" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Description (optional)</label>
                        <input type="text" id="add-group-desc-input" placeholder="e.g. Devices for project X" 
                            class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"/>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all" onclick="closeAddGroupModal()">Cancel</button>
                    <button class="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.99] transition-all" onclick="confirmAddGroup()">Create Group</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Show modal
    modal.classList.remove('hidden');
    document.getElementById('add-group-name-input').value = '';
    document.getElementById('add-group-desc-input').value = '';
    document.getElementById('add-group-name-input').focus();
}

function closeAddGroupModal() {
    const modal = document.getElementById('add-group-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
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

    const newGroup = {
        id: generateGroupId(),
        name: name,
        description: descInput.value.trim() || `Created on ${new Date().toLocaleDateString()}`,
        devices: [],
        createdAt: new Date().toISOString()
    };

    addGroupToStorage(newGroup);
    closeAddGroupModal();
    initGroupsPage(); // Refresh list
    if (window.showToast) window.showToast('Group created!', 'success');
}

// ==========================================
// EXPOSE TO GLOBAL (for components.js)
// ==========================================

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

// Run on DOM Ready
document.addEventListener('DOMContentLoaded', initGroupsPage);
