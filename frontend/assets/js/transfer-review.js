/**
 * Transfer Review Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    loadTransferData();
});

// State
let selectedFiles = [];
let selectedDevices = [];
let availableDevices = [];
let tempSelectedDeviceIds = new Set(); // For modal selection state

/**
 * Load data passed from previous page via sessionStorage
 */
function loadTransferData() {
    try {
        const filesData = sessionStorage.getItem('gdrop_transfer_files');
        const devicesData = sessionStorage.getItem('gdrop_transfer_devices');
        const availableData = sessionStorage.getItem('gdrop_available_devices');
        
        if (!filesData) {
            window.location.href = '../index.html';
            return;
        }
        
        selectedFiles = JSON.parse(filesData);
        selectedDevices = devicesData ? JSON.parse(devicesData) : [];
        availableDevices = availableData ? JSON.parse(availableData) : [];
        
        renderUI();
    } catch (e) {
        console.error('Error loading transfer data:', e);
    }
}

/**
 * Render all UI elements
 */
function renderUI() {
    renderHeader();
    renderFileList();
    renderVisualization();
}

function renderHeader() {
    const fileCountEl = document.getElementById('file-count');
    const recipientNameEl = document.getElementById('recipient-name');
    const deviceCountEl = document.getElementById('device-count');
    
    if (fileCountEl) fileCountEl.textContent = `${selectedFiles.length} items`;
    
    if (recipientNameEl) {
        recipientNameEl.textContent = selectedDevices.length > 0 
            ? 'Selected Devices' 
            : '...';
    }
    
    if (deviceCountEl) {
        deviceCountEl.textContent = selectedDevices.length > 0 
            ? `(${selectedDevices.length} devices)` 
            : '(No devices)';
    }
}

