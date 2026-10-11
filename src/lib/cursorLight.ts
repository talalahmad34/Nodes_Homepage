/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MouseEvent } from "react";

// Feeds the pointer position to the `.cursor-light` highlight (index.css) as CSS
// variables on the hovered element. Written straight to the style rather than through
// state, so moving the mouse never re-renders anything.
export function trackCursorLight(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
}
