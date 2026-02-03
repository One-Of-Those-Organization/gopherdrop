# GopherDrop

## Overview

GopherDrop is a modern, high-performance peer-to-peer (P2P) file sharing application designed for seamless local network transfers. Built on WebRTC for direct data streaming and WebSockets for real-time signaling, GopherDrop eliminates the need for intermediate cloud servers, ensuring your files remain private and secure.

While GopherDrop is optimized for reliable, low-latency transfers within a Local Area Network (LAN), it also includes best-effort support for cross-network connectivity using STUN for NAT traversal.

## ✨ Key Features

* **⚡ Direct P2P Transfer:** Uses WebRTC Data Channels to send files directly between devices without storing them on a server.
* **📡 Multi-Device Broadcasting:** Send files to multiple recipients simultaneously (Mesh Networking topology).
* **🔒 Secure Identity:** Automatic Ed25519 cryptographic keypair generation for secure device authentication and signaling.
* **💾 Crash Resilience:** Integrated with **IndexedDB** to persist selected files and transfer states, protecting against accidental page reloads.
* **🌗 Modern UI/UX:** Built with **Tailwind CSS**, featuring a responsive design, smooth animations, and native **Dark Mode** support.
* **📂 Unlimited File Sizes:** Streams data in efficient 16KB chunks, limited only by the recipient's device memory/storage.
* **🌐 Network Capabilities:**
    * **LAN/WLAN:** 100% reliable high-speed transfer on local networks.
    * **Internet (WAN):** Best-effort connectivity via public STUN servers. *(Note: Works on most networks, but may fail behind strict Symmetric NATs as no TURN relay is currently implemented).*
* **📱 Platform Independent:** Fully web-based (PWA ready). Works on Chrome, Edge, Firefox, and mobile browsers without installation.

## 🛠️ Tech Stack

**Frontend:**
* **HTML5 & Vanilla JavaScript** (ES6 Modules)
* **Tailwind CSS** (Styling & Dark Mode)
* **WebRTC API** (RTCPeerConnection, RTCDataChannel)
* **IndexedDB API** (Client-side storage)

**Backend (Signaling Server):**
* **Go (Golang)**
* **Gorilla WebSocket**
* **Net/HTTP**

## 🚀 How It Works

1.  **Discovery:** Devices connect to the Go signaling server via WebSocket to broadcast their presence (`public_key` & `username`).
2.  **Signaling:** When sending files, the sender initiates a handshake (Offer/Answer/ICE Candidates) forwarded by the WebSocket server to the specific target(s).
3.  **Transfer:** Once the P2P connection is established, the WebSocket connection is bypassed. File chunks are sent directly via the WebRTC Data Channel.
4.  **Completion:** The receiver reassembles the chunks into a Blob and triggers an automatic download.

## 📦 Installation & Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/gopherdrop.git
cd gopherdrop
```

2.  **Install dependencies**
    ```bash
    go mod tidy
    ```

3.  **Create DB Path**
    ```bash
    mkdir db/
    ```

4.  **Run the backend**
    ```bash
    go run .
    ```
    
    Or use the helper script (Recommended):

    Windows: Run ```./run.bat``` (or double-click it)

    Linux/Mac: Run ```make run``` (if Makefile is available)

5.  **Access the app**

    Open your browser and navigate to:
    http://localhost:8080

6. **Expose to network (optional)**

    To allow other devices to connect, use **ngrok** or expose your local IP:
    ```bash
    ngrok http 8080
    ```

## ⚠️ Limitations

- Cross-network (WAN) transfers are not guaranteed
- No TURN relay server is currently implemented
- File transfer may fail on restrictive or symmetric NAT environments

## 📄 License

This project is licensed under the MIT License.
