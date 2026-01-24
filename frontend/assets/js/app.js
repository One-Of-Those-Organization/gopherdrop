import { initAuth } from "./auth.js";
import { loadComponent } from "./helper.js";

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

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
};

// Konfigurasi Server STUN (Google Gratis)
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const CHUNK_SIZE = 16 * 1024; // 16 KB per chunk

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let signalingSocket = null;
let isSocketConnected = false;
let currentTransactionId = null;
let discoveryInterval = null;
let pendingTransactionId = null;

// WebRTC State
let peerConnection = null;
let dataChannel = null;
let targetPublicKey = null; // Lawan bicara (Receiver/Sender)
let fileQueue = [];         // Antrian file
let currentFile = null;

// File Transfer State (Sender)
let currentFileIndex = 0;

// File Transfer State (Receiver)
let incomingFileInfo = null;
let incomingFileBuffer = [];
let incomingReceivedSize = 0;

// Helper wrapper untuk Toast (Safe Mode)
const showToast = (msg, type) => {
    if (window.showToast) window.showToast(msg, type);
    else console.log(`[Toast ${type}] ${msg}`);
};

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeApp() {
    // 1. Load Components
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
    fetchNetworkSSID(); // Fetch and display current network SSID

    // 4. Init Empty State
    if (typeof renderDevices === 'function' && document.getElementById('device-list')) {
        renderDevices([], 'device-list');
    }
}