function renderFileList() {
    const container = document.getElementById('file-list');
    if (!container) return;
    
    // Render existing files
    let html = selectedFiles.map((file, index) => `
        <div class="bg-white dark:bg-slate-800 rounded-[1.5rem] p-5 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 dark:border-slate-700 h-48 relative group transition-all hover:shadow-md hover:-translate-y-1">
            <button onclick="removeFile(${index})" class="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <span class="material-symbols-outlined text-lg">close</span>
            </button>
            
            <div class="w-14 h-14 bg-cyan-50 dark:bg-slate-700 text-primary rounded-2xl flex items-center justify-center mb-4">
                <span class="material-symbols-outlined text-3xl">${getFileIcon(file.type)}</span>
            </div>
            
            <h3 class="font-bold text-slate-800 dark:text-white text-sm truncate w-full px-2 mb-1">${file.name}</h3>
            <p class="text-[10px] text-slate-400 font-bold tracking-wider">${formatFileSize(file.size)}</p>
        </div>
    `).join('');

    // Add "Add File" Card
    html += `
        <div onclick="addMoreFiles()" class="bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] p-5 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700 h-48 cursor-pointer hover:border-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group">
            <div class="w-14 h-14 bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-primary rounded-2xl flex items-center justify-center mb-4 transition-colors">
                <span class="material-symbols-outlined text-3xl">add</span>
            </div>
            <h3 class="font-bold text-slate-500 group-hover:text-primary dark:text-slate-400 text-sm">Add Files</h3>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderVisualization() {
    const container = document.getElementById('device-visualization');
    if (!container) return;
    
    // Use Flexbox with wrap or Grid for guaranteed separation
    // Remove absolute positioning logic completely
    container.className = "w-full h-full flex items-center justify-center gap-8 sm:gap-12 px-4 flex-wrap content-center";

    // Show ALL devices, no slice limit
    const displayDevices = selectedDevices;
    
    // Create array of all items to render (devices + add button)
    const itemsToRender = [...displayDevices, { type: 'add_button' }];
    
    container.innerHTML = itemsToRender.map((item, i) => {
        // Stagger logic: alternating for visual flow
        // Even indices (0, 2) go down, Odd indices (1) go up, or vice versa
        // Simple pattern: 0 -> mb-8 (up), 1 -> mt-12 (down), 2 -> mb-8 (up), etc.
        const staggerClass = (i % 2 === 0) ? 'mb-8' : 'mt-12';
        
        if (item.type === 'add_button') {
            return `
                <div onclick="openAddDeviceModal()" class="device-node flex flex-col items-center cursor-pointer group transition-transform hover:scale-105 z-10 ${staggerClass} relative">
                     <div class="absolute top-[100%] left-1/2 w-[1px] h-12 bg-gradient-to-b from-slate-200 to-transparent dark:from-slate-700 -z-10"></div>
                    <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-primary group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-all">
                        <span class="material-symbols-outlined text-slate-300 group-hover:text-primary">add</span>
                    </div>
                    <span class="text-[9px] font-bold text-slate-400 group-hover:text-primary uppercase tracking-widest mt-3 whitespace-nowrap">Add Device</span>
                </div>
            `;
        }
        
        // Render Device Node
        const device = item;
        return `
            <div class="device-node flex flex-col items-center ${staggerClass} relative group transition-transform hover:scale-105 z-10">
                <div class="absolute top-[100%] left-1/2 w-[1px] h-12 bg-gradient-to-b from-slate-200 to-transparent dark:from-slate-700 -z-10"></div>
                <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center relative">
                     <!-- Remove Button (Hover) -->
                     <button onclick="removeDevice('${device.id}')" class="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">close</span>
                     </button>
                    <span class="material-symbols-outlined text-slate-400 dark:text-slate-500 text-2xl group-hover:text-primary transition-colors">${device.icon || 'star'}</span>
                </div>
                <span class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-3 whitespace-nowrap max-w-[100px] truncate text-center">${device.name}</span>
            </div>
        `;
    }).join('');
}

/**
 * File Actions
 */
function addMoreFiles() {
    document.getElementById('add-files-input').click();
}

function handleFilesAdded(files) {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified
    }));
    
    selectedFiles = [...selectedFiles, ...newFiles];
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(selectedFiles));
    
    renderUI();
    // Reset input
    document.getElementById('add-files-input').value = '';
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(selectedFiles));
    renderUI();
}

/**
 * Device Actions
 */
function removeDevice(deviceId) {
    selectedDevices = selectedDevices.filter(d => d.id !== deviceId);
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));
    renderUI();
}

/**
 * Modal Logic
 */
function openAddDeviceModal() {
    const modal = document.getElementById('add-device-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    
    // Prepare selected set for checking
    tempSelectedDeviceIds = new Set(selectedDevices.map(d => d.id));
    
    renderModalDeviceList();
    
    modal.classList.remove('hidden');
    // Animation frame
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('opacity-0', 'scale-95');
    }, 10);
}

function closeAddDeviceModal() {
    const modal = document.getElementById('add-device-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    
    backdrop.classList.add('opacity-0');
    content.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function renderModalDeviceList() {
    const container = document.getElementById('available-devices-list');
    if (!container) return;
    
    if (availableDevices.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-4">No available devices found.</p>';
        return;
    }
    
    container.innerHTML = availableDevices.map(device => {
        const isChecked = tempSelectedDeviceIds.has(device.id);
        const checkClass = isChecked ? 'bg-primary border-primary text-white' : 'border-slate-300 text-transparent';
        
        return `
            <div onclick="toggleModalDevice('${device.id}')" class="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0">
                <div class="w-6 h-6 rounded-md border-2 ${checkClass} flex items-center justify-center transition-all">
                    <span class="material-symbols-outlined text-sm">check</span>
                </div>
                <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                    <span class="material-symbols-outlined">${device.icon}</span>
                </div>
                <div>
                    <p class="font-bold text-slate-700 dark:text-slate-200 text-sm">${device.name}</p>
                    <p class="text-xs text-slate-400 uppercase font-bold">${device.status}</p>
                </div>
            </div>
        `;
    }).join('');
}

function toggleModalDevice(deviceId) {
    if (tempSelectedDeviceIds.has(deviceId)) {
        tempSelectedDeviceIds.delete(deviceId);
    } else {
        tempSelectedDeviceIds.add(deviceId);
    }
    renderModalDeviceList();
}

function confirmAddDevices() {
    // Update selectedDevices based on temp selection
    selectedDevices = availableDevices.filter(d => tempSelectedDeviceIds.has(d.id));
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));
    
    renderUI();
    closeAddDeviceModal();
}

/**
 * Cancel and go back
 */
function cancelTransfer() {
    // Optional: Clear session storage if you want strict state
    // sessionStorage.removeItem('gdrop_transfer_files'); 
    
    // Go back to main page
    window.location.href = '../index.html';
}

/**
 * Confirm and Send
 */
/**
 * Confirm and Send
 */
function confirmSend() {
    if (selectedDevices.length === 0) {
        alert("No devices selected!");
        return;
    }
    
    // Ensure data is saved
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(selectedFiles));
    sessionStorage.setItem('gdrop_transfer_devices', JSON.stringify(selectedDevices));
    
    // Redirect to progress page
    window.location.href = 'transfer-progress.html';
}

// Reuse helpers
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'movie';
    if (type.startsWith('audio/')) return 'audio_file';
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return 'folder_zip';
    if (type.includes('document') || type.includes('word')) return 'description';
    if (type.includes('sheet') || type.includes('excel')) return 'table_chart';
    return 'draft';
}
