import { initAuth } from "./auth.js";

let originalDeviceName = '';

document.addEventListener('DOMContentLoaded', () => {
    const deviceNameInput = document.getElementById('device_name');

    if (deviceNameInput) {
        // 1. Load Saved Name
        const savedName = localStorage.getItem('gdrop_device_name') || localStorage.getItem('gdrop_device_id');
        const finalName = savedName || '';

        originalDeviceName = finalName;
        deviceNameInput.value = finalName;

        deviceNameInput.addEventListener('input', () => {
            updateSaveButtonState(deviceNameInput.value);
        });

        updateSaveButtonState(finalName);
    }

    const toggle = document.getElementById('discoverable-toggle');
    const isDiscoverable = localStorage.getItem('gdrop_is_discoverable') !== 'false';
    if (toggle) {
        isDiscoverable ? toggle.classList.add('active') : toggle.classList.remove('active');
    }
});

// ==========================================
// Helper: Update Button
// ==========================================
function updateSaveButtonState(currentValue) {
    const saveBtn = document.getElementById('save-device-btn');
    if (!saveBtn) return;

    const cleanCurrent = currentValue.trim();

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

    if (typeof window.setDiscoverable === 'function') {
        window.setDiscoverable(isActive);
        const status = isActive ? 'Visible' : 'Hidden';
        if (window.showToast) window.showToast(`Device is now ${status}`, 'info');
    }
};

// ==========================================
// Save Configuration
// ==========================================

window.saveConfiguration = async function (isRetry = false) {
    const deviceNameInput = document.getElementById('device_name');
    const saveBtn = document.getElementById('save-device-btn');
    const deviceName = deviceNameInput?.value.trim();

    if (!deviceName) return;

    const originalContent = saveBtn ? saveBtn.innerHTML : 'Save';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span>';
        saveBtn.disabled = true;
    }

    try {
        localStorage.setItem('gdrop_device_name', deviceName);

        let token = localStorage.getItem('gdrop_token');
        if (!token) token = await initAuth();

        if (token) {
            const apiUrl = `/api/v1/protected/user?token=${token}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: deviceName })
            });

            if (response.status === 401 && !isRetry) {
                console.warn('[Settings] Token Invalid (401). Refreshing...');
                localStorage.removeItem('gdrop_token');
                const newToken = await initAuth();
                if (!newToken) throw new Error("Re-auth failed.");

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
            if (window.showToast) window.showToast('Saved locally (Offline Mode)', 'warning');
            originalDeviceName = deviceName;
            updateSaveButtonState(deviceName);
        }

    } catch (error) {
        console.error('[Settings] Save Error:', error);
        if (window.showToast) window.showToast('Failed to sync: ' + error.message, 'error');

        if (saveBtn) {
            saveBtn.disabled = false;
        }
    } finally {
        if (saveBtn && !isRetry) {
            saveBtn.innerHTML = '<span class="hidden sm:inline">Save</span><span class="material-symbols-outlined text-xl">save</span>';
            updateSaveButtonState(deviceName);
        }
    }
};

// ==========================================
// Identity Backup & Restore
// ==========================================

window.backupIdentity = function () {
    const data = {
        private_key: localStorage.getItem('gdrop_private_key'),
        public_key: localStorage.getItem('gdrop_public_key'),
        device_id: localStorage.getItem('gdrop_device_id'),
        device_name: localStorage.getItem('gdrop_device_name'),
        exported_at: new Date().toISOString()
    };

    if (!data.private_key || !data.public_key) {
        if (window.showToast) window.showToast("No identity found to backup!", "error");
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `gopherdrop-identity-${data.device_name || 'user'}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);

    localStorage.setItem('gdrop_key_exported', 'true');
    if (window.showToast) window.showToast("Identity exported successfully!", "success");
    checkBackupStatus(); // Hide warning if present
};

window.restoreIdentity = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.private_key || !data.public_key) {
                throw new Error("Invalid identity file");
            }

            if (confirm(`Restore identity for "${data.device_name}"? This will replace your current identity.`)) {
                localStorage.setItem('gdrop_private_key', data.private_key);
                localStorage.setItem('gdrop_public_key', data.public_key);
                if (data.device_id) localStorage.setItem('gdrop_device_id', data.device_id);
                if (data.device_name) localStorage.setItem('gdrop_device_name', data.device_name);

                // Set exported flag to true since we just imported a valid key
                localStorage.setItem('gdrop_key_exported', 'true');

                // Clear token to force re-auth
                localStorage.removeItem('gdrop_token');

                alert("Identity restored! Reloading...");
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast("Failed to import identity: " + err.message, "error");
        } finally {
            input.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
};

function checkBackupStatus() {
    // Only check if we are logged in (have keys)
    if (!localStorage.getItem('gdrop_private_key')) return;

    const isExported = localStorage.getItem('gdrop_key_exported');
    const warningToastId = 'backup-warning-toast';
    const container = document.getElementById('toast-container');

    // Remove existing warning if any
    const existing = document.getElementById(warningToastId);
    if (existing) existing.remove();

    if (!isExported) {
        // Show persistent warning
        if (!container) return;

        const toast = document.createElement('div');
        toast.id = warningToastId;
        toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg shadow-yellow-500/10 bg-white border-l-4 border-yellow-500 animate-[slideIn_0.3s_ease-out] pointer-events-auto max-w-sm`;
        toast.innerHTML = `
            <span class="material-symbols-outlined text-yellow-500">warning</span>
            <div class="flex-1">
                <p class="text-xs font-bold text-slate-800">Backup Required</p>
                <p class="text-[10px] text-slate-500">Save your key to avoid losing access.</p>
            </div>
            <button onclick="this.parentElement.remove()" class="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <span class="material-symbols-outlined text-lg">close</span>
            </button>
        `;
        container.appendChild(toast);
    }
}

// Check on load
document.addEventListener('DOMContentLoaded', () => {
    checkBackupStatus();
});