// Fetch current network SSID from backend API
async function fetchNetworkSSID() {
    try {
        const response = await fetch('/api/v1/network/ssid');
        if (!response.ok) throw new Error('Failed to fetch SSID');

        const result = await response.json();
        if (result.success && result.data) {
            const ssid = result.data.ssid || 'Unknown Network';

            // Update desktop element
            const desktopEl = document.getElementById('network-ssid-desktop');
            if (desktopEl) desktopEl.textContent = ssid;

            // Update mobile element
            const mobileEl = document.getElementById('network-ssid-mobile');
            if (mobileEl) mobileEl.textContent = ssid;
        }
    } catch (error) {
        console.error('[Network] Failed to fetch SSID:', error);
        // Set fallback text
        const desktopEl = document.getElementById('network-ssid-desktop');
        if (desktopEl) desktopEl.textContent = 'Local Network';

        const mobileEl = document.getElementById('network-ssid-mobile');
        if (mobileEl) mobileEl.textContent = 'Local Network';
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
// WEBSOCKET LOGIC (CORE)
// ==========================================

function connectToSignalingServer(token) {
    if (signalingSocket && (signalingSocket.readyState === WebSocket.OPEN || signalingSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/protected/ws?token=${token}`;

    console.log('[WS] Connecting to:', wsUrl);
    signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = () => {
        console.log('[WS] Connected');
        isSocketConnected = true;

        // Minta list user pertama kali
        sendSignalingMessage(WS_TYPE.START_SHARING, null);

        // Polling tiap 5 detik
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

        // Auto Reconnect
        setTimeout(() => {
            console.log('[WS] Reconnecting...');
            const token = localStorage.getItem('gdrop_token');
            if (token) connectToSignalingServer(token);
        }, 3000);
    };
}

function sendSignalingMessage(type, data) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({ type: type, data: data }));
    }
}

// Handle Incoming Messages
function handleSignalingMessage(msg) {
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
            // Cek apakah ini Undangan (Receiver) atau Jawaban (Sender)
            if (msg.data && msg.data.transaction && msg.data.sender) {
                // KASUS: Receiver dapet invite
                if (msg.data.transaction.sender && msg.data.transaction.sender.user) {
                    targetPublicKey = msg.data.transaction.sender.user.public_key;
                }
                handleIncomingTransferOffer(msg.data);
            } else {
                // KASUS: Sender dapet notif Accepted atau Declined
                console.log("[Sender] User responded:", msg.data);

                // Handle new decline_notification format from backend
                if (msg.data && msg.data.type === 'decline_notification' && msg.data.declined) {
                    const responderName = msg.data.username || "Recipient";
                    showToast(`${responderName} declined your invitation.`, 'error');
                    resetTransferState();
                    return;
                }

                // Handle accept_notification format from backend
                if (msg.data && msg.data.type === 'accept_notification' && msg.data.accepted) {
                    const responderName = msg.data.username || "Recipient";
                    showToast(`${responderName} accepted! Starting transfer...`, 'success');

                    // Auto-start transaction
                    if (currentTransactionId) {
                        console.log("[Sender] Auto-starting transaction after acceptance...");

                        // Simpan Public Key Penerima (ambil dari session storage)
                        const devices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');
                        if (devices.length > 0) targetPublicKey = devices[0].id;

                        sendSignalingMessage(WS_TYPE.START_TRANSACTION, {
                            transaction_id: currentTransactionId
                        });
                    }
                    return;
                }

                // Legacy decline format
                if (msg.data.accept === false) {
                    const responderName = msg.data.sender || "Recipient";
                    showToast(`${responderName} declined the transfer.`, 'error');
                    resetTransferState();
                    return;
                }

                // Legacy: Cek ID transaksi cocok & kita punya ID aktif (fallback)
                if (currentTransactionId && msg.data.transaction && msg.data.transaction.id === currentTransactionId) {
                    console.log("[Sender] Auto-starting transaction (legacy)...");
                    const devices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');
                    if (devices.length > 0) targetPublicKey = devices[0].id;

                    sendSignalingMessage(WS_TYPE.START_TRANSACTION, {
                        transaction_id: currentTransactionId
                    });
                }
            }
            break;

        case WS_TYPE.START_TRANSACTION:
            console.log("START TRANSACTION RECEIVED!", msg.data);
            showToast('Initializing Connection...', 'success');

            // DETEKSI LOGIKA SENDER VS RECEIVER (CRITICAL FIX)
            // Cek Transaction ID dari paket.
            // - Jika ID sama dengan currentTransactionId (yang kita buat), maka kita Sender.
            // - Jika ID beda atau kita tidak punya ID, maka kita Receiver.

            let isInitiator = false;

            if (msg.data && msg.data.transaction_id) {
                if (currentTransactionId && msg.data.transaction_id === currentTransactionId) {
                    isInitiator = true;
                } else {
                    isInitiator = false;
                }
            } else {
                // Fallback Legacy (Jika tidak ada ID di paket)
                const myPubKey = localStorage.getItem('gdrop_public_key');
                const msgSender = msg.data.sender_public_key || msg.data.sender_id;
                if (msgSender && myPubKey) isInitiator = (msgSender === myPubKey);
                else isInitiator = (fileQueue.length > 0);
            }

            // Siapkan antrian file & UI
            let displayFiles = [];

            if (isInitiator) {
                // fileQueue sudah berisi File objects dari handleFilesSelected
                // JANGAN overwrite dengan metadata dari sessionStorage!
                displayFiles = fileQueue.map(f => ({ name: f.name, size: f.size, type: f.type }));
            } else {
                // Ambil dari data WebSocket (Backend sudah kirim list file)
                if (msg.data && msg.data.files) {
                    displayFiles = msg.data.files;
                } else {
                    displayFiles = [{ name: "Unknown File", size: 0 }];
                }
            }

            // Tampilkan Overlay Progress
            if (window.showTransferProgressUI) {
                // Parameter ke-3: isReceiver (!isInitiator)
                window.showTransferProgressUI(displayFiles, 1, !isInitiator);
            }

            // MULAI WebRTC Handshake
            startWebRTCConnection(isInitiator);
            break;

        case WS_TYPE.WEBRTC_SIGNAL:
            handleWebRTCSignal(msg.data);
            break;

        case 2: // CONFIG_DISCOVERABLE
            console.log('[WS] Discoverable status synced');
            break;

        case 1: // ERROR
            console.error('[WS] Server error:', msg.data);
            if (msg.data !== "invalid websocket message") {
                showToast(msg.data, 'error');
            }
            break;
    }
}

// ==========================================
// TRANSACTION LOGIC
// ==========================================

function createNewTransaction() {
    console.log("Requesting new transaction ID...");
    sendSignalingMessage(WS_TYPE.NEW_TRANSACTION, null);
}

function handleTransactionCreated(data) {
    const transactionId = (typeof data === 'string') ? data : data.id;
    const isInitialId = (typeof data === 'string');
    const targetDevices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');

    if (targetDevices.length > 0 && isInitialId) {
        currentTransactionId = transactionId;
        console.log("Transaction Active (Sender):", currentTransactionId);

        // --- STEP 1: KIRIM INFO FILE DULU (DIPINDAH KE ATAS) ---
        // Gunakan fileQueue langsung karena datanya ada di memori
        if (fileQueue.length > 0) {
            const filesMeta = fileQueue.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type || 'application/octet-stream'
            }));

            console.log("[Sender] Sending file metadata first...");
            sendSignalingMessage(WS_TYPE.FILE_SHARE_TARGET, {
                transaction_id: currentTransactionId,
                files: filesMeta
            });
        }

        // --- STEP 2: BARU KIRIM INVITE ---
        const targetPublicKeys = targetDevices.map(d => d.id);
        sendSignalingMessage(WS_TYPE.USER_SHARE_TARGET, {
            transaction_id: currentTransactionId,
            public_keys: targetPublicKeys
        });

    } else {
        if (!isInitialId && data.id !== currentTransactionId) {
            handleIncomingTransferOffer(data);
        }
    }
}

function handleIncomingTransferOffer(data) {
    if (!data || !data.transaction) return;

    pendingTransactionId = data.transaction.id;
    console.log("[Receiver] Incoming Offer:", data);

    const senderName = data.sender || "Unknown Device";

    // 1. Ambil array files asli dari data transaksi
    const files = data.transaction.files || [];

    // 2. Cek apakah fungsi UI sudah siap
    if (window.showIncomingModal) {
        window.showIncomingModal(senderName, files);
    } else {
        const fileSummary = files.length > 0
            ? `${files[0].name} ${files.length > 1 ? `(+${files.length - 1} more)` : ''}`
            : 'Unknown Files';

        const accept = confirm(`Incoming from ${senderName}: ${fileSummary}. Accept?`);
        window.respondToInvitation(accept);
    }
}

window.respondToInvitation = function (isAccepted) {
    if (!pendingTransactionId) return;

    sendSignalingMessage(WS_TYPE.TRANSACTION_SHARE_ACCEPT, {
        transaction_id: pendingTransactionId,
        accept: isAccepted
    });

    if (window.closeIncomingModal) window.closeIncomingModal();

    if (!isAccepted) {
        pendingTransactionId = null;
        resetTransferState()
        showToast('Transfer declined', 'info');
    } else {
        showToast('Accepted! Preparing connection...', 'success');
    }
};

// ==========================================
// WEBRTC LOGIC (P2P ENGINE)
// ==========================================

async function startWebRTCConnection(isInitiator) {
    console.log(`[WebRTC] Starting... Initiator: ${isInitiator}`);

    // 1. Reset Connection
    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // 2. Setup ICE Handler
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
                transaction_id: currentTransactionId || pendingTransactionId,
                target_key: targetPublicKey,
                data: { type: 'candidate', candidate: event.candidate }
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection State: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
            showToast('P2P Connected!', 'success');

            // Tampilkan UI Progress Overlay
            if (window.showTransferProgressUI) {
                // Ambil info file dari queue atau session
                const files = fileQueue.length > 0 ? fileQueue : JSON.parse(sessionStorage.getItem('gdrop_transfer_files') || '[]');
                window.showTransferProgressUI(files, 1);
            }
        }
    };

    // 3. Setup Data Channel
    if (isInitiator) {
        // SENDER: Bikin Channel
        dataChannel = peerConnection.createDataChannel("file-transfer");
        setupDataChannel(dataChannel);

        // Bikin Offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
            transaction_id: currentTransactionId,
            target_key: targetPublicKey,
            data: { type: 'offer', sdp: offer }
        });

    } else {
        // RECEIVER: Nunggu Channel
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }
}

async function handleWebRTCSignal(signal) {
    if (!peerConnection) return;
    const data = signal.data;

    if (data.type === 'offer') {
        // RECEIVER: Terima Offer -> Bikin Answer
        // PENTING: Set targetPublicKey agar ICE candidates bisa dikirim ke sender
        targetPublicKey = signal.from_key;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
            transaction_id: pendingTransactionId,
            target_key: signal.from_key,
            data: { type: 'answer', sdp: answer }
        });

    } else if (data.type === 'answer') {
        // SENDER: Terima Answer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    } else if (data.type === 'candidate') {
        // Tambah ICE Candidate
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            console.error("Error adding ICE:", e);
        }
    }
}

// ==========================================
// DATA TRANSFER LOGIC (CHUNK)
// ==========================================

function setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer'; // Kirim data sebagai ArrayBuffer

    channel.onopen = () => {
        console.log("[DataChannel] OPEN");
        if (fileQueue.length > 0) {
            currentFileIndex = 0;
            sendCurrentFile();
        }
    };

    channel.onmessage = (event) => {
        handleIncomingData(event.data);
    };
}

function sendCurrentFile() {
    if (currentFileIndex >= fileQueue.length) {
        console.log("All files sent.");
        const statusEl = document.getElementById('transfer-status-text');
        if (statusEl) statusEl.textContent = "ALL COMPLETED";

        // Show completion UI
        if (window.showTransferCompleteUI) window.showTransferCompleteUI();
        return;
    }

    const file = fileQueue[currentFileIndex];
    if (!file) return;

    console.log(`Sending File: ${file.name} (${file.size} bytes)`);

    // 1. Kirim Metadata (JSON)
    const metadata = JSON.stringify({
        type: 'meta',
        name: file.name,
        size: file.size,
        mime: file.type
    });
    dataChannel.send(metadata);

    // 2. Mulai Kirim Chunk
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
        if (dataChannel.readyState !== 'open') return;

        dataChannel.send(e.target.result); // Kirim Chunk ArrayBuffer
        offset += e.target.result.byteLength;

        // Update UI Progress
        const progress = Math.min(100, Math.round((offset / file.size) * 100));
        if (window.updateFileProgressUI) window.updateFileProgressUI(file.name, progress);

        // Lanjut chunk berikutnya
        if (offset < file.size) {
            readSlice(offset);
        } else {
            console.log("File Sent Completely");
            showToast(`Sent: ${file.name}`, 'success');
            currentFileIndex++;
            setTimeout(sendCurrentFile, 100); // Kirim file selanjutnya (kasih napas dikit)
        }
    };

    const readSlice = (o) => {
        const slice = file.slice(o, o + CHUNK_SIZE);
        // Handle Backpressure (Penting biar browser gak crash)
        if (dataChannel.bufferedAmount > 10 * 1024 * 1024) { // Max buffer 10MB
            setTimeout(() => readSlice(o), 100);
        } else {
            reader.readAsArrayBuffer(slice);
        }
    };

    readSlice(0);
}

function handleIncomingData(data) {
    // KASUS 1: Terima Metadata (String JSON)
    if (typeof data === 'string') {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'meta') {
                console.log("Receiving File:", msg.name);
                incomingFileInfo = msg;
                incomingFileBuffer = []; // Reset buffer
                incomingReceivedSize = 0;

                // Update UI: Mulai nerima
                if (window.updateFileProgressUI) window.updateFileProgressUI(msg.name, 1);
            }
        } catch (e) { console.log("Text Data:", data); }
        return;
    }

    // KASUS 2: Terima Chunk (ArrayBuffer)
    if (incomingFileInfo) {
        incomingFileBuffer.push(data);
        incomingReceivedSize += data.byteLength;

        // Update UI Progress Receiver
        const progress = Math.min(100, Math.round((incomingReceivedSize / incomingFileInfo.size) * 100));
        if (window.updateFileProgressUI) window.updateFileProgressUI(incomingFileInfo.name, progress);

        // Cek Selesai
        if (incomingReceivedSize >= incomingFileInfo.size) {
            saveReceivedFile(incomingFileInfo, incomingFileBuffer);
            incomingFileInfo = null; // Reset metadata untuk file berikutnya

            // Cek apakah semua file dalam batch sudah diterima?
            // Kita bisa cek fileQueue di sisi receiver (diisi saat START_TRANSACTION)
            // ATAU cukup cek apakah ini file terakhir di queue?

            // Logika Sederhana:
            // Increment index file yang diterima
            if (typeof receivedFileCount === 'undefined') receivedFileCount = 0;
            receivedFileCount++;

            // Update UI status text
            const statusEl = document.getElementById('transfer-status-text');
            if (statusEl) statusEl.textContent = `Received ${receivedFileCount} files`;

            // Jika kita punya info total file dari START_TRANSACTION, kita bisa show complete UI
            if (fileQueue.length > 0 && receivedFileCount >= fileQueue.length) {
                console.log("[Receiver] All files received.");
                if (statusEl) statusEl.textContent = "ALL RECEIVED";
                if (window.showTransferCompleteUI) setTimeout(() => window.showTransferCompleteUI(), 1000);
            }
        }
    }
}

let receivedFileCount = 0; // State untuk tracking receiver

function saveReceivedFile(meta, buffers) {
    const blob = new Blob(buffers, { type: meta.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    // Auto Download
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);

    showToast(`Received: ${meta.name}`, 'success');
}

// ==========================================
// EXPOSE GLOBALS
// ==========================================
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
        currentSpeedMbps = 10 + Math.random() * 15;
    }, 2000);
    setInterval(() => {
        speedElements.forEach(el => {
            el.textContent = `${currentSpeedMbps.toFixed(1)} MB/s`;
        });
    }, 800);
}
window.updateNetworkSpeed = (mbps) => { currentSpeedMbps = mbps; };

// ==========================================
// HELPER: HANDLE FILES FROM UI
// ==========================================
window.handleFilesSelected = (files) => {
    // Convert FileList ke Array biar enak
    fileQueue = Array.from(files);
    console.log("Files loaded to memory:", fileQueue);

    // Simpan metadata ke session (opsional, buat display aja)
    const meta = fileQueue.map(f => ({ name: f.name, size: f.size, type: f.type }));
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(meta));
};

// function resetTransferState() {
//     console.log("[System] Resetting transfer state...");
//
//     // 1. Tutup koneksi WebRTC jika masih ada
//     if (peerConnection) {
//         peerConnection.close();
//         peerConnection = null;
//     }
//     dataChannel = null;
//
//     // 2. Reset ID dan Target
//     currentTransactionId = null;
//     pendingTransactionId = null;
//     targetPublicKey = null;
//     currentFileIndex = 0;
//
//     // 3. Reset Buffer Penerima
//     incomingFileInfo = null;
//     incomingFileBuffer = [];
//     incomingReceivedSize = 0;
//
//     // 4. Tutup UI Overlay jika terbuka
//     const overlay = document.getElementById('transfer-progress-overlay');
//     if (overlay) {
//         overlay.classList.add('hidden');
//         overlay.classList.remove('flex');
//     }
// }

function resetTransferState() {
    console.log("[System] Clearing all transfer states...");

    // 1. Matikan WebRTC
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    dataChannel = null;

    // 2. Reset Variabel ID & Antrian
    currentTransactionId = null;
    pendingTransactionId = null;
    targetPublicKey = null;
    currentFileIndex = 0;
    fileQueue = [];

    // 3. HAPUS SESSION STORAGE (Biar nggak nyangkut pas refresh)
    sessionStorage.removeItem('gdrop_transfer_devices');
    sessionStorage.removeItem('gdrop_transfer_files');
    sessionStorage.removeItem('gdrop_group_name');

    // 4. Tutup Overlay Progress
    const overlay = document.getElementById('transfer-progress-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

// Expose agar bisa dipanggil dari components.js
window.resetTransferState = resetTransferState;

// Run App
document.addEventListener('DOMContentLoaded', initializeApp);