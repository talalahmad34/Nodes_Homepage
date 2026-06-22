# Changelog

All notable changes to the **Nodes Homepage Extension** project will be documented in this file.

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
