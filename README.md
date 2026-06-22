# 🌐 Nodes Homepage Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg?logo=google-chrome&logoColor=white&color=0891b2)](https://chrome.google.com/webstore)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)

<img width="1724" height="994" alt="image" src="https://github.com/user-attachments/assets/709a6132-7d9c-4146-8688-3e79da2e3077" />


A premium, minimal New Tab homepage extension featuring a responsive digital clock, customizable pinned connection nodes, built-in search engine routing, and live telemetry system metrics simulation—designed with a sleek, futuristic cybernetic network aesthetic.

---

## ⚡ Core Features

* **Digital Clock & Binary Matrix:** Displays responsive system time alongside real-time hexadecimal representation and optional binary matrix graphs.
* **Custom Pinned Shortcut Nodes:** Grid launcher for your favorite destinations with customizable network ports, connection labels, and drag-and-drop sorting.
* **Integrated Search Console:** Directly execute web searches. Supports command routers on the fly (e.g., `/g` for Google, `/d` for DuckDuckGo).
* **Live System Telemetry:** Live simulation of CPU diagnostics, latency ping metrics, and packet streams to create a dynamic cybernetic vibe.
* **Dynamic Canvas Backgrounds:** Interactive networking nodes, starfields, or matrix grids that ripple and connect to cursor movement.

---

## 🛠️ Local Setup & Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) installed on your machine.

1. **Clone or navigate to the directory:**
   ```bash
   git clone https://github.com/your-username/nodes-homepage-extension.git
   cd nodes-homepage-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the production extension package:**
   ```bash
   npm run build
   ```

---

## 🧩 Loading the Extension in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the **`dist`** directory inside this project folder:
   `nodes-homepage-extension/dist`
5. Open a new tab (`Ctrl + T`) to launch your new dashboard!

---

## 📦 Distribution & Chrome Web Store

* **Pre-packaged Release:** The `nodes-homepage-extension.zip` in the root folder contains the compiled output ready for direct distribution or uploading as a new version on the Chrome Web Store.
* **To package manually:**
  ```bash
  zip -r nodes-homepage-extension.zip dist
  ```
