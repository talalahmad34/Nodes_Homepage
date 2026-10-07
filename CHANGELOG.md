# Changelog

All notable changes to the **Nodes Homepage Extension** project will be documented in this file.

## [1.6.0] - 2026-10-07

### Added

- **Orbit backdrop**: a new default background replaces the old "network" particle field. Concentric rings rotate slowly around the clock, satellites ride them trailing short arcs, and a radar beam sweeps round lighting up contacts as it passes. The assembly leans slightly toward the cursor, satellites link to the pointer and to each other when close, and click ripples light up any contact they cross. It is drawn entirely with line strokes and timed from the frame clock, so it stays light on the CPU and runs at the same pace on any refresh rate. Anyone who had "network" selected is moved to Orbit automatically.
- **Work Hours Tracker on every clock face**: the Minimal and Analog faces now show the shift percentage with a thin progress bar under the date, and the Analog face also traces the progress around the rim of the dial. Previously only the Cyber face showed it.

### Changed

- **Sharper backdrop on HiDPI screens**: the canvas is now rendered at the display's pixel density (capped at 2x) instead of being stretched from CSS-pixel resolution, so lines and dots are crisp on high-resolution and scaled displays.
- **Fonts ship with the extension**: Inter and JetBrains Mono are bundled instead of loaded from Google Fonts, so a new tab no longer waits on, or sends a request to, a font CDN and looks the same offline. The unused Space Grotesk font was dropped.

### Fixed

- **Google as the default search engine was being undone**: a leftover migration rewrote a saved `google` default back to `duckduckgo` on every load, even though Settings offers Google. It has been removed.
- **Typed engine shortcuts no longer change your default**: `/g `, `/yt ` and the other shortcuts now apply to the search being typed only. Backspace on an empty bar (or Escape) drops the shortcut engine again.
- **URL detection in the search bar**: addresses with a query string, port, or fragment, plus `localhost` and IPv4 addresses, are now opened directly, while file-like queries such as `test.py`, numbers such as `3.14`, and email addresses are searched instead of being treated as sites.
- **Pinned nodes are real links**: Ctrl/Cmd/Shift-click, middle-click, and the right-click menu now open a node in a new tab or window, and tiles can be focused and opened from the keyboard. The edit/delete buttons also appear when a tile has keyboard focus.
- **Work Hours Tracker showing "NaN% Active"**: the shift start/end fields are now time pickers instead of free text, and stored values are normalized to `HH:MM`.
- **A malformed backup or synced value could break the page**: settings from localStorage, sync, and imported backups are rebuilt field by field over the defaults, and pinned sites must have an `http(s)` URL.
- **Sync**: other open tabs (and other signed-in devices) now pick up changes live; a tab no longer writes its local cache to sync before it has read what is already there; and pinned-site lists larger than Chrome's 8 KB per-item limit are split across several items instead of silently failing to sync.
- **Escape** now closes the settings drawer and the add/edit node form, and clicking outside the form closes it.
- **Extension icons are PNG**: the manifest pointed all four icon sizes at an SVG, which Chrome and the Web Store don't accept for extension icons.
- **`npm run build:zip` and `npm run clean` on Windows**: they depended on `zip` and `rm -rf`. The zip step now uses the `tar` that ships with Windows, and removes any previous archive first so old files can't linger in the upload.
- **AI portals**: Qwen and Kimi pointed at domains that now redirect (`chat.qwen.ai`, `www.kimi.com`), and the model-version tags, which went stale with every release, are now the vendor name.

## [1.5.0] - 2026-07-30

### Added

