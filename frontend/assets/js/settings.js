import { initAuth } from "./auth.js";
import { setTheme, updateProfileUI } from "./helper.js";
import { API_BASE_URL, STORAGE_KEYS } from "./config.js";

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let originalDeviceName = '';

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Device Name Input
    const deviceNameInput = document.getElementById('device_name');
    if (deviceNameInput) {
        // Take Name from Load Local Storage (Fallback ke 'Unknown Device' jika kosong)
        const savedName = localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);

        originalDeviceName = savedName;
        deviceNameInput.value = savedName;

        // Monitoring if there's any change
        deviceNameInput.addEventListener('input', () => {
            updateSaveButtonState(deviceNameInput.value);
        });

        deviceNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const isChanged = deviceNameInput.value.trim() !== originalDeviceName;
                const isNotEmpty = deviceNameInput.value.trim() !== '';

                if (isChanged && isNotEmpty) {
                    deviceNameInput.blur();
                    updateSaveButtonState(savedName)
                }

                if (window.showToast) window.showToast('Name change saved', 'info');
            }
            else if (e.key === 'Escape') {
                e.preventDefault();

                deviceNameInput.value = originalDeviceName;
                updateSaveButtonState(originalDeviceName);
                deviceNameInput.blur();

                if (window.showToast) window.showToast('Edit cancelled', 'warning');
            }
        });

        // Set state of Save Button
        updateSaveButtonState(savedName);
    }

    // Initialize Discoverable Toggle
    const toggleBtn = document.getElementById('discoverable-toggle');
    const isDiscoverable = localStorage.getItem(STORAGE_KEYS.DISCOVERABLE) !== 'false';

    if (toggleBtn) {
        // Set visual state awal
        isDiscoverable ? toggleBtn.classList.add('active') : toggleBtn.classList.remove('active');

        // Pasang Event Listener (Menggantikan onclick di HTML yang bikin error ReferenceError)
        toggleBtn.addEventListener('click', function () {
            toggleDiscoverable(this);
        });

        // Sync ke server via WebSocket (jika ada)
        setTimeout(() => {
            if (typeof window.setDiscoverable === 'function') {
                window.setDiscoverable(isDiscoverable);
            }
        }, 1000);
    }

    // Initialize Theme Buttons
    const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    const themeBtns = document.querySelectorAll('.theme-btn');

    if (themeBtns) {
        themeBtns.forEach(btn => {
            // Set active state visual
            if (btn.dataset.theme === currentTheme) {
                btn.classList.add('border-primary', 'text-primary');
            } else {
                btn.classList.remove('border-primary', 'text-primary');
            }

            // Add click listener
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                setTheme(theme); // Panggil helper

                // Update UI visually
                themeBtns.forEach(b => b.classList.remove('border-primary', 'text-primary'));
                btn.classList.add('border-primary', 'text-primary');
            });
        });
    }

    // Update Profile Text di Sidebar (Biar sinkron)
    updateProfileUI();
});

// ==========================================
// Helper: Update Save Button State
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
// Core Function: Toggle Discoverable
// ==========================================
function toggleDiscoverable(el) {
    el.classList.toggle('active');
    const isActive = el.classList.contains('active');

    localStorage.setItem(STORAGE_KEYS.DISCOVERABLE, isActive);

    // Sync with WebSocket
    if (typeof window.setDiscoverable === 'function') {
        window.setDiscoverable(isActive);

        const statusMsg = isActive ? 'Device is now Visible' : 'Device is now Hidden';
        const toastType = isActive ? 'info' : 'info';

        if (window.showToast) window.showToast(statusMsg, toastType);
    }
}

