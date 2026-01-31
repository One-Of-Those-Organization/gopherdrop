import { initAuth } from "./auth.js";
import { loadComponent } from "./helper.js";

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL Backend Ngrok Static (Tanpa https:// dan tanpa slash akhir)
const PROD_HOST = 'washable-collusively-arcelia.ngrok-free.dev';
const LOCAL_HOST = 'localhost:8080';

// URL HTTP API (untuk fetch SSID, dll)
const PROD_API_URL = `https://${PROD_HOST}`;
const LOCAL_API_URL = `http://${LOCAL_HOST}`;
const API_BASE_URL = IS_LOCALHOST ? LOCAL_API_URL : PROD_API_URL;

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

// Chunk Size untuk Transfer File
const CHUNK_SIZE = 16 * 1024; // 16 KB per chunk

// ==========================================
// GLOBAL VARIABLES
// ==========================================

// WebSocket State
let signalingSocket = null;
let isSocketConnected = false;
let currentTransactionId = null;
let discoveryInterval = null;
let pendingTransactionId = null;

// WebRTC State
let peerConnections = {};
let dataChannels = {};
let acceptedPublicKeys = new Set();
let fileQueue = [];

// File Transfer State (Sender)
let transferStates = {};

// File Transfer State (Receiver)
let incomingFileInfo = null;
let incomingFileBuffer = [];
let incomingReceivedSize = 0;
let receivedFileCount = 0;

// File Who is Sending
let isInitiatorRole = false;

// Helper wrapper untuk Toast (Safe Mode)
const showToast = (msg, type) => {
    if (window.showToast) window.showToast(msg, type);
};

// Anti spam
let consecutiveFailures = 0;
let cooldownInterval = null;

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize App
async function initializeApp() {
    const prefix = window.location.pathname.includes('/pages/') ? '../' : '';

    // Load Common Components
    await loadComponent('sidebar-container', `${prefix}components/sidebar.html`);

    if (!document.getElementById('incoming-modal-container')) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'incoming-modal-container';
        document.body.appendChild(modalDiv);
    }
    await loadComponent('incoming-modal-container', `${prefix}components/incoming-modal.html`);

    // Upload Zone: Hanya di-load jika containernya ada (Dashboard)
    if (document.getElementById('upload-zone-container')) {
        await loadComponent('upload-zone-container', `${prefix}components/upload-zone.html`);
    }

    // Auth & Connection (Menjaga status tetap "Online" di semua page)
    const token = await initAuth();
    if (token) {
        connectToSignalingServer(token);
    }

    // Init UI Logic
    if (typeof initFileUpload === 'function') initFileUpload();
    highlightActiveNav();
    startNetworkSpeedIndicator();
    await fetchNetworkSSID();
}