- **Packet-launch effect on node activation**: Clicking (or middle-clicking) a pinned node now fires a launch burst from the tile's centre — an expanding shock ring, a bright core flash, and four packets streaking outward along the axes — paired with a matching ripple on the background canvas. On the circuit-grid backdrop the ripple also triggers the four-way surge along the grid lines, so activating a node visibly pushes traffic through the board. Navigation is held for ~380ms so the effect reads before the page changes.
- **Cursor comet trail and glow**: The pointer now sheds a trail of fading sparks (denser the faster you move) and carries a soft radial glow, on all three backdrop visualizers. Cursor tracking moved from the canvas wrapper to the window, so the trail and glow continue across tiles, cards, and the clock instead of dying wherever page content sat above the canvas.
- **3D tilt on pinned nodes**: Node tiles now tilt toward the cursor (up to 7°) with spring physics and settle back flat on leave, giving the grid a holographic feel.
- **Smoothly counting telemetry readouts**: CPU%, latency, and TX/RX packet counters now ease toward each new simulated value via a new `useAnimatedNumber` hook instead of snapping between numbers.
- **Clock face styles**: The clock now has three selectable styles (Settings → Clock Face Style) — the original data-dense **Cyber** face, a stripped-down **Minimal** face (just the digits and date), and a literal **Analog** face with SVG hands driven by the same clock state.
- **Configurable AI model portals**: The pinned AI links above the search bar are no longer a fixed set of four. Settings → AI Model Portals now lets you pick from Gemini, ChatGPT, Claude, Qwen, Kimi, DeepSeek, and Grok, and reorder the ones you enable with up/down controls.
- **CI (for real this time)**: `.github/workflows/ci.yml` now actually exists in the repository. Both the README and the 1.4.0 changelog entry described this workflow, but the file was never committed — so the documented typecheck/lint/format/build gate was not running on any push or pull request.

### Changed

- **Search engine picker expands inline**: The engine list now expands horizontally inside the search bar itself (pushing the input aside) rather than opening as an absolutely-positioned dropdown. The old dropdown overlapped the AI portals row directly beneath it, which made both unreadable; expanding within the bar removes the overlap structurally instead of patching it with z-index or blur.
- **Frosted glass on the clock face and node tiles**: Both were opaque enough to read as solid panels. They now use a lighter translucent fill so the animated backdrop is visibly present through them.
- **Circuit-grid backdrop is livelier**: More ambient data runners and a brighter baseline glow on dormant intersection nodes, while keeping the original runner size and speed.

### Fixed

- **Date header missing the day of month**: `formatFullDate` only requested `weekday`, `year`, and `month` from `Intl.DateTimeFormatOptions` — the day number was never part of the format string, so the header looked unchanged for weeks at a time (e.g. always "THURSDAY, JUL 2026") regardless of the actual date. Added `day: "numeric"`.
- `FuturisticClock` was calling other components' state setters (including the parent's `addLog`) from inside `setTime`'s updater function. React flags this as a state update during another component's render and can discard the render pass — a second, intermittent contributor to the date header not appearing. Telemetry now fires from the interval body, tracking the last-logged second in a ref.
- The burst overlay's React key was derived from `Date.now()` during render, an impure call the linter correctly rejects; it now uses a monotonic counter ref.
- Removed `showAnalogOverlay` from `UserSettings`, a leftover field with a default value that was never read or exposed in any UI. Its slot in the settings shape is now the real `clockStyle` setting.

## [1.4.0] - 2026-07-21

### Added

- **Revamped "grid" background**: the simplest of the three backdrop visualizers (previously a static grid of blinking binary digits) is now a living circuit-board — glowing data packets travel along the grid lines, hard-turning at intersections, while dormant intersection nodes light up as the cursor, a packet, or a click ripple passes near them. Clicking now also fires a 4-directional "power surge" burst of packets from the nearest intersection, in addition to the existing ripple ring.
- **Hover/tap micro-interactions across the whole UI**: buttons, toggles, pinned-site tiles, theme/engine/background pickers, and the AI portal cards now have consistent spring-based hover and press feedback (`src/lib/motion.ts`), instead of color-only `:hover` states. The settings-drawer toggle switches were consolidated into a single reusable `ToggleTrack` component with an animated knob.
- **CI**: added the `.github/workflows/ci.yml` workflow the README already documented but which didn't actually exist in the repo (typecheck, lint, format-check, build on every push/PR to `main`).

