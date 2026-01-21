/**
 * GopherDrop - Transfer Progress Logic
 */

// State
let transferFiles = [];
let transferDevices = [];
let totalSize = 0;
let processedSize = 0;
let startTime = Date.now();
let transferInterval;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTransferData();
    initializeVisualization();
    startTransferSimulation();
});

function loadTransferData() {
    try {
        const filesData = sessionStorage.getItem('gdrop_transfer_files');
        const devicesData = sessionStorage.getItem('gdrop_transfer_devices');
        
        if (!filesData) {
            // Redirect if no data (optional, or show demo mode)
             // window.location.href = '../index.html';
             // For demo purposes, let's keep empty if fails or use mock
        }
        
        transferFiles = filesData ? JSON.parse(filesData) : [];
        transferDevices = devicesData ? JSON.parse(devicesData) : [];
        
        // Calculate total size
        totalSize = transferFiles.reduce((acc, file) => acc + file.size, 0);
        
        // Render Header Info
        document.getElementById('total-items-badge').textContent = `${transferFiles.length} files`;
        document.getElementById('recipient-count').textContent = `${transferDevices.length} devices`;
        
        // Render Queue
        renderQueue();
        
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (!type) return 'description';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'movie';
    if (type.startsWith('audio/')) return 'music_note';
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('zip') || type.includes('compressed')) return 'folder_zip';
    return 'description';
}

function getFileColor(type) {
    if (!type) return 'bg-slate-50 text-slate-500';
    if (type.startsWith('image/')) return 'bg-blue-50 text-blue-500';
    if (type.startsWith('video/')) return 'bg-purple-50 text-purple-500';
    if (type.includes('pdf')) return 'bg-red-50 text-red-500';
    if (type.includes('zip')) return 'bg-amber-50 text-amber-500';
    return 'bg-slate-50 text-slate-500';
}

function renderQueue() {
    const container = document.getElementById('transfer-queue');
    if (!container) return;
    
    container.innerHTML = transferFiles.map((file, i) => {
        const icon = getFileIcon(file.type);
        const colorClass = getFileColor(file.type);
        
        return `
            <div class="bg-white/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 p-4 rounded-3xl flex items-center gap-4 transition-all hover:bg-white/80 dark:hover:bg-slate-800/60" id="file-item-${i}">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}">
                    <span class="material-symbols-outlined">${icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <p class="font-bold text-sm text-slate-800 dark:text-white truncate">${file.name}</p>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight status-text">Queued</span>
                    </div>
                    <div class="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-slate-300 dark:bg-slate-600 w-[0%] progress-fill transition-[width] duration-300"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Visualization Logic
 */
function initializeVisualization() {
    const container = document.getElementById('network-container');
    const nodesContainer = document.getElementById('recipient-nodes-container');
    const svg = document.getElementById('network-svg');
    const hostNode = document.getElementById('host-node');
    
    if (!container || !nodesContainer || transferDevices.length === 0) return;

    // Grid Layout using CSS Grid Class (3 columns)
    nodesContainer.className = 'w-full h-full p-2 pt-12 grid grid-cols-5 gap-4 content-start items-start';
    
    // Clear previous if any
    nodesContainer.innerHTML = '';

    transferDevices.forEach((device, index) => {
        // Create Node Element (Standard Grid Item)
        const node = document.createElement('div');
        node.className = 'flex flex-col items-center justify-center transition-opacity duration-500 opacity-0 transform translate-y-4';
        
        node.innerHTML = `
            <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center relative group hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">${device.icon || 'personal_video'}</span>
            </div>
            <div class="text-center mt-3">
                <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap truncate max-w-[120px] mx-auto">${device.name}</p>
                <p class="text-[9px] font-bold text-primary mt-0.5 uppercase tracking-tighter">Connected</p>
            </div>
        `;
        
        nodesContainer.appendChild(node);
        
        // Animate entrance
        setTimeout(() => {
            node.classList.remove('opacity-0', 'translate-y-4');
        }, index * 100);
    });
}

/**
 * Simulation Logic
 */
function startTransferSimulation() {
    let currentFileIndex = 0;
    let overallProgress = 0;
    const speedEl = document.getElementById('transfer-speed');
    const timeEl = document.getElementById('time-remaining');
    const overallEl = document.getElementById('overall-percentage');
    const mainBar = document.getElementById('main-progress-bar');
    
    // Base speed (MB/s)
    let currentSpeed = 30 + Math.random() * 20; 
    
    transferInterval = setInterval(() => {
        // Fluctuaten Speed
        currentSpeed = Math.max(10, Math.min(100, currentSpeed + (Math.random() - 0.5) * 10));
        if (speedEl) speedEl.textContent = `${currentSpeed.toFixed(1)} MB/s`;
        
        // Increment Progress
        // Simulation: files complete one by one fast
        const fileItem = document.getElementById(`file-item-${currentFileIndex}`);
        
        if (fileItem && currentFileIndex < transferFiles.length) {
            // Update current file styling
            const fill = fileItem.querySelector('.progress-fill');
            const status = fileItem.querySelector('.status-text');
            
            if (fill && status) {
                // Get current width
                let currentWidth = parseFloat(fill.style.width) || 0;
                let increment = (currentSpeed * 0.1); // Mock increment
                
                if (currentWidth >= 100) {
                    // File Complete
                    fill.style.width = '100%';
                    fill.className = 'h-full bg-green-500 w-full rounded-full transition-all'; // Green
                    status.textContent = 'Complete';
                    status.className = 'text-[10px] font-bold text-green-500 uppercase tracking-tight status-text';
                    
                    currentFileIndex++;
                } else {
                    // File Valid Updating
                    fill.style.width = `${Math.min(100, currentWidth + increment)}%`;
                    fill.className = 'h-full bg-primary w-full transition-none'; // Blue
                    status.textContent = `${Math.round(currentWidth)}%`;
                    status.className = 'text-[10px] font-bold text-primary uppercase tracking-tight status-text';
                }
            }
        }
        
        // Overall Progress
        let completedFiles = currentFileIndex;
        let currentFilePercent = 0;
        if (currentFileIndex < transferFiles.length) {
             const fileItem = document.getElementById(`file-item-${currentFileIndex}`);
             if (fileItem) {
                 const fillEl = fileItem.querySelector('.progress-fill');
                 if (fillEl) {
                    currentFilePercent = (parseFloat(fillEl.style.width) || 0) / 100;
                 }
             }
        }
        
        overallProgress = ((completedFiles + currentFilePercent) / transferFiles.length) * 100;
        overallProgress = Math.min(100, overallProgress);
        
        overallEl.textContent = `${Math.round(overallProgress)}%`;
        mainBar.style.width = `${overallProgress}%`;
        
        // Time remaining
        if (overallProgress < 100) {
            const remaining = (100 - overallProgress) / 2; // Mock calc
            timeEl.textContent = `~ ${Math.ceil(remaining)}s remaining`;
        } else {
            timeEl.textContent = 'Complete';
            clearInterval(transferInterval);
            finishTransfer();
        }
        
    }, 100);
}

function finishTransfer() {
    const statusText = document.getElementById('connection-status');
    if (statusText) statusText.textContent = 'Transfer Complete';
    
    setTimeout(() => {
        alert('Transfer Completed Successfully! (Mock Demo)');
        // Optional: Redirect back to home
        // window.location.href = '../index.html';
    }, 1000);
}

function cancelTransfer() {
    clearInterval(transferInterval);
    if(confirm('Cancel active transfer?')) {
        window.location.href = '../index.html';
    } else {
        startTransferSimulation(); // Resume (sort of, logic simplified)
    }
}
