import {initAuth} from "./auth.js";

let originalDeviceName = '';

document.addEventListener('DOMContentLoaded', () => {
    const deviceNameInput = document.getElementById('device_name');

    if (deviceNameInput) {
        // 1. Load Saved Name (Prioritize backend name if exists, fallback to device ID)
        const savedName = localStorage.getItem('gdrop_device_name') || localStorage.getItem('gdrop_device_id');
        const finalName = savedName || '';

        originalDeviceName = finalName;
        deviceNameInput.value = finalName;

        // Listener untuk tombol Save aktif/nonaktif
        deviceNameInput.addEventListener('input', () => {
            updateSaveButtonState(deviceNameInput.value);
        });

        updateSaveButtonState(finalName);
    }

    // Load Discoverable State
    const toggle = document.getElementById('discoverable-toggle');
    const isDiscoverable = localStorage.getItem('gdrop_is_discoverable') !== 'false';
    if (toggle) {
        isDiscoverable ? toggle.classList.add('active') : toggle.classList.remove('active');
    }
});

// ==========================================
// Helper: Update Button State
// ==========================================
function updateSaveButtonState(currentValue) {
    const saveBtn = document.getElementById('save-device-btn');
    if (!saveBtn) return;

    const cleanCurrent = currentValue.trim();
    // Enable button only if not empty AND different from original
    const isChanged = (cleanCurrent !== '') && (cleanCurrent !== originalDeviceName);

    saveBtn.disabled = !isChanged;
}

// ==========================================
// UI Functions
// ==========================================

window.toggleDiscoverable = function (el) {
    el.classList.toggle('active');
    const isActive = el.classList.contains('active');

    localStorage.setItem('gdrop_is_discoverable', isActive);

    // Sync with WebSocket immediately if possible
    if (typeof window.setDiscoverable === 'function') {
        window.setDiscoverable(isActive);
        const status = isActive ? 'Visible' : 'Hidden';
        if (window.showToast) window.showToast(`Device is now ${status}`, 'info');
    }
};

// ==========================================
// Save Configuration (Identity)
// ==========================================

window.saveConfiguration = async function (isRetry = false) {
    const deviceNameInput = document.getElementById('device_name');
    const saveBtn = document.getElementById('save-device-btn');
    const deviceName = deviceNameInput?.value.trim();

    if (!deviceName) return;

    // Loading State
    const originalContent = saveBtn ? saveBtn.innerHTML : 'Save';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span>';
        saveBtn.disabled = true;
    }

    try {
        // Optimistic Update Local
        localStorage.setItem('gdrop_device_name', deviceName);

        // Sync to Backend
        let token = localStorage.getItem('gdrop_token');
        if (!token) token = await initAuth();

        if (token) {
            const protocol = window.location.protocol;
            const host = window.location.hostname;
            const port = '8080';
            const apiUrl = `${protocol}//${host}:${port}/api/v1/protected/user?token=${token}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: deviceName})
            });

            // Handle Token Expired (401)
            if (response.status === 401 && !isRetry) {
                console.warn('[Settings] Token Invalid (401). Refreshing...');
                localStorage.removeItem('gdrop_token');
                const newToken = await initAuth();
                if (!newToken) throw new Error("Re-auth failed.");

                // Retry once
                if (saveBtn) saveBtn.innerHTML = originalContent;
                return window.saveConfiguration(true);
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server rejected: ${errText}`);
            }

            if (window.showToast) window.showToast('Name updated successfully!', 'success');

            originalDeviceName = deviceName;
            updateSaveButtonState(deviceName);

        } else {
            // Offline fallback
            if (window.showToast) window.showToast('Saved locally (Offline Mode)', 'warning');
            originalDeviceName = deviceName;
            updateSaveButtonState(deviceName);
        }

    } catch (error) {
        console.error('[Settings] Save Error:', error);
        if (window.showToast) window.showToast('Failed to sync: ' + error.message, 'error');

        // Re-enable button on error to allow retry
        if (saveBtn) saveBtn.disabled = false;
    } finally {
        // Reset Button UI
        if (saveBtn && !isRetry) {
            saveBtn.innerHTML = '<span class="hidden sm:inline">Save</span><span class="material-symbols-outlined text-xl">save</span>';
            updateSaveButtonState(deviceName);
        }
    }
};

// ==========================================
// BACKUP & RESTORE LOGIC (FIXED UX)
// ==========================================

const BACKUP_KEYS = [
    'gdrop_device_id',
    'gdrop_device_name',
    'gdrop_is_discoverable',
    'gdrop_private_key',
    'gdrop_public_key',
    'gdrop_saved_groups',
    'gopherdrop-theme'
];

window.exportBackup = function () {
    try {
        const backupData = {};
        let hasData = false;

        BACKUP_KEYS.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                backupData[key] = value;
                hasData = true;
            }
        });

        if (!hasData) {
            if (window.showToast) window.showToast('No settings to backup yet.', 'warning');
            return;
        }

        backupData['_meta'] = {date: new Date().toISOString(), version: '1.0', app: 'GopherDrop'};

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);
        const filename = `gopherdrop-backup-${date}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.showToast) window.showToast('Backup downloaded successfully!', 'success');

    } catch (e) {
        console.error("Backup failed:", e);
        if (window.showToast) window.showToast('Failed to create backup', 'error');
    }
};

window.triggerImport = function () {
    document.getElementById('import-file-input').click();
};

function showRestoreConfirmationModal(onConfirm) {
    let modal = document.getElementById('restore-confirm-modal');

    // Create Modal on the fly if not exists
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'restore-confirm-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeRestoreModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl z-10 text-center transition-colors scale-95 opacity-0 transform transition-all duration-200" id="restore-modal-content">
                <div class="w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl text-yellow-500">warning</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Restore Backup?</h3>
                <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                    This will <strong class="text-slate-700 dark:text-slate-200">overwrite</strong> your current settings, groups, and identity.
                    <br><br>This action cannot be undone.
                </p>
                <div class="flex gap-3">
                    <button onclick="closeRestoreModal()" class="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">Cancel</button>
                    <button id="btn-confirm-restore" class="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all">Restore</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const btn = document.getElementById('btn-confirm-restore');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = () => {
        closeRestoreModal();
        onConfirm();
    };

    modal.classList.remove('hidden');
    const content = document.getElementById('restore-modal-content');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.closeRestoreModal = function () {
    const modal = document.getElementById('restore-confirm-modal');
    const content = document.getElementById('restore-modal-content');
    const input = document.getElementById('import-file-input');

    if (content) {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
    }

    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        if (input) input.value = '';
    }, 200);
};

window.handleImportFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const data = JSON.parse(content);

            const isValid = data.gdrop_device_id || (data._meta && data._meta.app === 'GopherDrop');
            if (!isValid) throw new Error("Invalid format");

            showRestoreConfirmationModal(() => {
                // Execute Restore
                let restoredCount = 0;
                BACKUP_KEYS.forEach(key => {
                    if (data[key] !== undefined) {
                        localStorage.setItem(key, data[key]);
                        restoredCount++;
                    }
                });

                if (window.showToast) window.showToast(`Restored ${restoredCount} settings. Reloading...`, 'success');
                localStorage.removeItem('gdrop_token');

                setTimeout(() => window.location.reload(), 1500);
            });

        } catch (err) {
            console.error("Import failed:", err);
            if (window.showToast) window.showToast('Failed: Invalid backup file', 'error');
            input.value = '';
        }
    };

    reader.readAsText(file);
};