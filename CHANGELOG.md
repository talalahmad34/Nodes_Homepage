# Changelog

All notable changes to the **Nodes Homepage Extension** project will be documented in this file.

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
