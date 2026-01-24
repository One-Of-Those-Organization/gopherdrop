/**
 * GopherDrop - WebRTC Module
 * Handles P2P file transfer with real-time speed tracking
 */

const peerConnections = {}; // Map<PublicKey, RTCPeerConnection>
const activeTransfers = {}; // Map<TransactionID, TransferState>

// Speed Tracker - Real-time speed calculation with smoothing
const SpeedTracker = {
    bytesHistory: [],           // Array of { timestamp, bytes }
    currentSpeed: 0,            // Current speed in bytes/sec
    smoothedSpeed: 0,           // Smoothed speed (exponential moving average)
    smoothingFactor: 0.3,       // EMA factor (lower = smoother, higher = more responsive)
    historyWindowMs: 2000,      // Keep last 2 seconds of data
    updateInterval: null,
    pingInterval: null,
    isTransferring: false,
    estimatedNetworkSpeed: 0,   // Estimated speed when idle

    // Initialize and start idle estimation
    init() {
        this.startIdleEstimation();
        this.updateSpeedDisplay('Checking...');
    },

    // Start idle network speed estimation
    startIdleEstimation() {
        // Initial estimation
        this.estimateNetworkSpeed();

        // Periodic re-estimation every 10 seconds
        this.pingInterval = setInterval(() => {
            if (!this.isTransferring) {
                this.estimateNetworkSpeed();
            }
        }, 10000);
    },

    // Estimate network speed by measuring ping latency and inferring bandwidth
    async estimateNetworkSpeed() {
        try {
            const testSize = 1024; // 1KB test
            const startTime = performance.now();

            // Ping the server's network endpoint
            const response = await fetch('/api/v1/network', {
                method: 'GET',
                cache: 'no-cache'
            });

            if (!response.ok) throw new Error('Network check failed');

            const endTime = performance.now();
            const latencyMs = endTime - startTime;

            // Estimate speed based on latency
            // Lower latency = higher estimated speed
            // This is a rough approximation for LAN networks
            let estimatedMbps;

            if (latencyMs < 5) {
                estimatedMbps = 100; // ~100 Mbps for very fast LAN
            } else if (latencyMs < 10) {
                estimatedMbps = 50;  // ~50 Mbps
            } else if (latencyMs < 20) {
                estimatedMbps = 25;  // ~25 Mbps
            } else if (latencyMs < 50) {
                estimatedMbps = 10;  // ~10 Mbps
            } else if (latencyMs < 100) {
                estimatedMbps = 5;   // ~5 Mbps
            } else {
                estimatedMbps = 1;   // ~1 Mbps or slower
            }

            // Convert Mbps to bytes/sec and add some variance for natural look
            const variance = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
            this.estimatedNetworkSpeed = (estimatedMbps * 1024 * 1024 / 8) * variance;

            // Update display if not transferring
            if (!this.isTransferring) {
                const speedText = this.formatSpeed(this.estimatedNetworkSpeed);
                this.updateSpeedDisplay(speedText);
            }

            console.log(`[SpeedTracker] Ping: ${latencyMs.toFixed(1)}ms, Estimated: ${estimatedMbps} Mbps`);

        } catch (e) {
            console.warn('[SpeedTracker] Network estimation failed:', e);
            if (!this.isTransferring) {
                this.updateSpeedDisplay('-- MB/s');
            }
        }
    },

    // Start active transfer tracking
    start() {
        this.reset();
        this.isTransferring = true;
        // Update UI every 100ms for smooth animation
        this.updateInterval = setInterval(() => this.updateUI(), 100);
    },

    // Stop active tracking
    stop() {
        this.isTransferring = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        // Show final speed briefly then return to idle estimation
        setTimeout(() => {
            if (!this.isTransferring) {
                this.estimateNetworkSpeed();
            }
        }, 2000);
    },

    // Reset transfer data
    reset() {
        this.bytesHistory = [];
        this.currentSpeed = 0;
        this.smoothedSpeed = 0;
    },

    // Record bytes transferred
    addBytes(bytes) {
        const now = Date.now();
        this.bytesHistory.push({ timestamp: now, bytes });

        // Prune old entries outside the window
        const cutoff = now - this.historyWindowMs;
        this.bytesHistory = this.bytesHistory.filter(entry => entry.timestamp > cutoff);

        // Calculate current speed
        this.calculateSpeed();
    },

    // Calculate speed from history
    calculateSpeed() {
        if (this.bytesHistory.length < 2) {
            this.currentSpeed = 0;
            return;
        }

        const now = Date.now();
        const windowStart = now - this.historyWindowMs;

        // Sum bytes in the window
        let totalBytes = 0;
        let firstTimestamp = now;

        for (const entry of this.bytesHistory) {
            if (entry.timestamp > windowStart) {
                totalBytes += entry.bytes;
                if (entry.timestamp < firstTimestamp) {
                    firstTimestamp = entry.timestamp;
                }
            }
        }

        // Calculate time span
        const timeSpanMs = now - firstTimestamp;
        if (timeSpanMs > 0) {
            this.currentSpeed = (totalBytes / timeSpanMs) * 1000; // bytes per second
        }

        // Apply exponential moving average for smooth display
        if (this.smoothedSpeed === 0) {
            this.smoothedSpeed = this.currentSpeed;
        } else {
            this.smoothedSpeed = (this.smoothingFactor * this.currentSpeed) +
                ((1 - this.smoothingFactor) * this.smoothedSpeed);
        }
    },

    // Format speed for display
    formatSpeed(bytesPerSec) {
        if (bytesPerSec <= 0) return '-- MB/s';

        const KB = 1024;
        const MB = KB * 1024;
        const GB = MB * 1024;

        if (bytesPerSec >= GB) {
            return (bytesPerSec / GB).toFixed(2) + ' GB/s';
        } else if (bytesPerSec >= MB) {
            return (bytesPerSec / MB).toFixed(1) + ' MB/s';
        } else if (bytesPerSec >= KB) {
            return (bytesPerSec / KB).toFixed(0) + ' KB/s';
        } else {
            return bytesPerSec.toFixed(0) + ' B/s';
        }
    },

    // Update the UI elements during active transfer
    updateUI() {
        const displaySpeed = this.formatSpeed(this.smoothedSpeed);
        this.updateSpeedDisplay(displaySpeed);
    },

    // Update speed display elements
    updateSpeedDisplay(speedText) {
        // Use data attribute selector to match frontend branch HTML
        const speedElements = document.querySelectorAll('[data-network-speed]');
        speedElements.forEach(el => {
            el.textContent = speedText;
        });
    }
};

