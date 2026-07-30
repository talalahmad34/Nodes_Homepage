/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";

// Eases a displayed number toward `target` over `duration` ms so telemetry readouts
// tick up smoothly instead of snapping to each new simulated value.
export function useAnimatedNumber(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(
        Math.round(fromRef.current + (target - fromRef.current) * eased),
      );
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // `display` is intentionally excluded: including it would restart the tween on
    // every animated frame. It is read once at tween start as the origin value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