// Fetch current network SSID from backend API
async function fetchNetworkSSID() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/network/ssid`, {
            headers: {
                "ngrok-skip-browser-warning": "true"
            }
        });

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
        // Set fallback text
        const desktopEl = document.getElementById('network-ssid-desktop');
        if (desktopEl) desktopEl.textContent = 'Local Network';

        const mobileEl = document.getElementById('network-ssid-mobile');
        if (mobileEl) mobileEl.textContent = 'Local Network';
    }
}

// Some UI Highlight on Navigation Bar
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
// WEBSOCKET LOGIC
// ==========================================

function connectToSignalingServer(token) {
    // Prevent multiple connections
    if (signalingSocket && (signalingSocket.readyState === WebSocket.OPEN || signalingSocket.readyState === WebSocket.CONNECTING)) return;

    // ==========================================
    // DYNAMIC WEBSOCKET CONFIGURATION
    // ==========================================

    // Determine Protocol (WS for local HTTP, WSS for HTTPS/Cloudflare/Ngrok)
    const protocol = (window.location.protocol === 'https:' || !IS_LOCALHOST) ? 'wss:' : 'ws:';

    // Determine Host Backend (Get from Global Constants above)
    const host = IS_LOCALHOST ? LOCAL_HOST : PROD_HOST;

    // WebSocket URL
    const wsUrl = `${protocol}//${host}/api/v1/protected/ws?token=${token}`;

    // Init Socket
    signalingSocket = new WebSocket(wsUrl);

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    // Fetching "Who" is online every 3 seconds
    signalingSocket.onopen = () => {
        isSocketConnected = true;

        const isDiscoverable = localStorage.getItem('gdrop_is_discoverable') !== 'false';

        sendSignalingMessage(2, isDiscoverable);

        sendSignalingMessage(WS_TYPE.START_SHARING, null);

        if (discoveryInterval) clearInterval(discoveryInterval);
        discoveryInterval = setInterval(() => {
            if (isSocketConnected) {
                sendSignalingMessage(WS_TYPE.START_SHARING, null);
            }
        }, 3000);
    };

    signalingSocket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleSignalingMessage(msg);
        } catch (e) {
        }
    };

    signalingSocket.onclose = () => {
        isSocketConnected = false;
        signalingSocket = null;
        if (discoveryInterval) clearInterval(discoveryInterval);

        // Auto Reconnect dalam 3 detik
        setTimeout(() => {
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
        // Device List Update
        case WS_TYPE.USER_SHARE_LIST:
            if (typeof updateDeviceListFromBackend === 'function') {
                updateDeviceListFromBackend(msg.data);
            }
            break;

        // New Transaction Created - Offering
        case WS_TYPE.USER_SHARE_TARGET:
            // [FIXED] Hapus logic busy check manual disini, biarkan handleTransactionCreated mengurusnya
            // agar bisa mengirim sinyal auto-decline jika busy.
            handleTransactionCreated(msg.data);
            break;

        // New Transaction Created - Receiver
        case WS_TYPE.TRANSACTION_SHARE_ACCEPT:
            if (msg.data && msg.data.transaction && msg.data.sender) {
                if (msg.data.transaction.sender && msg.data.transaction.sender.user) {
                    targetPublicKey = msg.data.transaction.sender.user.public_key;
                }
                handleIncomingTransferOffer(msg.data);
            } else {
                // Receiving accept/decline notification
                if (msg.data && msg.data.type === 'decline_notification' && msg.data.declined) {
                    const responderName = msg.data.username || "Recipient";
                    showToast(`${responderName} declined your invitation.`, 'error');
                    return;
                }

                // Handle accept notification
                if (msg.data && msg.data.type === 'accept_notification' && msg.data.accepted) {
                    const responderName = msg.data.username || "Recipient";

                    const responderKey = msg.data.sender_public_key;

                    showToast(`${responderName} accepted! Starting transfer...`, 'success');

                    // Auto-start transaction
                    if (currentTransactionId && responderKey) {
                        acceptedPublicKeys.add(responderKey);

                        startWebRTCConnection(true, responderKey);

                        sendSignalingMessage(WS_TYPE.START_TRANSACTION, {
                            transaction_id: currentTransactionId
                        });
                    }
                    return;
                }

                // Fallback Legacy Logic
                if (msg.data.accept === false) {
                    const responderName = msg.data.sender || "Recipient";
                    showToast(`${responderName} declined the transfer.`, 'error');
                    resetTransferState();
                    return;
                }

                // Fallback Legacy Accept
                if (currentTransactionId && msg.data.transaction && msg.data.transaction.id === currentTransactionId) {
                    const devices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');
                    if (devices.length > 0) targetPublicKey = devices[0].id;

                    sendSignalingMessage(WS_TYPE.START_TRANSACTION, {
                        transaction_id: currentTransactionId
                    });
                }
            }
            break;

        // Start Transaction (Both Sides) -> WebSocket out and WebRTC Initiation
        case WS_TYPE.START_TRANSACTION:
            consecutiveFailures = 0;
            window.transferStartTime = Date.now();

            showToast('Initializing Connection...', 'success');

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
                // Sender Side (Queue dari IndexedDB)
                displayFiles = fileQueue.map(f => ({ name: f.name, size: f.size, type: f.type }));
            } else {
                // Receiver Side (Dari paket data)
                if (msg.data && msg.data.files) {
                    displayFiles = msg.data.files;
                }

                // Save sender device name globally
                if (msg.data && msg.data.sender_name) {
                    window.senderDeviceName = msg.data.sender_name;
                } else if (msg.data && msg.data.sender) {
                    window.senderDeviceName = msg.data.sender;
                }
            }

            // Tampilkan Overlay Progress
            if (window.showTransferProgressUI) {
                window.showTransferProgressUI(displayFiles, 1, !isInitiator);
            }

            // Set Global Role & Start WebRTC
            isInitiatorRole = isInitiator;
            sessionStorage.setItem('gdrop_is_sender', isInitiator);

            if (!isInitiator) {
                startWebRTCConnection(false, null);
            }
            break;

        // Data sended using WebSocket for exchanging information (IP, Port, Codecs, etc) for NAT Traversal
        // But it used WebRTC for P2P data transfer
        case WS_TYPE.WEBRTC_SIGNAL:
            handleWebRTCSignal(msg.data);
            break;

        // System Messages
        case 2: // CONFIG_DISCOVERABLE (Ask to set discoverable state)
            break;

        case 1: // ERROR Handling
            if (msg.data !== "invalid websocket message") {
                showToast(msg.data, 'error');
            }
            break;

        case 0: // INFO / KEEPALIVE
            break;
    }
}

