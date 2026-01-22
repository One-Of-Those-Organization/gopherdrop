import { initAuth } from "./auth.js";
import { loadComponent } from "./helper.js";

// WebSocket Message Types (Backend Protocol)
const WS_TYPE = {
    START_SHARING: 3,
    USER_SHARE_LIST: 4,
    NEW_TRANSACTION: 5,
    INFO_TRANSACTION: 6,
    DELETE_TRANSACTION: 7,
    USER_SHARE_TARGET: 8,
    FILE_SHARE_TARGET: 9,
    START_TRANSACTION: 10,
    TRANSACTION_SHARE_ACCEPT: 11,
    WEBRTC_SIGNAL: 12
}

// Global Variables
let signalingSocket = null;
let isSocketConnected = false;
let currentTransactionId = null;
let discoveryInterval = null;
let pendingTransactionId = null;

// Helper wrapper untuk Toast (Safe Mode)
const showToast = (msg, type) => {
    if (window.showToast) window.showToast(msg, type);
    else console.log(`[Toast ${type}] ${msg}`);
};

// ==========================================
// Initialization
// ==========================================

async function initializeApp() {
    // 1. Load Components Dulu (Biar container siap)
    await loadComponent('sidebar-container', 'components/sidebar.html');
    await loadComponent('upload-zone-container', 'components/upload-zone.html');

    // 2. Auth & Connection
    const token = await initAuth();
    if (token) {
        connectToSignalingServer(token);
    } else {
        alert("Authentication Failed. Please reload.");
    }

    // 3. Init UI Logic
    if (typeof initFileUpload === 'function') initFileUpload();
    highlightActiveNav();
    startNetworkSpeedIndicator();

    // 4. Init Empty State
    if (typeof renderDevices === 'function' && document.getElementById('device-list')) {
        renderDevices([], 'device-list');
    }
}

