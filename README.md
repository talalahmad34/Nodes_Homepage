# 🌐 Nodes Homepage Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg?logo=google-chrome&logoColor=white&color=0891b2)](https://chrome.google.com/webstore)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)

<img width="1724" height="994" alt="image" src="https://github.com/user-attachments/assets/709a6132-7d9c-4146-8688-3e79da2e3077" />

A premium, minimal New Tab homepage extension featuring a responsive digital clock, customizable pinned connection nodes, built-in search engine routing, and live telemetry system metrics simulation—designed with a sleek, futuristic cybernetic network aesthetic.

---

## ⚡ Core Features

- **Digital Clock & Binary Matrix:** Displays responsive system time in three face styles (Cyber, Minimal, Analog), with an optional binary matrix and a work-shift progress tracker.
- **Custom Pinned Shortcut Nodes:** Grid launcher for your favorite destinations with customizable network ports, connection labels, and drag-and-drop sorting (or Arrow keys, for keyboard-only reordering).
- **Integrated Search Console:** Directly execute web searches. Supports command routers on the fly (e.g., `/g` for Google, `/d` for DuckDuckGo), plus an inline engine picker that expands within the search bar.
- **Live System Telemetry:** Simulated CPU diagnostics, latency ping metrics, and packet streams — with counters that ease between values rather than snapping — to create a dynamic cybernetic vibe.
- **Liquid Glass & Boot Sequence:** Panels are clear, rim-lit glass with a cursor-following light, and each new tab powers on with a short boot animation.
- **Dynamic Canvas Backgrounds:** An orbiting ring-and-radar system centred on the clock, a starfield, or a living circuit-board grid — all of which ripple and connect to cursor movement.
- **Free Cross-Device Sync:** Settings and pinned nodes sync through `chrome.storage.sync` (built into Chrome, no account or cost), falling back to `localStorage` outside a packaged extension.
- **Backup & Restore:** Export your configuration as JSON via copy/paste or a downloadable file, and import it back — with structural validation before anything is applied.

---

## ✨ Interactivity

The interface is built to feel physically responsive rather than static:

- **Node launch bursts:** Activating a pinned node fires a shock ring, core flash, and four outbound packets from the tile, rippling into the backdrop canvas — on the circuit-grid backdrop, this surges along the grid lines.
- **Cursor comet trail:** The pointer sheds fading sparks (denser the faster you move) and carries a soft glow, tracked across the whole page including over cards and tiles.
- **Holographic tilt:** Node tiles tilt toward the cursor with spring physics and settle back flat on leave.
- **Frosted glass panels:** The clock face and node tiles are translucent, so the animated backdrop stays visible through them.
- **Consistent press feedback:** Buttons, toggles, and pickers share spring-based hover/tap presets (`src/lib/motion.ts`) instead of per-element `:hover` colors.

---

## 🛠️ Local Setup & Installation

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18+) installed on your machine.

1. **Clone or navigate to the directory:**

   ```bash
   git clone https://github.com/talalahmad34/Nodes_Homepage.git
   cd Nodes_Homepage
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
   `Nodes_Homepage/dist`
5. Open a new tab (`Ctrl + T`) to launch your new dashboard!

---

## 📦 Distribution & Chrome Web Store

- **Build and package in one step:**
  ```bash
  npm run build:zip
  ```
  This builds the extension and produces `nodes-homepage-extension-<version>.zip` in the project root, ready to upload as a new version on the Chrome Web Store.

---

## 🧪 Development Scripts

| Script                 | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Start the Vite dev server                  |
| `npm run build`        | Type-checked production build              |
| `npm run build:zip`    | Build and package as a Web Store-ready zip |
| `npm run typecheck`    | Run `tsc --noEmit`                         |
| `npm run lint`         | Run ESLint                                 |
| `npm run format`       | Format the codebase with Prettier          |
| `npm run format:check` | Check formatting without writing changes   |

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck, lint, format-check, and build on every push and pull request against `main`.

## 📄 License

Licensed under the [Apache License 2.0](./LICENSE).
