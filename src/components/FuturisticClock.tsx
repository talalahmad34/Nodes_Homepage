/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Globe, Wifi, Cpu, ShieldCheck } from 'lucide-react';
import { UserSettings, SystemLog } from '../types';

interface FuturisticClockProps {
  settings: UserSettings;
  addLog: (module: 'SYS' | 'NET' | 'IO' | 'EXT', type: 'info' | 'success' | 'warning' | 'packet', message: string) => void;
}

export default function FuturisticClock({ settings, addLog }: FuturisticClockProps) {
  const [time, setTime] = useState(new Date());
  const [pingSim, setPingSim] = useState(12);
  const [packetTx, setPacketTx] = useState(1402);
  const [packetRx, setPacketRx] = useState(3894);
  const [cpuUsageSim, setCpuUsageSim] = useState(18);

  useEffect(() => {
    const timer = setInterval(() => {
      const prevSeconds = time.getSeconds();
      const nextTime = new Date();
      setTime(nextTime);

      // Trigger automatic telemetry packets inside logs
      if (nextTime.getSeconds() !== prevSeconds) {
        if (nextTime.getSeconds() % 15 === 0) {
          const rndPing = Math.floor(Math.random() * 8) + 8;
          setPingSim(rndPing);
          setCpuUsageSim(Math.floor(Math.random() * 15) + 10);
          setPacketTx((prev) => prev + Math.floor(Math.random() * 5) + 1);
          setPacketRx((prev) => prev + Math.floor(Math.random() * 12) + 2);

          if (settings.techPingDelaySim) {
            addLog(
              'NET',
              'packet',
              `ICMP Echo Request: seq=${nextTime.getSeconds()} size=64 bytes rtt=${rndPing}ms`
            );
          }
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, [time, settings.techPingDelaySim, addLog]);

  // Format main clock numbers
  const hours = time.getHours();
  const rawMins = time.getMinutes();
  const rawSecs = time.getSeconds();

  const formattedHours = settings.timeFormat24h
    ? hours.toString().padStart(2, '0')
    : (hours % 12 || 12).toString().padStart(2, '0');

  const formattedMins = rawMins.toString().padStart(2, '0');
  const formattedSecs = rawSecs.toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  // Calculate HEX clock (e.g. #082735 representing #HHMMSS)
  const hexHours = hours.toString(16).padStart(2, '0');
  const hexMins = rawMins.toString(16).padStart(2, '0');
  const hexSecs = rawSecs.toString(16).padStart(2, '0');
  const generatedHex = `#${hexHours}${hexMins}${hexSecs}`.toUpperCase();

  // Generate binary clock grid (6 columns: 2 for hours, 2 for mins, 2 for secs)
  const toBinaryDigits = (val: number): string[][] => {
    const tens = Math.floor(val / 10);
    const units = val % 10;
    // Tens binary array (4-bit representation), reversed for bottom-up layouts
    const tensBinary = tens.toString(2).padStart(4, '0').split('');
    const unitsBinary = units.toString(2).padStart(4, '0').split('');
    return [tensBinary, unitsBinary];
  };

  const hrBinary = toBinaryDigits(hours);
  const minBinary = toBinaryDigits(rawMins);
  const secBinary = toBinaryDigits(rawSecs);
  const binaryColumns = [...hrBinary, ...minBinary, ...secBinary];

  // Helper string mapping of Month Names
  const formatFullDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    return time.toLocaleDateString('en-US', options).toUpperCase();
  };

  // Theme color styling mappings
  const getColorClasses = () => {
    switch (settings.themeId) {
      case 'emerald': return { text: 'text-emerald-400', glow: 'shadow-emerald-500/10', border: 'border-emerald-500/20', bgGlow: 'from-emerald-500/5', accentBg: 'bg-emerald-500', accentText: 'text-emerald-300' };
      case 'cyan': return { text: 'text-cyan-400', glow: 'shadow-cyan-500/10', border: 'border-cyan-500/20', bgGlow: 'from-cyan-500/5', accentBg: 'bg-cyan-500', accentText: 'text-cyan-300' };
      case 'amber': return { text: 'text-amber-400', glow: 'shadow-amber-500/10', border: 'border-amber-500/20', bgGlow: 'from-amber-500/5', accentBg: 'bg-amber-500', accentText: 'text-amber-300' };
      case 'purple': return { text: 'text-purple-400', glow: 'shadow-purple-500/10', border: 'border-purple-500/20', bgGlow: 'from-purple-500/5', accentBg: 'bg-purple-500', accentText: 'text-purple-300' };
      case 'rose': return { text: 'text-rose-400', glow: 'shadow-rose-500/10', border: 'border-rose-500/20', bgGlow: 'from-rose-500/5', accentBg: 'bg-rose-500', accentText: 'text-rose-300' };
      default: return { text: 'text-emerald-400', glow: 'shadow-emerald-500/10', border: 'border-emerald-500/20', bgGlow: 'from-emerald-500/5', accentBg: 'bg-emerald-500', accentText: 'text-emerald-300' };
    }
  };

  const colors = getColorClasses();

  const getThemeBorderColor = () => {
    switch (settings.themeId) {
      case 'emerald': return 'border-emerald-500/50';
      case 'cyan': return 'border-cyan-500/50';
      case 'amber': return 'border-amber-500/50';
      case 'purple': return 'border-purple-500/50';
      case 'rose': return 'border-rose-500/50';
      default: return 'border-cyan-500/50';
    }
  };

  const themeCornerBorder = getThemeBorderColor();

  return (
    <div className="flex flex-col items-center select-none max-w-4xl w-full relative group mt-2 px-4" id="root-futuristic-clock-container">
      {/* Decorative Outer Tech Frames from Elegant Dark guidelines */}
      <div className="absolute -inset-2 border border-neutral-800/20 rounded-xl pointer-events-none -z-10"></div>
      <div className={`absolute -top-2 -left-2 w-10 h-10 border-t-2 border-l-2 ${themeCornerBorder} pointer-events-none -z-10`}></div>
      <div className={`absolute -bottom-2 -right-2 w-10 h-10 border-b-2 border-r-2 ${themeCornerBorder} pointer-events-none -z-10`}></div>

      {/* Top micro coordinates strip */}
      <div className="flex items-center space-x-5 text-xs font-mono text-neutral-400 tracking-wider mb-2.5 z-10" id="micro-coord-strip">
        <span className="flex items-center gap-1.5 font-semibold">
          <Globe className="w-3.5 h-3.5 text-neutral-500 animate-pulse" />
          UTC {(time.getTimezoneOffset() / 60) * -1 > 0 ? '+' : ''}{(time.getTimezoneOffset() / 60) * -1}H
        </span>
        <span className="text-neutral-800">|</span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-neutral-500" />
          CPU {cpuUsageSim}%
        </span>
        <span className="text-neutral-800">|</span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Wifi className="w-3.5 h-3.5 text-neutral-300" />
          {pingSim}ms
        </span>
      </div>

      {/* Actual Digital Clock Backdrop segment (88:88:88 tracing overlay) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] select-none pointer-events-none z-0 overflow-hidden">
        <div className="text-[170px] font-black tracking-tighter select-none font-mono">
          88:88:88
        </div>
      </div>

      {/* Main Glass Clock Face */}
      <div 
        className={`relative w-full py-7 px-10 rounded-2xl border ${colors.border} bg-neutral-900/60 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center overflow-hidden z-10`}
        id="clock-shield"
      >
        {/* Futuristic layout grids inside clock */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent" />
        <div className="absolute left-3 top-3 h-4 w-4 border-t-2 border-l-2 border-neutral-700/60" />
        <div className="absolute right-3 top-3 h-4 w-4 border-t-2 border-r-2 border-neutral-700/60" />
        <div className="absolute left-3 bottom-3 h-4 w-4 border-b-2 border-l-2 border-neutral-700/60" />
        <div className="absolute right-3 bottom-3 h-4 w-4 border-b-2 border-r-2 border-neutral-700/60" />

        {/* Dynamic Scanline background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-b ${colors.bgGlow} to-transparent pointer-events-none opacity-30`} />

        {/* Date visual header */}
        <div className="text-sm font-mono tracking-[0.3em] text-neutral-300 font-medium mb-2.5 z-10 flex flex-col items-center gap-1.5 animate-pulse">
          <div className="flex items-center gap-2">
            {formatFullDate()}
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.accentBg} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.accentBg}`}></span>
            </span>
          </div>

          {/* Dash signal bar from Elegant Dark design */}
          <div className="flex gap-1.5 items-center mt-1.5">
            <div className={`h-1 w-8 opacity-30 rounded-full ${colors.accentBg}`}></div>
            <div className={`h-1 w-20 opacity-60 rounded-full ${colors.accentBg}`}></div>
            <div className={`h-1 w-4 opacity-10 rounded-full ${colors.accentBg}`}></div>
          </div>
        </div>

        {/* The Digital Clock Face */}
        <div className="flex items-baseline font-mono z-10 select-none pb-2 relative" id="clock-timestamp-readout">
          <span className={`text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}>
            {formattedHours}
          </span>
          
          <motion.span 
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-6xl sm:text-7xl md:text-8xl font-light text-neutral-400 mx-2 pb-1.5`}
          >
            :
          </motion.span>
          
          <span className={`text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}>
            {formattedMins}
          </span>

          {settings.showSeconds && (
            <>
              <span className="text-4xl sm:text-5xl font-light text-neutral-500 mx-1.5">:</span>
              <span className={`text-4xl sm:text-5xl font-normal text-neutral-300 font-mono w-[1.25em] inline-block`}>
                {formattedSecs}
              </span>
            </>
          )}

          {!settings.timeFormat24h && (
            <span className="text-xs sm:text-sm font-bold tracking-widest text-neutral-400 ml-4 uppercase border border-neutral-800 px-1.5 py-0.5 rounded bg-neutral-950/50">
              {period}
            </span>
          )}
        </div>

        {/* Binary Clock Matrix or Hex Clock Overlay based on configs */}
        <div className="mt-4 w-full border-t border-neutral-800/60 pt-3.5 flex items-center justify-between z-10">
          
          {/* Hex code representation */}
          <div className="flex flex-col items-start font-mono text-[10px] tracking-wider text-neutral-400">
            <span className="text-neutral-500 font-bold">TIME COLOR GRAPH</span>
            {settings.showHexClock ? (
              <span className={`${colors.text} font-bold font-mono text-sm mt-0.5 transition-colors duration-1000`}>
                {generatedHex}
              </span>
            ) : (
              <span className="text-neutral-350 font-bold font-mono text-xs mt-0.5">
                ESTABLISHED SECURE LINK
              </span>
            )}
          </div>

          {/* Core System Identity icon */}
          <div className="flex items-center space-x-1.5 border border-neutral-800/80 px-2.5 py-1 rounded-lg bg-neutral-950/20 text-xs font-mono text-neutral-300 font-bold">
            <Cpu className={`w-4 h-4 ${colors.text} animate-pulse`} />
            <span>LINK-V4 ACTIVE</span>
          </div>

          {/* Minimal simulated packets meter */}
          <div className="flex flex-col items-end font-mono text-[10px] tracking-wider text-neutral-400 font-medium">
            <span className="text-neutral-500 font-bold">TELEMETRY STATS</span>
            <span className="text-neutral-300 font-mono mt-0.5 leading-none">
              TX: {packetTx} | RX: {packetRx}
            </span>
          </div>
        </div>

        {/* Embedded Floating Binary Matrix if user requested High Tech vibes */}
        {settings.showHexClock && (
          <div className="mt-4 flex space-x-2.5 justify-center z-10" id="binary-matrix">
            {binaryColumns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col space-y-1">
                {col.map((bit, bitIdx) => (
                  <div
                    key={bitIdx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      bit === '1'
                        ? `${colors.accentBg} shadow-[0_0_6px_var(--color-theme)] scale-110`
                        : 'bg-neutral-800 border border-neutral-700/20'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