### Fixed

- Two `react-hooks/set-state-in-effect` lint warnings: the boot-time system log entries are now seeded via a lazy `useState` initializer instead of an effect that called `setState` synchronously, and the search console's active engine is now derived with `useMemo` from `settings.searchEngineId` instead of mirrored into a second piece of state via an effect.
- The circuit-grid and network backgrounds' pulse rings and scanlines were rendering the wrong glow color for the Purple and Rose themes (silently falling back to the amber RGB triplet in a repeated inline ternary that only handled 3 of 5 themes). Colors are now looked up once per theme.
- Removed vestigial AI Studio scaffold files that had nothing to do with this Chrome extension: `nodeshomepageimprovements.bundle` (a stray committed git bundle), `metadata.json`, `.env.example`, and an untracked `assets/.aistudio/` folder.
- The codebase wasn't actually passing its own `format:check` script (13 of ~14 files had drifted from the Prettier config); reformatted everything so CI's format gate is meaningful going forward.

## [1.3.0] - 2026-07-19

### Added

- **Keyboard-accessible node reordering**: Focus a node's grip handle and use the Arrow keys to move it earlier/later in the grid — a full alternative to mouse-only drag-and-drop.
- **Quick search-engine switcher**: Click the engine badge in the search bar to open a dropdown and switch engines instantly, instead of only via the settings drawer or typed shortcuts.
- **Downloadable backup file**: The settings/nodes backup panel can now export a `.json` file directly (in addition to copy/paste) and import one back via a file picker.
- **Structural backup validation**: Restoring a backup (via paste or file) now validates that each pinned site has the expected shape before it's applied, instead of trusting any parsed JSON.
- **Version indicator**: The footer now shows the running build version, sourced from `package.json`.
- **`npm run build:zip`**: Builds and packages the extension into a versioned zip in one step, ready for Chrome Web Store upload.
- **CI**: A GitHub Actions workflow now runs typecheck, lint, format-check, and build on every push/PR to `main`.
- **LICENSE**: Added the Apache-2.0 license text referenced by every source file's header.

### Changed

- **ESLint + Prettier**: The project now has a real lint configuration (flat config, React/TS-aware) instead of `lint` being an alias for `tsc --noEmit`; `npm run typecheck` covers the old behavior. Added `npm run format` / `format:check`.
- Accessibility: the System Log panel is now a live region (`aria-live="polite"`) so screen readers announce new telemetry entries as they stream in.
- Renamed the `package.json` project name from the leftover `react-example` to `nodes-homepage-extension`.

### Fixed

- Removed vestigial AI Studio/Gemini template files (`metadata.json`, `.env.example`) and the dead `appUrl`/`process.env.APP_URL` state that no longer served any purpose in this Chrome-extension-only project.
- Cleaned up dead code surfaced by the new linter: unused imports, an unused `generatedHex` computation, and an unused `categories` grouping in the pinned-sites grid.
- `NetworkBackground`: the canvas-to-tile connector lines used to re-measure every pinned-site tile's position on a fixed 15-frame polling interval regardless of whether anything changed. This is now event-driven — positions are only rescanned when the grid actually changes (nodes added/removed/reordered) or the viewport resizes.

## [1.2.0] - 2026-07-18

### Added

- **Free cross-device sync**: Settings and pinned sites now sync via `chrome.storage.sync` (built into Chrome, no account/cost required), with an automatic `localStorage` fallback so the page still works instantly and outside a packaged extension.
- **System Log panel**: The telemetry event feed that was already being recorded is now viewable from a "System Log" button in the footer, instead of being silently discarded.
- **Site Favicon icon type**: Pinned nodes can now use a real favicon (fetched from a free, key-less lookup service) instead of only initials or a generic globe icon.
- **Two-step delete confirmation**: Deleting a pinned node now requires a second click (with a 3s auto-cancel) instead of deleting instantly on one click.

