/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  originalX?: number;
  originalY?: number;
  binaryChar?: string;
  birth?: number;
}

interface Pulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
}

interface NetworkBackgroundProps {
  type?: 'network' | 'starfield' | 'grid';
  colorTheme: string; // Hex or tailwind colors
}

export default function NetworkBackground({ type = 'network', colorTheme }: NetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Coerce raw type to make sure it is always stable and defaults to network
  const bgType = (type === 'network' || type === 'starfield' || type === 'grid') ? type : 'network';

  // Store mouse coordinates
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  // Store active wave pulses across clicks and frames
  const pulsesRef = useRef<Pulse[]>([]);

  // Map theme colors to CSS/Canvas colors
  const getThemeColor = () => {
    switch (colorTheme) {
      case 'emerald-400': return { primary: '#34d399', secondary: '#059669', opacity: 'rgba(52, 211, 153, 0.15)' };
      case 'cyan-400': return { primary: '#22d3ee', secondary: '#0891b2', opacity: 'rgba(34, 211, 238, 0.15)' };
      case 'amber-400': return { primary: '#fbbf24', secondary: '#d97706', opacity: 'rgba(251, 191, 36, 0.15)' };
      case 'purple-400': return { primary: '#c084fc', secondary: '#9333ea', opacity: 'rgba(192, 132, 252, 0.15)' };
      case 'rose-400': return { primary: '#fb7185', secondary: '#e11d48', opacity: 'rgba(251, 113, 133, 0.15)' };
      default: return { primary: '#34d399', secondary: '#059669', opacity: 'rgba(52, 211, 153, 0.15)' };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const pulses = pulsesRef.current;
    let frameCount = 0;
    let cachedNodeCenters: { x: number; y: number }[] = [];
    const maxParticles = bgType === 'network' ? 70 : bgType === 'grid' ? 100 : 120;
    const connectionDist = 120;

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

      if (bgType === 'network') {
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
      } else if (bgType === 'grid') {
        // Place particles on responsive intersections of a cyber grid
        const cols = Math.floor(width / 60);
        const rows = Math.floor(height / 60);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.25) { // Spawn rate
              const gridX = c * 60 + 30;
              const gridY = r * 60 + 30;
              particles.push({
                x: gridX,
                y: gridY,
                originalX: gridX,
                originalY: gridY,
                vx: 0,
                vy: 0,
                radius: Math.random() * 1.5 + 0.5,
                color: colors.primary,
                binaryChar: Math.random() > 0.5 ? '1' : '0',
                birth: Date.now() + Math.random() * 5000,
              });
            }
          }
        }
      } else { // Starfield
        for (let i = 0; i < maxParticles; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0,
            vy: - (Math.random() * 0.4 + 0.1), // Float upwards
            radius: Math.random() * 1.8 + 0.3,
            color: Math.random() > 0.3 ? colors.primary : '#ffffff',
          });
        }
      }
    };

    // Initialize observer for resize
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Set initial size
    resizeCanvas();

    const draw = () => {
      const colors = getThemeColor();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // Draw subtle background cybergrid lines for "network/grid" types
      if (bgType === 'grid' || bgType === 'network') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
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
        ctx.strokeStyle = `rgba(${colors.primary === '#34d399' ? '52, 211, 153' : colors.primary === '#22d3ee' ? '34, 211, 238' : '251, 191, 36'}, 0.012)`;
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
        pulse.alpha = Math.max(0, 1 - (pulse.radius / pulse.maxRadius));

        ctx.strokeStyle = `rgba(${colors.primary === '#34d399' ? '52, 211, 153' : colors.primary === '#22d3ee' ? '34, 211, 238' : '251, 191, 36'}, ${pulse.alpha * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${colors.primary === '#34d399' ? '52, 211, 153' : colors.primary === '#22d3ee' ? '34, 211, 238' : '251, 191, 36'}, ${pulse.alpha * 0.05})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (pulse.alpha <= 0 || pulse.radius >= pulse.maxRadius) {
          pulses.splice(index, 1);
        }
      });

      // Node connection math
      if (bgType === 'network') {
        const networkColorRGB = colors.primary === '#34d399' ? '52, 211, 153'
          : colors.primary === '#22d3ee' ? '34, 211, 238'
          : colors.primary === '#fbbf24' ? '251, 191, 36'
          : colors.primary === '#c084fc' ? '192, 132, 252'
          : '251, 113, 133';

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
                ctx.arc((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 2, 0, Math.PI * 2);
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
        if (bgType === 'network') {
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
            ctx.fillStyle = `rgba(${p.color === '#34d399' ? '52, 211, 153' : '34, 211, 238'}, 0.15)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (bgType === 'grid') {
          // Dynamic cyber characters (binary bytes) fading in and out on cyber grid
          const time = Date.now();
          const pBirth = p.birth || 0;
          const cycle = Math.sin((time - pBirth) / 1200); // Oscillation
          const alpha = Math.max(0.01, cycle * 0.12);

          if (p.binaryChar) {
            ctx.fillStyle = `rgba(${colors.primary === '#34d399' ? '52, 211, 153' : colors.primary === '#22d3ee' ? '34, 211, 238' : '251, 191, 36'}, ${alpha})`;
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.binaryChar, p.x, p.y);

            // Change character randomly
            if (Math.random() < 0.01) {
              p.binaryChar = Math.random() > 0.5 ? '1' : '0';
            }
          } else {
            ctx.fillStyle = `rgba(${colors.primary === '#34d399' ? '52, 211, 153' : '34, 211, 238'}, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (bgType === 'starfield') {
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

      // Live Grid Particle HTML Node-block connects
      frameCount++;
      if (frameCount % 15 === 0 || cachedNodeCenters.length === 0) {
        cachedNodeCenters = [];
        const tiles = document.querySelectorAll('.bookmark-tile-node');
        const canvasRect = canvas.getBoundingClientRect();
        tiles.forEach((tile) => {
          const rect = tile.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const cx = (rect.left + rect.width / 2) - canvasRect.left;
            const cy = (rect.top + rect.height / 2) - canvasRect.top;
            cachedNodeCenters.push({ x: cx, y: cy });
          }
        });
      }

      const activeColorRGB = colors.primary === '#34d399' ? '52, 211, 153'
        : colors.primary === '#22d3ee' ? '34, 211, 238'
        : colors.primary === '#fbbf24' ? '251, 191, 36'
        : colors.primary === '#c084fc' ? '192, 132, 252'
        : '251, 113, 133';

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
            ctx.arc(node.x, node.y, 6 + Math.sin(Date.now() / 150) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });

      // Floating data center monitor overlay text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('[SYSTEM_ROOT_NODE: OK]', 20, h - 35);
      ctx.fillText(`[GRID_DIM: ${w}x${h}px]`, 20, h - 20);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [bgType, colorTheme]);

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    }
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Spawn a wave pulse
    pulsesRef.current.push({
      x: clickX,
      y: clickY,
      radius: 0,
      maxRadius: 240,
      speed: 4,
      alpha: 1,
    });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full -z-20 overflow-hidden pointer-events-auto bg-[#050506] select-none"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
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