// ==========================================
// TRANSACTION LOGIC
// ==========================================

function createNewTransaction() {
    sendSignalingMessage(WS_TYPE.NEW_TRANSACTION, null);
}

function handleTransactionCreated(data) {
    const transactionId = (typeof data === 'string') ? data : data.id;
    const isInitialId = (typeof data === 'string');
    const targetDevices = JSON.parse(sessionStorage.getItem('gdrop_transfer_devices') || '[]');

    if (targetDevices.length > 0 && isInitialId) {
        currentTransactionId = transactionId;

        // Load from IndexedDB
        if (fileQueue.length > 0) {
            const filesMeta = fileQueue.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type || 'application/octet-stream'
            }));

            sendSignalingMessage(WS_TYPE.FILE_SHARE_TARGET, {
                transaction_id: currentTransactionId,
                files: filesMeta
            });
        }

        // Then send target devices
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

    // Auto reject if the receiver is still in another transfer
    const overlay = document.getElementById('transfer-progress-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        sendSignalingMessage(WS_TYPE.TRANSACTION_SHARE_ACCEPT, {
            transaction_id: data.transaction.id,
            accept: false
        });
        return;
    }

    pendingTransactionId = data.transaction.id;
    const senderName = data.sender || "Unknown Device";
    const files = data.transaction.files || [];

    // Check if custom modal function exists
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

    // If Accept then send the accept signal for creating WebRTC connection
    sendSignalingMessage(WS_TYPE.TRANSACTION_SHARE_ACCEPT, {
        transaction_id: pendingTransactionId,
        accept: isAccepted
    });

    if (window.closeIncomingModal) window.closeIncomingModal();

    if (!isAccepted) {
        pendingTransactionId = null;
        resetTransferState();
        showToast('Transfer declined', 'info');
    } else {
        showToast('Accepted! Preparing connection...', 'success');

        if (!window.location.pathname.includes('index.html')) {
            const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
            window.location.href = `${prefix}index.html`;
        }
    }
};

// ==========================================
// WEBRTC LOGIC (P2P ENGINE)
// ==========================================

async function startWebRTCConnection(isInitiator, targetKey) {
    // Don't connect again if the connection is already established
    if (targetKey && peerConnections[targetKey] &&
        (peerConnections[targetKey].connectionState === 'connected' ||
            peerConnections[targetKey].connectionState === 'connecting')) {
        return;
    }

    // Close existing connection if it exists
    if (targetKey && peerConnections[targetKey]) {
        peerConnections[targetKey].close();
    }

    // Reset status transfer file untuk user ini
    if (isInitiator && targetKey) {
        transferStates[targetKey] = { index: 0, busy: false };
    }

    // Create Peer Connection
    const pc = new RTCPeerConnection(RTC_CONFIG);
    if (targetKey) peerConnections[targetKey] = pc;

    // Setup ICE Handler
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
                transaction_id: currentTransactionId || pendingTransactionId,
                target_key: targetKey,
                data: { type: 'candidate', candidate: event.candidate }
            });
        }
    };

    // Connection State Change Handler
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
            showToast('P2P Connected!', 'success');
        }
    };

    // Setup Data Channel
    if (isInitiator && targetKey) {
        // SENDER: Create Channel
        const dc = pc.createDataChannel("file-transfer");

        dataChannels[targetKey] = dc;
        setupDataChannel(dc, targetKey);

        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
            transaction_id: currentTransactionId,
            target_key: targetKey,
            data: { type: 'offer', sdp: offer }
        });
    } else {
        // RECEIVER: Tunggu channel dari Sender
        pc.ondatachannel = (event) => {
            const senderKey = targetKey;
            if (senderKey) {
                dataChannels[senderKey] = event.channel;
                setupDataChannel(event.channel, senderKey);
            }
        };
    }
}

