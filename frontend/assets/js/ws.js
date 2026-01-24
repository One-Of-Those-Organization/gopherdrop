/**
 * GopherDrop - WebSocket Module
 * Handles real-time communication for device discovery and signaling
 */

const WSType = {
    NONE: 0,
    ERROR: 1,
    CONFIG_DISCOVERABLE: 2,
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

window.WSType = WSType; // Export Types

class GopherSocket {
    constructor() {
        this.socket = null;
        this.handlers = {};
        this.token = null;
        this.isConnected = false;
    }

    /**
     * Connect to WebSocket server
     * @param {string} token - JWT Token
     */
    connect(token) {
        if (this.socket) {
            this.socket.close();
        }

        this.token = token;
        // Determine protocol (ws vs wss)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = 'localhost:8080'; // Should ideally comes from config
        const url = `${protocol}//${host}/api/v1/protected/ws?token=${token}`;

        console.log('[WS] Connecting to:', url);
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log('[WS] Connected');
            this.isConnected = true;
            this.send(WSType.START_SHARING, null); // Request initial device list
        };

        this.socket.onclose = () => {
            console.log('[WS] Disconnected');
            this.isConnected = false;
            // Simple reconnect logic could go here
            setTimeout(() => {
                if (this.token) this.connect(this.token);
            }, 3000);
        };

        this.socket.onerror = (error) => {
            console.error('[WS] Error:', error);
        };

        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('[WS] Failed to parse message:', e);
            }
        };
    }

    /**
     * Send message to server
     * @param {number} type - WSType
     * @param {any} data - Payload
     */
    send(type, data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('[WS] Socket not ready');
            return;
        }

        // Match server's expected format: { type: int, data: any }
        const payload = JSON.stringify({
            type: type,
            data: data
        });
        this.socket.send(payload);
    }

    /**
     * Register message handler
     * @param {number} type - WSType
     * @param {function} callback
     */
    on(type, callback) {
        if (!this.handlers[type]) {
            this.handlers[type] = [];
        }
        this.handlers[type].push(callback);
    }

    /**
     * Handle incoming message
     */
    handleMessage(msg) {
        // Log all messages specifically relevant to discovery
        if (msg.type === WSType.USER_SHARE_LIST) {
            console.log('[WS] Device List Received:', msg.data);
        }

        const typeHandlers = this.handlers[msg.type];
        if (typeHandlers) {
            typeHandlers.forEach(handler => handler(msg.data));
        }

        // Catch-all handler for debugging
        if (msg.type === WSType.ERROR) {
            console.error('[WS] Server Error:', msg.data);
        }
    }
}

// Export singleton
window.GopherSocket = new GopherSocket();

// Default handler for Device List (can be overridden or added to)
window.GopherSocket.on(WSType.USER_SHARE_LIST, (devices) => {
    // Check if render function is available
    if (typeof updateDeviceList === 'function') {
        updateDeviceList(devices);
    } else {
        console.warn('[WS] No updatedDeviceList function found');
    }
});
