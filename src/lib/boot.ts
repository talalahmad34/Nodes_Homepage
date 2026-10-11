/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared clock for the boot sequence that plays once when the tab opens: the orbit
// rings expand from the clock, the clock powers on, the search bar wipes in, then the
// portals and node tiles arrive in a wave. The CSS half lives in index.css (.boot-*).
// Timing everything from module load means remounts later on (a theme change
// re-creating the canvas, a node being added) don't replay it.
const BOOT_STARTED_AT = performance.now();

// How long the canvas takes to assemble, in ms.
const CANVAS_BOOT_MS = 1300;
// When the first node tile lands, in seconds, and the gap between tiles after it.
export const TILE_BOOT_DELAY = 0.85;
export const TILE_BOOT_STAGGER = 0.045;
// The whole sequence is over by this point, in ms.
const BOOT_TOTAL_MS = 2200;

// 0 → 1 over the canvas's part of the boot, given a requestAnimationFrame timestamp.
export function canvasBootProgress(now: number): number {
  return Math.min(1, Math.max(0, (now - BOOT_STARTED_AT) / CANVAS_BOOT_MS));
}

export function isBooting(): boolean {
  return performance.now() - BOOT_STARTED_AT < BOOT_TOTAL_MS;
}

export function msUntilBootEnds(): number {
  return Math.max(0, BOOT_TOTAL_MS - (performance.now() - BOOT_STARTED_AT));
}