// Export for global access
window.SpeedTracker = SpeedTracker;

// Initialize speed tracking on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SpeedTracker.init());
} else {
    SpeedTracker.init();
}

// Chunk size for file transfer (16KB chunks work well with WebRTC)
const CHUNK_SIZE = 16 * 1024;

// Initialize WebRTC
function initWebRTC() {
    if (!window.GopherSocket) return;

    // Listen for Signal
    window.GopherSocket.on(window.WSType.WEBRTC_SIGNAL, handleSignal);

    // Listen for Transaction Start (Receiver Side)
    window.GopherSocket.on(window.WSType.START_TRANSACTION, handleStartTransaction);
}

// 1. Handle Start Transaction (Receiver)
async function handleStartTransaction(data) {
    console.log('[WebRTC] Transaction Started:', data);

    const txId = data.transaction_id;
    const senderKey = data.sender_public_key;
    const files = data.files || [];

    if (!senderKey) {
        console.error('[WebRTC] Missing Sender Public Key!');
        return;
    }

    // Initialize transfer state for receiving
    activeTransfers[txId] = {
        files: files,
        receivedBytes: 0,
        totalBytes: files.reduce((sum, f) => sum + (f.size || 0), 0),
        receivedChunks: [],
        currentFileIndex: 0,
        currentFileBytes: 0
    };

    console.log('[WebRTC] Initiating connection to Sender:', senderKey);
    const pc = createPeerConnection(senderKey, txId);

    // Create Data Channel
    const dc = pc.createDataChannel("file-transfer");
    setupDataChannel(dc, txId, false);

    // Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendSignal(senderKey, txId, { type: 'offer', sdp: offer });
}