async function handleWebRTCSignal(signal) {
    const remoteKey = signal.from_key;
    const data = signal.data;

    // If the remote key is not found, create a new peer connection
    if (!peerConnections[remoteKey]) {
        if (data.type === 'offer') {
            // [FIXED] Tambahkan await biar koneksi siap dulu
            await startWebRTCConnection(false, remoteKey);
        } else {
            return;
        }
    }

    // Take the peer connection
    const pc = peerConnections[remoteKey];

    if (!pc) {
        // Optional log, maybe offer came too early or late
        return;
    }

    try {
        if (data.type === 'offer') {
            // Receiver Handle Offer
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignalingMessage(WS_TYPE.WEBRTC_SIGNAL, {
                transaction_id: pendingTransactionId,
                target_key: remoteKey,
                data: { type: 'answer', sdp: answer }
            });

        } else if (data.type === 'answer') {
            // Sender Handle Answer
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === 'candidate') {
            // Handle ICE Candidate
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error("ICE Error", e);
            }
        }
    } catch (e) {
        window.showToast("WebRTC Signal Error: " + e, "error");
    }
}

// ==========================================
// DATA TRANSFER LOGIC (CHUNK)
// ==========================================

function setupDataChannel(channel, key) {
    channel.binaryType = 'arraybuffer'; // Kirim data sebagai ArrayBuffer

    // On Open Event
    channel.onopen = () => {
        if (isInitiatorRole && fileQueue.length > 0) {
            if (!transferStates[key]) transferStates[key] = { index: 0, busy: false };

            // Mulai kirim file ke user 'key' ini saja
            sendFileTo(key);
        }
    };

    // On Message Event
    channel.onmessage = (event) => handleIncomingData(event.data);
}

// function sendFileTo(key) {
//     const state = transferStates[key];
//     if (!state) return;

//     // Cek Queue User Ini
//     if (state.index >= fileQueue.length) {
//         // [FIXED] Panggil fungsi Juri untuk cek apakah SEMUA user sudah selesai
//         checkAllPeersDone();
//         return;
//     }

//     const file = fileQueue[state.index];
//     const channel = dataChannels[key];

//     if (!channel || channel.readyState !== 'open') return;

//     // Send Header
//     const metadata = JSON.stringify({
//         type: 'meta', name: file.name, size: file.size, mime: file.type
//     });
//     channel.send(metadata);

//     // Send Body
//     const reader = new FileReader();
//     let offset = 0;

//     reader.onload = (e) => {
//         if (channel.readyState !== 'open') return;

//         channel.send(e.target.result);
//         offset += e.target.result.byteLength;

//         // UI Update (Progress Bar Global - ambil rata-rata atau last active)
//         const progress = Math.min(100, Math.round((offset / file.size) * 100));
//         if (window.updateFileProgressUI) window.updateFileProgressUI(file.name, progress);

//         if (offset < file.size) {
//             readSlice(offset);
//         } else {
//             showToast(`Sent to device`, 'success');
//             // Naikkan index user ini & lanjut
//             state.index++;
//             setTimeout(() => sendFileTo(key), 100);
//         }
//     };

//     const readSlice = (o) => {
//         const slice = file.slice(o, o + CHUNK_SIZE);
//         if (channel.bufferedAmount > 10 * 1024 * 1024) setTimeout(() => readSlice(o), 100);
//         else reader.readAsArrayBuffer(slice);
//     };
//     readSlice(0);
// }