// ==========================================
// Core Function: Save Configuration
// ==========================================
window.saveConfiguration = async function (isRetry = false) {
    const deviceNameInput = document.getElementById('device_name');
    const saveBtn = document.getElementById('save-device-btn');
    const deviceName = deviceNameInput?.value.trim();

    if (!deviceName) return;

    // Loading UI
    const originalContent = saveBtn ? saveBtn.innerHTML : 'Save';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span>';
        saveBtn.disabled = true;
    }

    try {
        // Optimistic Update Local Storage
        localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceName);

        // Update UI Profil langsung (biar responsif)
        updateProfileUI();

        // Sync to Backend
        let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) token = await initAuth();

        if (token) {
            const apiUrl = `${API_BASE_URL}/protected/user`; // Pakai dari config.js

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ username: deviceName })
            });

            // Handle Token Expired (401) - Retry Logic
            if (response.status === 401 && !isRetry) {
                console.warn("Token expired, refreshing auth...");
                localStorage.removeItem(STORAGE_KEYS.TOKEN);
                const newToken = await initAuth();
                if (!newToken) throw new Error("Re-auth failed.");

                // Retry once
                if (saveBtn) saveBtn.innerHTML = originalContent;
                return window.saveConfiguration(true);
            }

            if (!response.ok) {
                throw new Error(`Server rejected change`);
            }

            if (window.showToast) window.showToast('Name updated successfully!', 'success');

            originalDeviceName = deviceName;
            updateSaveButtonState(deviceName);

        } else {
            // Offline Fallback
            if (window.showToast) window.showToast('Saved locally (Offline Mode)', 'warning');
            originalDeviceName = deviceName;
            updateSaveButtonState(deviceName);
        }

    } catch (error) {
        console.error(error);
        if (window.showToast) window.showToast('Failed to sync: ' + error.message, 'error');

        // Re-enable button on error
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
// BACKUP & RESTORE LOGIC
// ==========================================

const BACKUP_KEYS = [
    STORAGE_KEYS.DEVICE_ID,
    STORAGE_KEYS.DEVICE_NAME,
    STORAGE_KEYS.PRIVATE_KEY,
    STORAGE_KEYS.PUBLIC_KEY,
    STORAGE_KEYS.THEME,
    'gdrop_is_discoverable',
    'gdrop_saved_groups'
];

// Export Backup
// Export Backup
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

        const now = new Date();
        backupData['_meta'] = {
            date: now.toString(),
            version: '2.0',
            app: 'GopherDrop'
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const date = now.toLocaleDateString('en-CA');
        const filename = `gopherdrop-backup-${date}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.showToast) window.showToast('Backup downloaded!', 'success');

    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast('Failed to create backup', 'error');
    }
};

// Trigger Import Input
window.triggerImport = function () {
    document.getElementById('import-file-input').click();
};

// Handle Import File
window.handleImportFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const data = JSON.parse(content);

            // Basic Validation
            const isValid = data[STORAGE_KEYS.DEVICE_ID] || (data._meta && data._meta.app === 'GopherDrop');
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

                // Force Re-auth with restored keys
                localStorage.removeItem(STORAGE_KEYS.TOKEN);

                setTimeout(() => window.location.reload(), 1500);
            });

        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('Failed: Invalid backup file', 'error');
            input.value = '';
        }
    };

    reader.readAsText(file);
};

// Modal Logic (UI Only)
function showRestoreConfirmationModal(onConfirm) {
    let modal = document.getElementById('restore-confirm-modal');

    if (!modal) {
        // Create Modal Dynamically if missing
        modal = document.createElement('div');
        modal.id = 'restore-confirm-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center hidden';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeRestoreModal()"></div>
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl z-10 text-center transition-all scale-95 opacity-0 transform" id="restore-modal-content">
                <div class="w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl text-yellow-500">warning</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Restore Backup?</h3>
                <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                    This will overwrite your current settings. This action cannot be undone.
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
    // Replace button to remove old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = () => {
        closeRestoreModal();
        onConfirm();
    };

    modal.classList.remove('hidden');
    // Animasi masuk
    setTimeout(() => {
        const content = document.getElementById('restore-modal-content');
        if (content) {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }
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