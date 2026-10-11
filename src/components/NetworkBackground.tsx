/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { canvasBootProgress } from "../lib/boot";
import { onPulse } from "../lib/pulseBus";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface Pulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
}

// A short-lived spark shed behind the cursor as it moves, giving the pointer a
// comet-like trail on every background variant.
interface TrailSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
}

// A single light "packet" traveling along the circuit-grid lines — used only by the
// 'grid' background variant to give the otherwise-static grid a living, breathing feel.
interface CircuitRunner {
  x: number;
  y: number;
  axis: "x" | "y";
  dir: 1 | -1;
  speed: number;
  // Click-spawned bursts self-remove once off-screen instead of respawning forever,
  // so rapid clicking can't accumulate an unbounded number of permanent runners.
  temporary?: boolean;
}

// The 'orbit' variant: a slow gyroscope of concentric rings centred on the clock, with
// satellites riding the rings and a radar beam that lights up contacts as it sweeps.
// Everything is positioned from the frame timestamp rather than stepped per frame, so
// it moves at the same pace on 60Hz and 144Hz displays.
interface OrbitRing {
  radius: number;
  speed: number; // radians per second; sign is the direction of rotation
  arcs: { start: number; length: number }[];
  ticked: boolean;
}

interface OrbitSatellite {
  radius: number;
  angle: number;
  speed: number;
  size: number;
}

interface OrbitBlip {
  angle: number;
  dist: number;
  litAt: number; // timestamp (seconds) the beam or a ripple last crossed it
}

const GRID_SPACING = 40;
const TAU = Math.PI * 2;

// Ring radii as a fraction of the viewport's shorter side. The outer ones are larger
// than the screen on purpose, so they read as sweeping arcs along its edges.
const ORBIT_RING_SCALES = [0.2, 0.3, 0.42, 0.56, 0.72, 0.92, 1.15];
const ORBIT_SWEEP_SPEED = 0.45; // radians per second — one revolution every ~14s
const ORBIT_SWEEP_LINES = 12;
const ORBIT_BLIP_COUNT = 16;
const ORBIT_BLIP_FADE = 2.4; // seconds a contact stays lit

// Render at the display's pixel density so lines stay crisp on HiDPI screens, but
// capped: beyond 2x the extra pixels cost fill time without being visible.
const MAX_PIXEL_RATIO = 2;

type BackgroundType = "orbit" | "starfield" | "grid";

const THEME_COLORS: Record<string, { primary: string; rgb: string }> = {
  "emerald-400": { primary: "#34d399", rgb: "52, 211, 153" },
  "cyan-400": { primary: "#22d3ee", rgb: "34, 211, 238" },
  "amber-400": { primary: "#fbbf24", rgb: "251, 191, 36" },
  "purple-400": { primary: "#c084fc", rgb: "192, 132, 252" },
  "rose-400": { primary: "#fb7185", rgb: "251, 113, 133" },
};

interface NetworkBackgroundProps {
  type?: BackgroundType;
  colorTheme: string; // Tailwind color name, e.g. "cyan-400"
}