async function sendFileTo(key) {
    const state = transferStates[key];
    if (!state) return;

    // Cek Queue User Ini
    if (state.index >= fileQueue.length) {
        checkAllPeersDone();
        return;
    }

    const file = fileQueue[state.index];
    const channel = dataChannels[key];

    if (!channel || channel.readyState !== 'open') return;

    // --- 1. SETUP BATAS AMAN ANTRIAN (64KB) ---
    const BUFFER_THRESHOLD = 65535;
    channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD / 2;

    // --- 2. KIRIM METADATA ---
    const metadata = JSON.stringify({
        type: 'meta', name: file.name, size: file.size, mime: file.type
    });
    channel.send(metadata);

    // --- 3. LOOPING CHUNK (GANTI FILEREADER JADI ASYNC LOOP) ---
    let offset = 0;

    try {
        while (offset < file.size) {
            // A. CEK REM (BACKPRESSURE)
            // Kalau antrean penuh (>64KB), kita PAUSE dulu sampai browser bilang "Lanjut"
            if (channel.bufferedAmount > BUFFER_THRESHOLD) {
                await new Promise(resolve => {
                    channel.onbufferedamountlow = () => {
                        channel.onbufferedamountlow = null;
                        resolve();
                    };
                });
            }

            // B. POTONG & BACA CHUNK
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const buffer = await chunk.arrayBuffer(); // Cara modern baca file

            // C. KIRIM
            if (channel.readyState !== 'open') break; // Cek koneksi
            channel.send(buffer);

            offset += buffer.byteLength;

            // D. UPDATE UI
            const progress = Math.min(100, Math.round((offset / file.size) * 100));
            if (window.updateFileProgressUI) window.updateFileProgressUI(file.name, progress);
        }

        // --- 4. SELESAI KIRIM FILE INI ---
        showToast(`Sent to device`, 'success');

        // Naikkan index & Lanjut ke file berikutnya
        state.index++;

        // Kasih jeda dikit sebelum file berikutnya biar napas
        setTimeout(() => sendFileTo(key), 100);

    } catch (err) {
        console.error("Error sending file:", err);
        showToast("Transfer error", "error");
    }
}

function checkAllPeersDone() {
    const allPeers = Array.from(acceptedPublicKeys);

    if (allPeers.length === 0) return;

    let allFinished = true;

    for (const key of allPeers) {
        const state = transferStates[key];

        // Jika ada state yang belum ada (belum mulai) atau index < jumlah file
        if (!state || state.index < fileQueue.length) {
            allFinished = false;
            break;
        }
    }

    // Jika semua true, tampilkan complete UI
    if (allFinished) {
        const statusEl = document.getElementById('transfer-status-text');
        if (statusEl) statusEl.textContent = "ALL TRANSFERS COMPLETED";

        if (window.showTransferCompleteUI) {
            setTimeout(() => window.showTransferCompleteUI(), 1000);
        }
    }
}

function handleIncomingData(data) {
    if (typeof data === 'string') {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'meta') {
                incomingFileInfo = msg;
                incomingFileBuffer = []; // Reset buffer
                incomingReceivedSize = 0;

                // Update UI: Mulai nerima
                if (window.updateFileProgressUI) window.updateFileProgressUI(msg.name, 1);
            }
        } catch (e) { }
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

            if (typeof receivedFileCount === 'undefined') receivedFileCount = 0;
            receivedFileCount++;

            // Update UI status text
            const statusEl = document.getElementById('transfer-status-text');
            if (statusEl) statusEl.textContent = `Received ${receivedFileCount} files`;

            // Jika kita punya info total file dari START_TRANSACTION, kita bisa show complete UI
            if (fileQueue.length > 0 && receivedFileCount >= fileQueue.length) {
                if (statusEl) statusEl.textContent = "ALL RECEIVED";
                // Set mode receiver agar UI komponen tau
                window.isReceiverMode = true;
                window.lastTransferFiles = fileQueue;
                if (window.showTransferCompleteUI) setTimeout(() => window.showTransferCompleteUI(), 1000);
            }
        }
    }
}

window.receivedFileBlobs = [];

function saveReceivedFile(meta, buffers) {
    const blob = new Blob(buffers, { type: meta.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    window.receivedFileBlobs.push({
        name: meta.name,
        url: url,
        size: meta.size
    });

    // Auto Download
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
    }, 1000);

    // Track downloaded file
    // downloadedFiles.push(meta.name);
    // window.lastDownloadedFiles = downloadedFiles;
    if (!window.lastDownloadedFiles) window.lastDownloadedFiles = [];
    window.lastDownloadedFiles.push(meta.name);

    showToast(`Received: ${meta.name}`, 'success');
}

// Toggle Download All Received Files
window.triggerDownloadAll = function () {
    if (!window.receivedFileBlobs || window.receivedFileBlobs.length === 0) {
        showToast("No files available to download", "warning");
        return;
    }

    showToast("Starting batch download...", "info");

    window.receivedFileBlobs.forEach((file, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = file.url;
            a.download = file.name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, index * 500);
    });
};

