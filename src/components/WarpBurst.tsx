/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Final diameters (px) of the rings that tear outward from the activation point.
const WARP_RING_SIZES = [150, 240, 330];
// Directions (degrees) of the light rays.
const WARP_RAY_ANGLES = Array.from({ length: 10 }, (_, i) => i * 36);

// Long enough for every .warp-* keyframe (the slowest ends at 0.83s) to finish —
// owners unmount the burst after this.
export const WARP_BURST_MS = 900;

// The burst played where an AI portal or a pinned node is activated: a rift opening
// at a viewport point — rings tearing outward, a counter-rotating dashed halo, a spray
// of light rays and a collapsing core — in the active theme colour (--glow-rgb).
//
// It is plain elements driven by CSS keyframes (.warp-* in index.css) that animate
// only transform and opacity, so it runs on the compositor thread and stays smooth
// even while the page is busy navigating. A new `seq` remounts the elements, which
// restarts the keyframes, so a repeat activation replays it.
export default function WarpBurst({
  seq,
  x,
  y,
}: {
  seq: number;
  x: number;
  y: number;
}) {
  return (
    <div
      key={seq}
      className="fixed pointer-events-none z-50"
      style={{ left: x, top: y }}
    >
      {WARP_RING_SIZES.map((size, i) => (
        <span
          key={size}
          className="warp-ring absolute rounded-full border-2"
          style={{
            width: size,
            height: size,
            left: -size / 2,
            top: -size / 2,
            borderColor: "rgb(var(--glow-rgb))",
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}

      <span
        className="warp-halo absolute rounded-full border-2 border-dashed"
        style={{
          width: 210,
          height: 210,
          left: -105,
          top: -105,
          borderColor: "rgba(var(--glow-rgb), 0.8)",
        }}
      />

      {WARP_RAY_ANGLES.map((angle) => (
        <span
          key={angle}
          className="absolute left-0 top-0"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span
            className="warp-ray absolute -left-px bottom-0 w-0.5 h-9 rounded-full origin-bottom"
            style={{
              background:
                "linear-gradient(to top, transparent, rgb(var(--glow-rgb)), #ffffff)",
              animationDelay: `${(angle % 72) / 720}s`,
            }}
          />
        </span>
      ))}

      {/* Core: the glow is a gradient baked into the element, not a box-shadow */}
      <span
        className="warp-core absolute rounded-full"
        style={{
          width: 64,
          height: 64,
          left: -32,
          top: -32,
          background:
            "radial-gradient(circle, #ffffff 0%, #ffffff 16%, rgba(var(--glow-rgb), 0.67) 34%, transparent 70%)",
        }}
      />
    </div>
  );
}
