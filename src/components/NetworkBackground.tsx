/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
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

const GRID_SPACING = 40;

interface NetworkBackgroundProps {
  type?: "network" | "starfield" | "grid";
  colorTheme: string; // Hex or tailwind colors
}

export default function NetworkBackground({
  type = "network",
  colorTheme,
}: NetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Coerce raw type to make sure it is always stable and defaults to network
  const bgType =
    type === "network" || type === "starfield" || type === "grid"
      ? type
      : "network";

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
    // Map theme colors to CSS/Canvas colors
    const getThemeColor = () => {
      switch (colorTheme) {
        case "emerald-400":
          return {
            primary: "#34d399",
            secondary: "#059669",
            opacity: "rgba(52, 211, 153, 0.15)",
            rgb: "52, 211, 153",
          };
        case "cyan-400":
          return {
            primary: "#22d3ee",
            secondary: "#0891b2",
            opacity: "rgba(34, 211, 238, 0.15)",
            rgb: "34, 211, 238",
          };
        case "amber-400":
          return {
            primary: "#fbbf24",
            secondary: "#d97706",
            opacity: "rgba(251, 191, 36, 0.15)",
            rgb: "251, 191, 36",
          };
        case "purple-400":
          return {
            primary: "#c084fc",
            secondary: "#9333ea",
            opacity: "rgba(192, 132, 252, 0.15)",
            rgb: "192, 132, 252",
          };
        case "rose-400":
          return {
            primary: "#fb7185",
            secondary: "#e11d48",
            opacity: "rgba(251, 113, 133, 0.15)",
            rgb: "251, 113, 133",
          };
        default:
          return {
            primary: "#34d399",
            secondary: "#059669",
            opacity: "rgba(52, 211, 153, 0.15)",
            rgb: "52, 211, 153",
          };
      }
    };
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const pulses = pulsesRef.current;
    // Mutated in place (never reassigned) so the click handler outside this effect
    // keeps injecting into the exact array instance the draw loop below is reading.
    const runners = runnersRef.current;
    const trail = trailRef.current;
    let cachedNodeCenters: { x: number; y: number }[] = [];
    const maxParticles =
      bgType === "network" ? 70 : bgType === "grid" ? 100 : 120;
    const connectionDist = 120;
    const AMBIENT_RUNNER_COUNT = 32;

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

    const resizeCanvas = () => {
      if (containerRef.current && canvas) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
        initParticles(width, height);
      }
    };

    const initParticles = (width: number, height: number) => {
      particles = [];
      const colors = getThemeColor();

      if (bgType === "network") {
        for (let i = 0; i < maxParticles; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            radius: Math.random() * 2 + 1.5,
            color: colors.primary,
          });
        }
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
        for (let i = 0; i < maxParticles; i++) {
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
    // positions only when the grid actually changes shape (nodes added/removed/reordered)
    // or the viewport resizes, and rescan the tiles once a short debounce settles.
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

    // Watches the pinned-site grid for nodes being added, removed, or reordered
    // (childList changes only — deliberately ignores style/class mutations so that
    // hover/drag animations elsewhere on the page don't trigger constant rescans).
    const gridContainer =
      document.getElementById("pinned-node-grid-hub") ?? document.body;
    const gridMutationObserver = new MutationObserver(scheduleTileRescan);
    gridMutationObserver.observe(gridContainer, {
      childList: true,
      subtree: true,
    });

    const draw = () => {
      const colors = getThemeColor();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // Draw background cybergrid lines for "network/grid" types — brighter and more
      // present for "grid" so the circuit board reads as alive even before anything moves.
      if (bgType === "grid" || bgType === "network") {
        const lineAlpha = bgType === "grid" ? 0.05 : 0.015;
        ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x < w; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y < h; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Concentric radial coordinate scanlines
        const scanAlpha = bgType === "grid" ? 0.05 : 0.012;
        ctx.strokeStyle = `rgba(${colors.rgb}, ${scanAlpha})`;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw active background pulse expanders
      pulses.forEach((pulse, index) => {
        pulse.radius += pulse.speed;
        pulse.alpha = Math.max(0, 1 - pulse.radius / pulse.maxRadius);

        ctx.strokeStyle = `rgba(${colors.rgb}, ${pulse.alpha * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${colors.rgb}, ${pulse.alpha * 0.12})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (pulse.alpha <= 0 || pulse.radius >= pulse.maxRadius) {
          pulses.splice(index, 1);
        }
      });

      // Node connection math
      if (bgType === "network") {
        const networkColorRGB = colors.rgb;

        // Connect particles within grid
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectionDist) {
              const alpha = (1 - dist / connectionDist) * 0.09;
              ctx.strokeStyle = `rgba(${networkColorRGB}, ${alpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();

              // Occasionally animate packets along connections
              if (Math.random() < 0.00002) {
                ctx.fillStyle = colors.primary;
                ctx.beginPath();
                ctx.arc(
                  (p1.x + p2.x) / 2,
                  (p1.y + p2.y) / 2,
                  2,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            }
          }

          // Connect with cursor
          if (mouseRef.current.active) {
            const mdx = p1.x - mouseRef.current.x;
            const mdy = p1.y - mouseRef.current.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 140) {
              const alpha = (1 - mdist / 140) * 0.18;
              ctx.strokeStyle = `rgba(${networkColorRGB}, ${alpha})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
              ctx.stroke();
            }
          }
        }
      }

      // Draw and update particles
      particles.forEach((p) => {
        // Render depending on mode
        if (bgType === "network") {
          // Normal physics update
          p.x += p.vx;
          p.y += p.vy;

          // Bounce off bounds
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;

          // Push slightly away from mouse
          if (mouseRef.current.active) {
            const dx = p.x - mouseRef.current.x;
            const dy = p.y - mouseRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              const force = (120 - dist) * 0.003;
              p.x += (dx / dist) * force;
              p.y += (dy / dist) * force;
            }
          }

          // Draw node
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          // Outer halo on larger nodes
          if (p.radius > 2.5) {
            ctx.fillStyle = `rgba(${colors.rgb}, 0.15)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (bgType === "starfield") {
          p.y += p.vy;
          if (p.y < 0) {
            p.y = h;
            p.x = Math.random() * w;
          }

          // Sway slightly side to side
          p.x += Math.sin(Date.now() / 1500 + p.vx * 10) * 0.1;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

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
          ctx.arc(r.x, r.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(r.x, r.y, 1.6, 0, Math.PI * 2);
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
          ctx.arc(p.x, p.y, p.radius + alpha * 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Live Grid Particle HTML Node-block connects
      if (tileRescanNeeded || cachedNodeCenters.length === 0) {
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
            ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2);
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
              Math.PI * 2,
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
        ctx.arc(s.x, s.y, s.radius * s.life * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${s.life * 0.85})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * s.life, 0, Math.PI * 2);
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
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating data center monitor overlay text
      ctx.fillStyle = "rgba(255, 255, 255, 0.022)";
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText("[SYSTEM_ROOT_NODE: OK]", 20, h - 35);
      ctx.fillText(`[GRID_DIM: ${w}x${h}px]`, 20, h - 20);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container) {
        resizeObserver.unobserve(container);
      }
      resizeObserver.disconnect();
      gridMutationObserver.disconnect();
      window.removeEventListener("mousemove", handleWindowPointerMove);
      document.removeEventListener("mouseleave", handleWindowPointerLeave);
      if (tileRescanTimer) clearTimeout(tileRescanTimer);
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
        className="w-full h-full block"
        id="cyber-network-canvas"
      />
    </div>
  );
}