window.endTransferSession = async function () {
    const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
    // Determine if we are the sender
    const was_sender = isInitiatorRole;

    // Reset State
    if (window.resetTransferState) window.resetTransferState(was_sender);

    // Update role
    isInitiatorRole = false;
    sessionStorage.removeItem('gdrop_is_sender');
    sessionStorage.removeItem('gdrop_sender_name');

    // Revoke Object URLs
    if (window.receivedFileBlobs) {
        window.receivedFileBlobs.forEach(f => URL.revokeObjectURL(f.url));
        window.receivedFileBlobs = [];
    }

    const progressOverlay = document.getElementById('transfer-progress-overlay');
    if (progressOverlay) {
        progressOverlay.classList.add('hidden');
        progressOverlay.classList.remove('flex');
    }

    const completeOverlay = document.getElementById('transfer-complete-overlay');
    if (completeOverlay) completeOverlay.remove();

    if (was_sender) {
        await window.clearFilesFromDB();
        window.location.href = `${prefix}index.html`;
    } else {
        const statusEl = document.getElementById('transfer-status-text');
        if (statusEl) statusEl.textContent = "Ready";
        showToast("Transfer Finished", "info");

        if (fileQueue.length > 0 && window.handleFilesSelected) {
            window.handleFilesSelected(fileQueue);
        }
        window.location.href = `${prefix}index.html`;
    }
};

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

// ==========================================
// HELPER: HANDLE FILES FROM UI
// ==========================================
window.handleFilesSelected = (files) => {
    fileQueue = Array.from(files);

    const meta = fileQueue.map(f => ({ name: f.name, size: f.size, type: f.type }));
    sessionStorage.setItem('gdrop_transfer_files', JSON.stringify(meta));

    const sendBtn = document.getElementById('send-direct-btn');

    if (sendBtn && !sendBtn.classList.contains('pointer-events-none')) {
        sendBtn.disabled = false;
    }
};

function resetTransferState(clearFiles = false) {
    if (cooldownInterval) clearInterval(cooldownInterval);

    // Clean up peer connections Map
    Object.values(peerConnections).forEach(pc => {
        if (pc && pc.connectionState !== 'closed') pc.close();
    });

    peerConnections = {};
    dataChannels = {};
    acceptedPublicKeys.clear();
    transferStates = {};

    currentTransactionId = null;
    pendingTransactionId = null;

    incomingFileInfo = null;
    incomingFileBuffer = [];
    incomingReceivedSize = 0;
    receivedFileCount = 0;

    if (clearFiles) {
        fileQueue = [];
        sessionStorage.removeItem('gdrop_transfer_files');
        consecutiveFailures = 0;
    }

    sessionStorage.removeItem('gdrop_transfer_devices');
    sessionStorage.removeItem('gdrop_group_name');

    if (window.receivedFileBlobs && isInitiatorRole) {
        window.receivedFileBlobs.forEach(f => URL.revokeObjectURL(f.url));
        window.receivedFileBlobs = [];
    }

    const overlay = document.getElementById('transfer-progress-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    if (!clearFiles) consecutiveFailures++;
    let secondsLeft = Math.min(3 * consecutiveFailures, 15);

    const sendButtons = ['send-direct-btn', 'send-files-btn'];
    sendButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.classList.add('pointer-events-none', 'opacity-50', 'cursor-not-allowed');
            btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">timer</span> Wait ${secondsLeft}s`;
        }
    });

    cooldownInterval = setInterval(() => {
        secondsLeft--;
        sendButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (secondsLeft > 0) {
                    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">timer</span> Wait ${secondsLeft}s`;
                } else {
                    clearInterval(cooldownInterval);
                    btn.disabled = false;
                    btn.classList.remove('pointer-events-none', 'opacity-50', 'cursor-not-allowed');
                    btn.innerHTML = (id === 'send-direct-btn') ? '<span class="material-symbols-outlined">send</span> Send Now' : '<span class="material-symbols-outlined">send</span> Send Files to Group';
                }
            }
        });
    }, 1000);
}

// ==========================================
// EXPOSE GLOBALS
// ==========================================
window.updateNetworkSpeed = (mbps) => { currentSpeedMbps = mbps; };
window.startTransferProcess = createNewTransaction;
window.resetTransferState = resetTransferState;

// Run App
document.addEventListener('DOMContentLoaded', initializeApp);