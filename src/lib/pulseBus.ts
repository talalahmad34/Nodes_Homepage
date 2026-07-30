/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Lets UI components anywhere in the tree ask the background canvas to fire a shock
// ripple at a given viewport point (e.g. the centre of a clicked bookmark tile).
// A DOM event keeps the canvas decoupled from the components that trigger it — no
// context provider or prop threading needed for a purely visual, fire-and-forget effect.

const PULSE_EVENT = "netgrid:pulse";

export interface PulseDetail {
  clientX: number;
  clientY: number;
}

export function emitPulse(clientX: number, clientY: number) {
  window.dispatchEvent(
    new CustomEvent<PulseDetail>(PULSE_EVENT, {
      detail: { clientX, clientY },
    }),
  );
}

export function onPulse(handler: (detail: PulseDetail) => void): () => void {
  const listener = (e: Event) =>
    handler((e as CustomEvent<PulseDetail>).detail);
  window.addEventListener(PULSE_EVENT, listener);
  return () => window.removeEventListener(PULSE_EVENT, listener);
}