export default function NetworkBackground({
  type = "orbit",
  colorTheme,
}: NetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Coerce raw type to make sure it is always stable and defaults to orbit
  const bgType: BackgroundType =
    type === "starfield" || type === "grid" ? type : "orbit";

  // Store mouse coordinates
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  // Store active wave pulses across clicks and frames
  const pulsesRef = useRef<Pulse[]>([]);
  // Store active circuit runners (grid variant only) — mutated in place so the click
  // handler below (outside the animation effect) can inject new bursts into the same array.
  const runnersRef = useRef<CircuitRunner[]>([]);
  // Cursor trail sparks, seeded by the pointer-move handler and decayed in the draw loop.
  const trailRef = useRef<TrailSpark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = THEME_COLORS[colorTheme] ?? THEME_COLORS["emerald-400"];

    let animationFrameId: number;
    // Canvas size in CSS pixels. The backing store is larger on HiDPI screens, and
    // the context is scaled to match, so all drawing below works in CSS pixels.
    let viewW = 0;
    let viewH = 0;
    let particles: Particle[] = [];
    const pulses = pulsesRef.current;
    // Mutated in place (never reassigned) so the click handler outside this effect
    // keeps injecting into the exact array instance the draw loop below is reading.
    const runners = runnersRef.current;
    const trail = trailRef.current;
    let cachedNodeCenters: { x: number; y: number }[] = [];
    const STAR_COUNT = 120;
    const AMBIENT_RUNNER_COUNT = 32;

    let rings: OrbitRing[] = [];
    let satellites: OrbitSatellite[] = [];
    let blips: OrbitBlip[] = [];
    // Where the rings are centred: `hubHome` is the clock's position (measured with
    // the tiles below), and `hub` trails it with a slight lean toward the cursor.
    let hubHome = { x: 0, y: 0 };
    const hub = { x: 0, y: 0 };

    const spawnAmbientRunner = (
      width: number,
      height: number,
    ): CircuitRunner => {
      const cols = Math.max(1, Math.floor(width / GRID_SPACING));
      const rows = Math.max(1, Math.floor(height / GRID_SPACING));
      const axis: "x" | "y" = Math.random() < 0.5 ? "x" : "y";
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      return {
        x: Math.floor(Math.random() * cols) * GRID_SPACING,
        y: Math.floor(Math.random() * rows) * GRID_SPACING,
        axis,
        dir,
        speed: 1.4 + Math.random() * 1.2,
      };
    };

    // A radar contact somewhere between the innermost and fifth ring. `litAt` starts
    // far in the past so it sits dark until the beam first reaches it.
    const spawnBlip = (): OrbitBlip => {
      const inner = rings[0].radius;
      const outer = rings[4].radius;
      return {
        angle: Math.random() * TAU,
        dist: inner + Math.random() * (outer - inner),
        litAt: -ORBIT_BLIP_FADE * 2,
      };
    };

    const resizeCanvas = () => {
      if (containerRef.current && canvas) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          MAX_PIXEL_RATIO,
        );
        viewW = width;
        viewH = height;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        // Resizing resets the context, so the scale is reapplied every time
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        initScene(width, height);
      }
    };

    const initScene = (width: number, height: number) => {
      particles = [];

      if (bgType === "orbit") {
        const base = Math.min(width, height);
        rings = ORBIT_RING_SCALES.map((scale, i) => {
          const arcCount = 2 + (i % 2);
          return {
            radius: base * scale,
            // Neighbouring rings counter-rotate
            speed: (0.025 + Math.random() * 0.04) * (i % 2 === 0 ? 1 : -1),
            arcs: Array.from({ length: arcCount }, (_, a) => ({
              start: (a / arcCount) * TAU + Math.random() * 0.8,
              length: 0.5 + Math.random() * 1.1,
            })),
            ticked: i === 2,
          };
        });

        // Satellites keep a similar on-screen speed whatever ring they ride, so the
        // angular speed falls off with radius. Each runs against its ring's rotation.
        satellites = rings.slice(0, 5).flatMap((ring, i) =>
          Array.from({ length: i === 0 ? 1 : 2 }, () => ({
            radius: ring.radius,
            angle: Math.random() * TAU,
            speed:
              ((22 + Math.random() * 18) / ring.radius) *
              (ring.speed > 0 ? -1 : 1),
            size: 1.6 + Math.random() * 1.4,
          })),
        );

        blips = Array.from({ length: ORBIT_BLIP_COUNT }, spawnBlip);

        hubHome = { x: width / 2, y: height * 0.3 };
        hub.x = hubHome.x;
        hub.y = hubHome.y;
      } else if (bgType === "grid") {
        // Dim "node" dots sitting at circuit-grid intersections — mostly dormant,
        // they light up when a runner, the cursor, or a click pulse passes nearby (see draw()).
        const cols = Math.floor(width / GRID_SPACING);
        const rows = Math.floor(height / GRID_SPACING);
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c <= cols; c++) {
            if (Math.random() < 0.4) {
              const gridX = c * GRID_SPACING;
              const gridY = r * GRID_SPACING;
              particles.push({
                x: gridX,
                y: gridY,
                vx: 0,
                vy: 0,
                radius: Math.random() * 0.8 + 0.6,
                color: colors.primary,
              });
            }
          }
        }

        // (Re)seed the ambient runner pool. Click-spawned bursts are left alone here —
        // they're transient and clear themselves out once off-screen.
        runners.length = 0;
        for (let i = 0; i < AMBIENT_RUNNER_COUNT; i++) {
          runners.push(spawnAmbientRunner(width, height));
        }
      } else {
        // Starfield
        for (let i = 0; i < STAR_COUNT; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0,
            vy: -(Math.random() * 0.4 + 0.1), // Float upwards
            radius: Math.random() * 1.8 + 0.3,
            color: Math.random() > 0.3 ? colors.primary : "#ffffff",
          });
        }
      }
    };

    // The animated line connectors below track the on-screen position of the pinned-site
    // tiles (`.bookmark-tile-node`). Rather than re-querying and measuring every tile on a
    // fixed frame interval regardless of whether anything changed, invalidate the cached
    // positions only when the page actually changes shape (nodes added/removed/reordered,
    // the clock face swapped) or the viewport resizes, and rescan once a short debounce
    // settles.
    let tileRescanNeeded = true;
    let tileRescanTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleTileRescan = () => {
      if (tileRescanTimer) clearTimeout(tileRescanTimer);
      tileRescanTimer = setTimeout(() => {
        tileRescanNeeded = true;
      }, 120);
    };

    // Initialize observer for resize
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      scheduleTileRescan();
    });

    const container = containerRef.current;
    if (container) {
      resizeObserver.observe(container);
    }

    // Set initial size
    resizeCanvas();

    // The tiles slide into place over their first few hundred milliseconds, so the
    // positions measured on the first frame are slightly off — measure again after.
    const settleRescanTimer = setTimeout(() => {
      tileRescanNeeded = true;
    }, 700);

    // Cursor tracking is bound to the window rather than the canvas wrapper: the wrapper
    // sits beneath the page content, so tile/card hovers would otherwise swallow the
    // events and the glow + trail would die whenever the pointer crossed any UI element.
    const handleWindowPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nextX = e.clientX - rect.left;
      const nextY = e.clientY - rect.top;
      const prevX = mouseRef.current.x;
      const prevY = mouseRef.current.y;
      const wasActive = mouseRef.current.active;

      mouseRef.current.x = nextX;
      mouseRef.current.y = nextY;
      mouseRef.current.active = true;

      // Shed sparks proportional to pointer speed, so a flick leaves a longer comet
      // than a slow drift. Count is capped so fast sweeps stay cheap.
      if (!wasActive) return;
      const dist = Math.hypot(nextX - prevX, nextY - prevY);
      const sparkCount = Math.min(3, Math.floor(dist / 9));
      for (let i = 0; i < sparkCount; i++) {
        trail.push({
          x: nextX + (Math.random() - 0.5) * 6,
          y: nextY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1,
          life: 1,
          radius: 0.9 + Math.random() * 0.9,
        });
      }
      if (trail.length > 90) trail.splice(0, trail.length - 90);
    };

    const handleWindowPointerLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleWindowPointerMove);
    document.addEventListener("mouseleave", handleWindowPointerLeave);

    // Watches the page for elements being added, removed, or reordered (childList
    // changes only — deliberately ignores style/class/text mutations so that hover/drag
    // animations and the ticking clock don't trigger constant rescans).
    const layoutMutationObserver = new MutationObserver(scheduleTileRescan);
    layoutMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const drawOrbit = (t: number, boot: number) => {
      const mouse = mouseRef.current;
      const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

      // Lean the whole assembly a few pixels toward the cursor, easing into place
      const leanX = mouse.active ? (mouse.x - hubHome.x) * 0.03 : 0;
      const leanY = mouse.active ? (mouse.y - hubHome.y) * 0.03 : 0;
      hub.x += (hubHome.x + leanX - hub.x) * 0.06;
      hub.y += (hubHome.y + leanY - hub.y) * 0.06;
      const cx = hub.x;
      const cy = hub.y;

      // Boot: rings expand outward from the clock one after another, the inner ones
      // leading, each fading up and unrolling its segments as it grows.
      rings.forEach((ring, i) => {
        const grow = easeOut(Math.min(1, Math.max(0, boot * 2.1 - i * 0.16)));
        if (grow <= 0) return;
        const rotation = t * ring.speed;
        const radius = ring.radius * grow;
        ctx.globalAlpha = grow;

        // Faint full track
        ctx.strokeStyle = `rgba(${colors.rgb}, 0.07)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.stroke();

        // One ring carries graduation ticks: a wide stroke dashed so finely that
        // only short radial marks are left, all drawn in a single call.
        if (ring.ticked) {
          ctx.strokeStyle = `rgba(${colors.rgb}, 0.2)`;
          ctx.lineWidth = 7;
          ctx.setLineDash([1.5, (radius * TAU) / 90 - 1.5]);
          ctx.beginPath();
          ctx.arc(cx, cy, radius, rotation, rotation + TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Bright rotating segments
        ctx.strokeStyle = `rgba(${colors.rgb}, 0.38)`;
        ctx.lineWidth = 1.5;
        ring.arcs.forEach((arc) => {
          const start = arc.start + rotation;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, start, start + arc.length * grow);
          ctx.stroke();
        });
      });

      // The beam, contacts and satellites switch on once the rings are mostly out
      const live = Math.min(1, Math.max(0, (boot - 0.6) / 0.4));
      ctx.globalAlpha = live;
      if (live <= 0) {
        ctx.globalAlpha = 1;
        return;
      }

      // Radar beam: a leading line with a fan of fainter ones trailing behind it
      const sweep = (t * ORBIT_SWEEP_SPEED) % TAU;
      const beamInner = rings[0].radius * 0.55;
      const beamOuter = rings[4].radius;
      ctx.lineWidth = 1;
      for (let k = 0; k < ORBIT_SWEEP_LINES; k++) {
        const angle = sweep - k * 0.03;
        const fade = 1 - k / ORBIT_SWEEP_LINES;
        ctx.strokeStyle = `rgba(${colors.rgb}, ${0.32 * fade * fade})`;
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * beamInner,
          cy + Math.sin(angle) * beamInner,
        );
        ctx.lineTo(
          cx + Math.cos(angle) * beamOuter,
          cy + Math.sin(angle) * beamOuter,
        );
        ctx.stroke();
      }

      // Contacts flare as the beam (or a click ripple) crosses them, then fade out
      // and move somewhere new for the next pass.
      blips.forEach((blip) => {
        const bx = cx + Math.cos(blip.angle) * blip.dist;
        const by = cy + Math.sin(blip.angle) * blip.dist;

        const beamPast = (sweep - blip.angle + TAU) % TAU;
        if (beamPast < 0.06 && t - blip.litAt > 1) blip.litAt = t;
        for (const pulse of pulses) {
          const d = Math.hypot(bx - pulse.x, by - pulse.y);
          if (Math.abs(d - pulse.radius) < 12) blip.litAt = t;
        }

        const age = t - blip.litAt;
        if (age >= ORBIT_BLIP_FADE) {
          if (blip.litAt > 0) Object.assign(blip, spawnBlip());
          return;
        }

        const glow = 1 - age / ORBIT_BLIP_FADE;
        ctx.fillStyle = `rgba(${colors.rgb}, ${glow * 0.9})`;
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(${colors.rgb}, ${glow * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 4 + age * 9, 0, TAU);
        ctx.stroke();
      });

      // Satellites, each dragging a short arc of trail along its ring
      const positions = satellites.map((sat) => {
        const angle = sat.angle + t * sat.speed;
        const trailLength = 46 / sat.radius;
        ctx.strokeStyle = `rgba(${colors.rgb}, 0.3)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (sat.speed > 0) {
          ctx.arc(cx, cy, sat.radius, angle - trailLength, angle);
        } else {
          ctx.arc(cx, cy, sat.radius, angle, angle + trailLength);
        }
        ctx.stroke();

        const x = cx + Math.cos(angle) * sat.radius;
        const y = cy + Math.sin(angle) * sat.radius;
        ctx.fillStyle = `rgba(${colors.rgb}, 0.16)`;
        ctx.beginPath();
        ctx.arc(x, y, sat.size * 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.arc(x, y, sat.size, 0, TAU);
        ctx.fill();
        return { x, y };
      });

      // Link satellites that drift close to each other, and to the cursor
      ctx.lineWidth = 1;
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i];
        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 150) {
            ctx.strokeStyle = `rgba(${colors.rgb}, ${(1 - d / 150) * 0.14})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        if (mouse.active) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 180) {
            ctx.strokeStyle = `rgba(${colors.rgb}, ${(1 - d / 180) * 0.3})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const draw = (now: number) => {
      const w = viewW;
      const h = viewH;
      ctx.clearRect(0, 0, w, h);

      // Circuit-board lines for the "grid" variant, drawn bright enough that the
      // board reads as alive even before anything moves.
      if (bgType === "grid") {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x < w; x += GRID_SPACING) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y < h; y += GRID_SPACING) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Concentric radial coordinate scanlines
        ctx.strokeStyle = `rgba(${colors.rgb}, 0.05)`;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.45, 0, TAU);
        ctx.stroke();
      }

      // Draw active background pulse expanders
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.radius += pulse.speed;
        pulse.alpha = Math.max(0, 1 - pulse.radius / pulse.maxRadius);

        ctx.strokeStyle = `rgba(${colors.rgb}, ${pulse.alpha * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${colors.rgb}, ${pulse.alpha * 0.12})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, TAU);
        ctx.stroke();

        if (pulse.alpha <= 0 || pulse.radius >= pulse.maxRadius) {
          pulses.splice(i, 1);
        }
      }

      if (bgType === "orbit") {
        drawOrbit(now / 1000, canvasBootProgress(now));
      }

      // Drifting stars
      if (bgType === "starfield") {
        particles.forEach((p) => {
          p.y += p.vy;
          if (p.y < 0) {
            p.y = h;
            p.x = Math.random() * w;
          }

          // Sway slightly side to side
          p.x += Math.sin(Date.now() / 1500 + p.vx * 10) * 0.1;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, TAU);
          ctx.fill();
        });
      }

      // Circuit-board data runners + their glowing intersection nodes (grid variant only)
      if (bgType === "grid") {
        // Advance and draw each runner as a bright head with a short fading trail,
        // hard-turning at intersections so the motion reads as routed circuit traffic.
        for (let i = runners.length - 1; i >= 0; i--) {
          const r = runners[i];
          const prevCoord = r.axis === "x" ? r.x : r.y;
          if (r.axis === "x") r.x += r.speed * r.dir;
          else r.y += r.speed * r.dir;
          const newCoord = r.axis === "x" ? r.x : r.y;

          // Crossing a grid line: snap onto it exactly, then maybe turn 90°
          if (
            Math.floor(prevCoord / GRID_SPACING) !==
            Math.floor(newCoord / GRID_SPACING)
          ) {
            if (r.axis === "x")
              r.x = Math.round(r.x / GRID_SPACING) * GRID_SPACING;
            else r.y = Math.round(r.y / GRID_SPACING) * GRID_SPACING;

            if (Math.random() < 0.4) {
              r.axis = r.axis === "x" ? "y" : "x";
              r.dir = Math.random() < 0.5 ? 1 : -1;
            }
          }

          const outOfBounds =
            r.x < -20 || r.x > w + 20 || r.y < -20 || r.y > h + 20;
          if (outOfBounds) {
            if (r.temporary) {
              runners.splice(i, 1);
              continue;
            }
            Object.assign(r, spawnAmbientRunner(w, h));
          }

          const trailX = r.axis === "x" ? -r.dir * 24 : 0;
          const trailY = r.axis === "y" ? -r.dir * 24 : 0;
          const trailGradient = ctx.createLinearGradient(
            r.x,
            r.y,
            r.x + trailX,
            r.y + trailY,
          );
          trailGradient.addColorStop(0, `rgba(${colors.rgb}, 0.85)`);
          trailGradient.addColorStop(1, `rgba(${colors.rgb}, 0)`);
          ctx.strokeStyle = trailGradient;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + trailX, r.y + trailY);
          ctx.stroke();

          ctx.fillStyle = `rgba(${colors.rgb}, 0.25)`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 5, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(r.x, r.y, 1.6, 0, TAU);
          ctx.fill();
        }

        // Intersection nodes carry a lively baseline glow and brighten further near the
        // cursor, a passing runner, or a click ripple — busy circuit traffic, not dormant.
        particles.forEach((p) => {
          let alpha = 0.16;

          if (mouseRef.current.active) {
            const d = Math.hypot(
              p.x - mouseRef.current.x,
              p.y - mouseRef.current.y,
            );
            if (d < 160) alpha += (1 - d / 160) * 0.4;
          }

          for (const r of runners) {
            const d = Math.hypot(p.x - r.x, p.y - r.y);
            if (d < 40) alpha += (1 - d / 40) * 0.65;
          }

          for (const pulse of pulses) {
            const d = Math.hypot(p.x - pulse.x, p.y - pulse.y);
            if (Math.abs(d - pulse.radius) < 20) alpha += 0.5 * pulse.alpha;
          }

          alpha = Math.min(alpha, 1);
          ctx.fillStyle = `rgba(${colors.rgb}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + alpha * 2.4, 0, TAU);
          ctx.fill();
        });
      }

      // Live Grid Particle HTML Node-block connects
      if (tileRescanNeeded) {
        tileRescanNeeded = false;
        cachedNodeCenters = [];
        const tiles = document.querySelectorAll(".bookmark-tile-node");
        const canvasRect = canvas.getBoundingClientRect();
        tiles.forEach((tile) => {
          const rect = tile.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const cx = rect.left + rect.width / 2 - canvasRect.left;
            const cy = rect.top + rect.height / 2 - canvasRect.top;
            cachedNodeCenters.push({ x: cx, y: cy });
          }
        });

        // The orbit rings are centred on the clock, wherever the layout puts it
        const clock = document.getElementById("clock-shield");
        if (clock) {
          const rect = clock.getBoundingClientRect();
          hubHome = {
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top,
          };
        }
      }

      const activeColorRGB = colors.rgb;

      cachedNodeCenters.forEach((node) => {
        if (mouseRef.current.active) {
          const mdx = node.x - mouseRef.current.x;
          const mdy = node.y - mouseRef.current.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 220) {
            const alpha = (1 - mdist / 220) * 0.18;

            // Draw a high-tech dotted pointer connector link line
            ctx.strokeStyle = `rgba(${activeColorRGB}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.stroke();
            ctx.setLineDash([]); // Reset

            // Draw tactile indicator points on the grid canvas
            ctx.fillStyle = colors.primary;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 2.5, 0, TAU);
            ctx.fill();

            // Neon pulse ring
            ctx.strokeStyle = `rgba(${activeColorRGB}, ${alpha * 0.45})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(
              node.x,
              node.y,
              6 + Math.sin(Date.now() / 150) * 1.5,
              0,
              TAU,
            );
            ctx.stroke();
          }
        }
      });

      // Cursor comet trail — drifting sparks that fade out, drawn above the
      // background layers so the pointer always reads as the brightest thing on screen.
      for (let i = trail.length - 1; i >= 0; i--) {
        const s = trail[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.94;
        s.vy *= 0.94;
        s.life -= 0.026;

        if (s.life <= 0) {
          trail.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(${colors.rgb}, ${s.life * 0.5})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * s.life * 2.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${s.life * 0.85})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * s.life, 0, TAU);
        ctx.fill();
      }

      // Soft glow anchored to the cursor itself
      if (mouseRef.current.active) {
        const glow = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          90,
        );
        glow.addColorStop(0, `rgba(${colors.rgb}, 0.13)`);
        glow.addColorStop(1, `rgba(${colors.rgb}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 90, 0, TAU);
        ctx.fill();
      }

      // Floating data center monitor overlay text
      ctx.fillStyle = "rgba(255, 255, 255, 0.022)";
      ctx.font = '10px "JetBrains Mono Variable", monospace';
      ctx.fillText("[SYSTEM_ROOT_NODE: OK]", 20, h - 35);
      ctx.fillText(
        `[GRID_DIM: ${Math.round(w)}x${Math.round(h)}px]`,
        20,
        h - 20,
      );

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container) {
        resizeObserver.unobserve(container);
      }
      resizeObserver.disconnect();
      layoutMutationObserver.disconnect();
      window.removeEventListener("mousemove", handleWindowPointerMove);
      document.removeEventListener("mouseleave", handleWindowPointerLeave);
      if (tileRescanTimer) clearTimeout(tileRescanTimer);
      clearTimeout(settleRescanTimer);
    };
  }, [bgType, colorTheme]);

  // Fires a ripple (and, on the grid variant, a four-way circuit surge) at a point given
  // in viewport coordinates. Shared by direct canvas clicks and by pulses requested from
  // elsewhere in the UI, e.g. a bookmark tile being activated.
  const spawnPulseAtClientPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      pulsesRef.current.push({
        x,
        y,
        radius: 0,
        maxRadius: 240,
        speed: 4,
        alpha: 1,
      });

      if (bgType !== "grid") return;

      const originX = Math.round(x / GRID_SPACING) * GRID_SPACING;
      const originY = Math.round(y / GRID_SPACING) * GRID_SPACING;
      const burst: CircuitRunner[] = (["x", "y"] as const).flatMap((axis) =>
        ([1, -1] as const).map((dir) => ({
          x: originX,
          y: originY,
          axis,
          dir,
          speed: 3.6,
          temporary: true,
        })),
      );

      // Cap total runners so rapid clicking can't grow the array unbounded — drop the
      // oldest temporary bursts first, leaving the ambient pool untouched.
      const pool = runnersRef.current;
      while (pool.length + burst.length > 60) {
        const oldestTemporaryIdx = pool.findIndex((r) => r.temporary);
        if (oldestTemporaryIdx === -1) break;
        pool.splice(oldestTemporaryIdx, 1);
      }
      pool.push(...burst);
    },
    [bgType],
  );

  useEffect(
    () =>
      onPulse(({ clientX, clientY }) =>
        spawnPulseAtClientPoint(clientX, clientY),
      ),
    [spawnPulseAtClientPoint],
  );

  const handleCanvasClick = (e: React.MouseEvent) => {
    spawnPulseAtClientPoint(e.clientX, e.clientY);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full -z-20 overflow-hidden pointer-events-auto bg-[#050506] select-none"
      onClick={handleCanvasClick}
      id="canvas-network-wrapper"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block boot-fade"
        id="cyber-network-canvas"
      />
    </div>
  );
}
