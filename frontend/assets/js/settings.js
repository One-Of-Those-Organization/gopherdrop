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

window.toggleDiscoverable = function(el) {
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

window.saveConfiguration = async function(isRetry = false) {
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
            const protocol = window.location.protocol;
            const host = window.location.hostname;
            const port = '8080';
            const apiUrl = `${protocol}//${host}:${port}/api/v1/protected/user?token=${token}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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