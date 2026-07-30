/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared tap/hover micro-interaction presets — applied to clickable controls across
// the app so hover/press feedback reads as one consistent system, not per-button tuning.
export const BTN_HOVER = { scale: 1.045 };
export const BTN_TAP = { scale: 0.93 };
export const BTN_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 24,
} as const;

// Slightly lighter touch for large surfaces (cards/tiles) where a full button-scale
// hover would feel too aggressive.
export const CARD_HOVER = { scale: 1.02, y: -2 };
export const CARD_TAP = { scale: 0.98 };
export const CARD_SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 28,
} as const;

// Cursor-following 3D tilt on bookmark tiles. Softer than CARD_SPRING so the card
// trails the pointer rather than snapping to it.
export const TILT_MAX_DEG = 7;
export const TILT_SPRING = { stiffness: 260, damping: 22, mass: 0.4 } as const;