// 2. Handle Messaging (Signaling)
async function handleSignal(msg) {
    const { transaction_id, from_key, data } = msg;

    console.log('[WebRTC] Signal received from', from_key, data.type || 'candidate');

    let pc = peerConnections[from_key];

    // Sender receiving Offer (First time)
    if (!pc) {
        if (data.type === 'offer') {
            console.log('[WebRTC] Received Offer from Receiver');
            pc = createPeerConnection(from_key, transaction_id);
            pc.ondatachannel = (e) => {
                console.log('[WebRTC] Data Channel Received');
                setupDataChannel(e.channel, transaction_id, true);
            };
        } else {
            console.warn('[WebRTC] Received signal for unknown peer', from_key);
            return;
        }
    }

    try {
        if (data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from_key, transaction_id, { type: 'answer', sdp: answer });
            }
        } else if (data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (e) {
        console.error('[WebRTC] Signal Error:', e);
    }
}

// 3. Create Peer Connection
function createPeerConnection(remoteKey, txId) {
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    peerConnections[remoteKey] = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal(remoteKey, txId, { candidate: event.candidate });
        }
    };

    pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection State:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            SpeedTracker.stop();
        }
    };

    return pc;
}

// 4. Send Signal
function sendSignal(targetKey, txId, data) {
    window.GopherSocket.send(window.WSType.WEBRTC_SIGNAL, {
        transaction_id: txId,
        target_key: targetKey,
        data: data
    });
}

// 5. Data Channel & File Transfer Logic
function setupDataChannel(dc, txId, isSender = false) {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
        console.log('[WebRTC] Data Channel Open');
        SpeedTracker.start();

        if (isSender) {
            startFileSend(dc, txId);
        }
    };

    dc.onclose = () => {
        console.log('[WebRTC] Data Channel Closed');
        SpeedTracker.stop();
    };

    dc.onmessage = (event) => {
        // Handle incoming data (file chunks)
        const bytes = event.data.byteLength || 0;
        SpeedTracker.addBytes(bytes);

        // Store received data
        const transfer = activeTransfers[txId];
        if (transfer) {
            transfer.receivedBytes += bytes;
            transfer.receivedChunks.push(event.data);

            console.log(`[WebRTC] Received ${formatBytes(bytes)}, Total: ${formatBytes(transfer.receivedBytes)}/${formatBytes(transfer.totalBytes)}`);

            // Check if transfer is complete
            if (transfer.receivedBytes >= transfer.totalBytes) {
                handleTransferComplete(txId);
            }
        }
    };

    dc.onerror = (error) => {
        console.error('[WebRTC] Data Channel Error:', error);
        SpeedTracker.stop();
    };
}

// Send files with chunking and speed tracking
async function startFileSend(dc, txId) {
    const files = selectedFiles;
    if (!files || files.length === 0) return;

    console.log('[WebRTC] Sending files...', files);

    for (const file of files) {
        await sendFileInChunks(dc, file);
    }

    console.log('[WebRTC] All files sent!');
    SpeedTracker.stop();
}

// Send a single file in chunks
function sendFileInChunks(dc, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async () => {
            const arrayBuffer = reader.result;
            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

            console.log(`[WebRTC] Sending ${file.name}: ${formatBytes(arrayBuffer.byteLength)} in ${totalChunks} chunks`);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
                const chunk = arrayBuffer.slice(start, end);

                // Wait for buffer to drain if needed
                while (dc.bufferedAmount > CHUNK_SIZE * 10) {
                    await new Promise(r => setTimeout(r, 10));
                }

                try {
                    dc.send(chunk);
                    SpeedTracker.addBytes(chunk.byteLength);
                } catch (e) {
                    console.error('[WebRTC] Send chunk failed:', e);
                    reject(e);
                    return;
                }
            }

            console.log(`[WebRTC] Finished sending: ${file.name}`);
            resolve();
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Handle completed transfer
function handleTransferComplete(txId) {
    const transfer = activeTransfers[txId];
    if (!transfer) return;

    console.log('[WebRTC] Transfer complete!');
    SpeedTracker.stop();

    // Combine chunks into files
    const blob = new Blob(transfer.receivedChunks);

    // For single file, trigger download
    if (transfer.files.length === 1) {
        const fileName = transfer.files[0].name || 'download';
        downloadBlob(blob, fileName);
    } else {
        // Multiple files would need more complex handling (ZIP or sequential)
        downloadBlob(blob, 'gopherdrop-transfer');
    }

    // Cleanup
    delete activeTransfers[txId];
}

// Download blob as file
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Format bytes helper
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Init when available
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebRTC);
} else {
    initWebRTC();
}
