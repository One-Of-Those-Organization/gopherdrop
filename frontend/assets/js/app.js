import { initAuth } from "./auth.js";
import { loadComponent } from "./helper.js";

// WebSocket Message Types (Backend Protocol)
const WS_TYPE = {
    // Discovery
    START_SHARING: 3,
    USER_SHARE_LIST: 4,

    NEW_TRANSACTION: 5,          // Client -> Server: Minta ID Transaksi Baru
    INFO_TRANSACTION: 6,         // Client -> Server: Minta Info Transaksi
    DELETE_TRANSACTION: 7,       // Client -> Server: Batalkan Transaksi

    USER_SHARE_TARGET: 8,        // Server -> Client: Info Transaksi (ID & Target)
    FILE_SHARE_TARGET: 9,        // Client -> Server: Kirim Info File (Meta Data)

    START_TRANSACTION: 10,       // Server -> Client: Mulai Transfer (Semua Pihak)
    TRANSACTION_SHARE_ACCEPT: 11,// Client -> Server: Jawaban Penerima (Terima/Tolak)

    WEBRTC_SIGNAL: 12            // Client <-> Server <-> Client: Data WebRTC P2P
}

// Global Variables
let signalingSocket = null;
let isSocketConnected = false;
let currentTransactionId = null;

// ==========================================
// Initialization
// ==========================================

async function initializeApp() {
    // 1. Auth & Connection
    const token = await initAuth();
    if (token) {
        connectToSignalingServer(token);
    }

    // 2. Load Components
    await loadComponent('sidebar-container', 'components/sidebar.html');
    await loadComponent('upload-zone-container', 'components/upload-zone.html');

    // 3. Init UI Logic
    if (typeof initFileUpload === 'function') initFileUpload();
    highlightActiveNav();
    startNetworkSpeedIndicator();

    // 4. Init Device List (Empty State)
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
        sendSignalingMessage(WS_TYPE.START_SHARING, null); // Minta list user
    };

    signalingSocket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleSignalingMessage(msg);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    };

    signalingSocket.onerror = (error) => console.error('[WS] Error:', error);
    signalingSocket.onclose = () => {
        console.log('[WS] Disconnected');
        isSocketConnected = false;
        signalingSocket = null;
    };
}

function sendSignalingMessage(type, data) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({ type: type, data: data }));
    } else {
        console.warn('[WS] Socket not open. Cannot send:', type);
    }
}

// Handle Incoming Messages
function handleSignalingMessage(msg) {
    console.log('[WS] Received:', msg);

    switch (msg.type) {
        case WS_TYPE.USER_SHARE_LIST:
            // Update UI list device (fungsi dari components.js)
            if (typeof updateDeviceListFromBackend === 'function') {
                updateDeviceListFromBackend(msg.data);
            }
            break;

        case WS_TYPE.USER_SHARE_TARGET:
            // Step 2: Server kasih ID Transaksi -> Kita invite teman
            handleTransactionCreated(msg.data);
            break;

        case WS_TYPE.TRANSACTION_SHARE_ACCEPT:
            // Step 3 (Receiver): Ada tawaran masuk
            handleIncomingTransferOffer(msg.data);
            break;

        case WS_TYPE.START_TRANSACTION:
            // Step 4: Semua setuju, Gas WebRTC!
            console.log("START TRANSACTION! Preparing WebRTC...", msg.data);
            // TODO: Init WebRTC Logic here (Next Step)
            break;

        case 2: // CONFIG_DISCOVERABLE
            console.log('[WS] Discoverable updated');
            break;

        case 1: // ERROR
            console.error('[WS] Server error:', msg.data);

            if (typeof window.showToast === 'function') {
                window.showToast(msg.data, 'error');
            } else {
                alert("Server Error: " + msg.data);
            }
            break;
    }
}

// ==========================================
// Transaction Logic (Jembatan UI <-> WS)
// ==========================================

// 1. Sender: Minta ID Transaksi Baru (Dipanggil dari UI Tombol "Create Group")
function createNewTransaction() {
    console.log("Requesting new transaction ID...");
    sendSignalingMessage(WS_TYPE.NEW_TRANSACTION, null);
}

// 2. Sender: Terima ID, lalu Invite User & Upload Info File
function handleTransactionCreated(data) {
    // Data bisa string ID atau object transaction
    const transactionId = (typeof data === 'string') ? data : data.id;
    currentTransactionId = transactionId;

    console.log("Transaction Active:", currentTransactionId);

    // Ambil data yang dipilih user di UI tadi (dari Session Storage)
    // Ingat: logic ini disimpan components.js saat tombol diklik
    const targetDevices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');
    const selectedFiles = JSON.parse(sessionStorage.getItem('gdrop_transfer_files') || '[]');

    // Invite User
    if (targetDevices.length > 0) {
        const targetPublicKeys = targetDevices.map(d => d.id);
        sendSignalingMessage(WS_TYPE.USER_SHARE_TARGET, {
            transaction_id: currentTransactionId,
            public_keys: targetPublicKeys
        });
        console.log("Inviting users:", targetPublicKeys);
    }

    // Kirim Info File
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
        console.log("Sending file metadata:", filesMeta);
    }
}

// 3. Receiver: Muncul Notifikasi Tawaran
function handleIncomingTransferOffer(data) {
    const senderName = data.sender;
    const files = data.transaction.files || [];
    const fileName = files.length > 0 ? files[0].name : 'Unknown File';

    // Simple Confirm Dialog
    const accept = confirm(`Incoming Transfer!\n\nFrom: ${senderName}\nFile: ${fileName}\n\nAccept?`);

    // Kirim Jawaban (Type 11)
    sendSignalingMessage(WS_TYPE.TRANSACTION_SHARE_ACCEPT, {
        transaction_id: data.transaction.id,
        accept: accept
    });
}

// ==========================================
// Expose Functions
// ==========================================

// Ini yang dipanggil components.js saat tombol diklik
window.startTransferProcess = createNewTransaction;

window.setDiscoverable = (isDiscoverable) => {
    sendSignalingMessage(2, isDiscoverable);
};

// ==========================================
// Network Speed (Dummy UI)
// ==========================================
let currentSpeedMbps = 0;
function startNetworkSpeedIndicator() {
    const speedElements = document.querySelectorAll('[data-network-speed]');
    if (!speedElements.length) return;
    setInterval(() => {
        speedElements.forEach(el => el.textContent = `${currentSpeedMbps.toFixed(2)} Mbps`);
    }, 1000);
    setInterval(() => { currentSpeedMbps = 10 + Math.random() * 10; }, 1500);
}
window.updateNetworkSpeed = (mbps) => { currentSpeedMbps = mbps; };

// Run App
document.addEventListener('DOMContentLoaded', initializeApp);