function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (currentPath.includes('groups') && href.includes('groups')) {
            item.classList.add('active');
        } else if (currentPath.includes('settings') && href.includes('settings')) {
            item.classList.add('active');
        } else if ((currentPath.endsWith('/') || currentPath.includes('index')) && href.includes('index')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ==========================================
// WebSocket Logic (CORE)
// ==========================================

function connectToSignalingServer(token) {
    if (signalingSocket && (signalingSocket.readyState === WebSocket.OPEN || signalingSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8080/api/v1/protected/ws?token=${token}`;

    console.log('[WS] Connecting to:', wsUrl);
    signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = () => {
        console.log('[WS] Connected');
        isSocketConnected = true;

        // Minta list user pertama kali
        sendSignalingMessage(WS_TYPE.START_SHARING, null);

        // Polling tiap 5 detik (Solusi Discovery Realtime)
        if (discoveryInterval) clearInterval(discoveryInterval);
        discoveryInterval = setInterval(() => {
            if (isSocketConnected) {
                sendSignalingMessage(WS_TYPE.START_SHARING, null);
            }
        }, 5000);
    };

    signalingSocket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleSignalingMessage(msg);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    };

    signalingSocket.onerror = (error) => {
        console.error('[WS] Error:', error);
        showToast('Connection Error', 'error');
    };

    signalingSocket.onclose = () => {
        console.log('[WS] Disconnected');
        isSocketConnected = false;
        signalingSocket = null;
        if (discoveryInterval) clearInterval(discoveryInterval);

        // Auto Reconnect setelah 3 detik
        setTimeout(() => {
            console.log('[WS] Reconnecting...');
            const token = localStorage.getItem('gdrop_token');
            if(token) connectToSignalingServer(token);
        }, 3000);
    };
}

function sendSignalingMessage(type, data) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({ type: type, data: data }));
    } else {
        // console.warn('[WS] Socket not open. Cannot send:', type);
    }
}

// Handle Incoming Messages
function handleSignalingMessage(msg) {
    // console.log('[WS] Received:', msg); // Uncomment buat debug

    switch (msg.type) {
        case WS_TYPE.USER_SHARE_LIST:
            if (typeof updateDeviceListFromBackend === 'function') {
                updateDeviceListFromBackend(msg.data);
            }
            break;

        case WS_TYPE.USER_SHARE_TARGET:
            handleTransactionCreated(msg.data);
            break;

        case WS_TYPE.TRANSACTION_SHARE_ACCEPT:
            if (msg.data && msg.data.transaction && msg.data.sender) {
                // Invite accepted, handle incoming offer
                handleIncomingTransferOffer(msg.data);
            } else {
                // Log Confirmation
                console.log("[WS] Transaction Status:", msg.data);
            }
            break;

        case WS_TYPE.START_TRANSACTION:
            console.log("START TRANSACTION!", msg.data);
            showToast('Starting Transfer...', 'success');
            // TODO: Init WebRTC Logic here (Next Step)
            break;

        case 2: // CONFIG_DISCOVERABLE
            console.log('[WS] Discoverable status synced');
            break;

        case 1: // ERROR
            console.error('[WS] Server error:', msg.data);
            if(msg.data !== "invalid websocket message") {
                showToast(msg.data, 'error');
            }
            break;
    }
}

// ==========================================
// Transaction Logic
// ==========================================

// 1. Sender: Create Group Clicked (Dipanggil UI)
function createNewTransaction() {
    console.log("Requesting new transaction ID...");
    sendSignalingMessage(WS_TYPE.NEW_TRANSACTION, null);
}

// 2. Sender: Handle Transaction Created (Dapat ID dari Server)
function handleTransactionCreated(data) {
    // Data bisa string ID atau object transaction
    const transactionId = (typeof data === 'string') ? data : data.id;

    // Cek apakah ini initial ID atau info transaction lengkap
    const isInitialId = (typeof data === 'string');

    // Cek apakah kita Sender? (Punya data target di session storage)
    const targetDevices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');

    // Jika kita Sender & belum punya ID transaksi aktif
    if (targetDevices.length > 0 && isInitialId) {
        currentTransactionId = transactionId;
        console.log("Transaction Active (Sender):", currentTransactionId);

        // Invite User
        const targetPublicKeys = targetDevices.map(d => d.id);
        sendSignalingMessage(WS_TYPE.USER_SHARE_TARGET, {
            transaction_id: currentTransactionId,
            public_keys: targetPublicKeys
        });

        // Kirim Info File (Jika ada)
        const selectedFiles = JSON.parse(sessionStorage.getItem('gdrop_transfer_files') || '[]');
        if (selectedFiles.length > 0) {
            const filesMeta = selectedFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type || 'application/octet-stream'
            }));

            sendSignalingMessage(WS_TYPE.FILE_SHARE_TARGET, {
                transaction_id: currentTransactionId,
                files: filesMeta
            });
        } else if (!isInitialId && data.id === currentTransactionId) {
            console.log("Invite sent successfully. Waiting for receiver response...");
        }
    } else {
        // Jika bukan Sender, berarti kita Receiver yang dapet info transaksi
        handleIncomingTransferOffer(data);
    }
}

// 3. Receiver: Incoming Offer (MODAL POPUP)
function handleIncomingTransferOffer(data) {
    // Validasi data
    if (!data || !data.transaction) return;

    // Simpan transaction ID sementara
    pendingTransactionId = data.transaction.id;
    console.log("[Receiver] Incoming Offer:", data);

    const senderName = data.sender || "Unknown Device";
    const files = data.transaction.files || [];
    const fileName = files.length > 0
        ? `${files[0].name} ${files.length > 1 ? `(+${files.length-1} more)` : ''}`
        : 'Unknown Files';

    // Panggil UI Modal dari components.js
    if (window.showIncomingModal) {
        window.showIncomingModal(senderName, fileName);
    } else {
        // Fallback kalau components.js belum siap
        const accept = confirm(`Incoming from ${senderName}: ${fileName}. Accept?`);
        window.respondToInvitation(accept);
    }
}

// 4. Receiver: User Click Accept/Decline (Dipanggil dari HTML Modal)
window.respondToInvitation = function(isAccepted) {
    if (!pendingTransactionId) return;

    console.log(`User Response to ${pendingTransactionId}: ${isAccepted ? 'ACCEPTED' : 'DECLINED'}`);

    // Kirim jawaban ke Server
    sendSignalingMessage(WS_TYPE.TRANSACTION_SHARE_ACCEPT, {
        transaction_id: pendingTransactionId,
        accept: isAccepted
    });

    // Tutup modal
    if (window.closeIncomingModal) window.closeIncomingModal();

    // Reset ID
    if (!isAccepted) {
        pendingTransactionId = null;
        showToast('Transfer declined', 'info');
    } else {
        showToast('Accepted! Preparing connection...', 'success');
    }
};

// ==========================================
// Expose Functions to Global Window
// ==========================================
// Ini WAJIB biar bisa dipanggil dari components.js atau HTML onclick
window.startTransferProcess = createNewTransaction;

window.setDiscoverable = (isDiscoverable) => {
    sendSignalingMessage(2, isDiscoverable);
};

// Dummy Network Speed
let currentSpeedMbps = 0;
function startNetworkSpeedIndicator() {
    const speedElements = document.querySelectorAll('[data-network-speed]');
    if (!speedElements.length) return;
    setInterval(() => {
        currentSpeedMbps = 10 + Math.random() * 15; // Randomize biar idup
    }, 2000);
    setInterval(() => {
        speedElements.forEach(el => {
            el.textContent = `${currentSpeedMbps.toFixed(1)} MB/s`;
        });
    }, 800);
}
window.updateNetworkSpeed = (mbps) => { currentSpeedMbps = mbps; };

// Run App
document.addEventListener('DOMContentLoaded', initializeApp);