### Fixed

- **Clock telemetry interval**: The digital clock was tearing down and recreating its update interval on every tick; it now runs a single stable interval.
- **Broken "custom" icon rendering**: The `custom` icon type was documented to hold an image URL but was rendered as text; it now renders the image with a fallback to initials if it fails to load.
- **`npm run dev` crash**: Local development crashed with "process is not defined" (the production build only worked by accident); `vite dev` now stubs `process.env` the same way the build does.
- **`tsc --noEmit` failures**: Added `@types/chrome` (plus a small ambient declaration for `chrome.system.network`, which isn't covered by the package) so the existing Chrome API usage type-checks.
- Removed unused dependencies (`@google/genai`, `express`, `dotenv`, `jszip`, `tsx`) left over from a template this project no longer needs.

### Changed

- Replaced native `prompt()`/`alert()` dialogs (work-hours setup, backup restore) with inline UI feedback that matches the rest of the settings drawer.
- The search bar now autofocuses on load, and the footer's local-IP readout shows "Unavailable" instead of a fake-looking placeholder address when it can't be detected.
- Accessibility: toggle checkboxes are no longer hidden from the accessibility tree, and icon-only buttons now have `aria-label`s.

## [1.1.3] - 2026-06-22

### Added

- **Manual Grid Mode Toggle**: A layout grid button added next to "Add Node" allowing users to toggle manual slot positioning.
- **Smart Empty Slots**: Drag-and-drop slots that are completely transparent and invisible during normal viewing but automatically fade in as dashed targets with slot numbers only when a bookmark card is actively being dragged.
- **Middle-Click Tab Support**: Added native middle-click (`auxclick` on button 1) support on bookmark cards to open links directly in a new tab/window without closing the homepage console.
- **Clock Layout breathing room**: Set the top padding of the main container and the clock top margins back to comfortable values to center elements vertically now that the bookmark grid is restricted to 2 rows.

### Fixed

- **Missing Date visual**: Restored a missing closing brace syntax error inside `formatFullDate` which was preventing the visual calendar date header from appearing above the clock.

## [1.1.2] - 2026-06-22

### Added

- **Work Hours Tracker overlay**: Configurable real-time shift progress percentage display (e.g. `45.3% Active`) shown inside the clock face. Includes fallback system status indicator.
- **Interactive Shift Configuration**: Inline shift start and shift end time text boxes in the settings drawer, which dynamically updates calculations.
- **Dynamic Real-Time IP Detection**: Extension now utilizes the `chrome.system.network` API to discover your real IPv4 local address on startup and registers a listener (`onNetworkLinkChanged`) to update the IP in real-time when network environments or interfaces change.
- **Editable Telemetry Calibration Textarea**: Settings calibration text block is now fully interactive, enabling direct copy-pasting of settings and nodes backup JSON without relying on browser popup prompts.

### Changed

- **Wide Grid Optimization**: Removed the original `max-w-7xl` centered constraint from the homepage column, enabling the pinned bookmarks grid to expand completely from extreme left to extreme right matching header and footer grid columns.
- **Grid Layout Scale**: Updated layout definitions to support an 8-column layout (`xl:grid-cols-8`) on wider displays, allowing 24 bookmarks to comfortably sit in a clean 3-row layout.
- **Compact Digital Clock**: Tighter inner padding, reduced margin spacing, and scaled down typography for a more dense visual footprint.
- **Header Alignment**: Relocated the "Access Granted" user welcome message to the center section of the header to clear out vertical space inside the main viewport.
- **Telemetry Cleanup**: Removed the experimental Hex color graph text block (`TIME COLOR GRAPH`) to streamline system stats.
