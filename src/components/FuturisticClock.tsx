/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Globe, Wifi, Cpu } from "lucide-react";
import { UserSettings } from "../types";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";

interface FuturisticClockProps {
  settings: UserSettings;
  addLog: (
    module: "SYS" | "NET" | "IO" | "EXT",
    type: "info" | "success" | "warning" | "packet",
    message: string,
  ) => void;
}

// Where the current time falls in the configured work shift.
interface ShiftProgress {
  pct: number; // 0-100
  text: string;
}

interface ClockColors {
  text: string;
  glow: string;
  border: string;
  bgGlow: string;
  accentBg: string;
  accentText: string;
}

// Shared per-face inputs — every clock style renders from the same live values,
// so switching styles never loses or resets telemetry state.
interface ClockFaceProps {
  settings: UserSettings;
  time: Date;
  colors: ClockColors;
  formattedHours: string;
  formattedMins: string;
  formattedSecs: string;
  period: string;
  formatFullDate: () => string;
  shift: ShiftProgress | null;
  binaryColumns: string[][];
  displayTx: number;
  displayRx: number;
}

// The original dense, data-heavy face: date banner, big digits, telemetry footer,
// and an optional binary-matrix readout underneath.
function CyberFace({
  settings,
  colors,
  formattedHours,
  formattedMins,
  formattedSecs,
  period,
  formatFullDate,
  shift,
  binaryColumns,
  displayTx,
  displayRx,
}: ClockFaceProps) {
  return (
    <div
      className={`relative w-full py-4 sm:py-5 px-6 sm:px-8 rounded-2xl border ${colors.border} bg-neutral-900/20 backdrop-blur-sm shadow-2xl flex flex-col items-center justify-center overflow-hidden z-10`}
      id="clock-shield"
    >
      {/* Futuristic layout grids inside clock */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent" />
      <div className="absolute left-3 top-3 h-4 w-4 border-t-2 border-l-2 border-neutral-700/60" />
      <div className="absolute right-3 top-3 h-4 w-4 border-t-2 border-r-2 border-neutral-700/60" />
      <div className="absolute left-3 bottom-3 h-4 w-4 border-b-2 border-l-2 border-neutral-700/60" />
      <div className="absolute right-3 bottom-3 h-4 w-4 border-b-2 border-r-2 border-neutral-700/60" />

      {/* Dynamic Scanline background gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${colors.bgGlow} to-transparent pointer-events-none opacity-30`}
      />

      {/* Date visual header */}
      <div className="text-xs sm:text-sm font-mono tracking-[0.3em] text-neutral-300 font-medium mb-2 z-10 flex flex-col items-center gap-1.5 animate-pulse">
        <div className="flex items-center gap-2">
          {formatFullDate()}
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.accentBg} opacity-75`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${colors.accentBg}`}
            ></span>
          </span>
        </div>

        {/* Dash signal bar from Elegant Dark design */}
        <div className="flex gap-1.5 items-center mt-1">
          <div
            className={`h-1 w-8 opacity-30 rounded-full ${colors.accentBg}`}
          ></div>
          <div
            className={`h-1 w-20 opacity-60 rounded-full ${colors.accentBg}`}
          ></div>
          <div
            className={`h-1 w-4 opacity-10 rounded-full ${colors.accentBg}`}
          ></div>
        </div>
      </div>

      {/* The Digital Clock Face */}
      <div
        className="flex items-baseline font-mono z-10 select-none pb-1 relative"
        id="clock-timestamp-readout"
      >
        <span
          className={`text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
        >
          {formattedHours}
        </span>

        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className={`text-5xl sm:text-6xl md:text-7xl font-light text-neutral-400 mx-1.5 pb-1`}
        >
          :
        </motion.span>

        <span
          className={`text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
        >
          {formattedMins}
        </span>

        {settings.showSeconds && (
          <>
            <span className="text-3xl sm:text-4xl font-light text-neutral-500 mx-1">
              :
            </span>
            <span
              className={`text-3xl sm:text-4xl font-normal text-neutral-300 font-mono w-[1.25em] inline-block`}
            >
              {formattedSecs}
            </span>
          </>
        )}

        {!settings.timeFormat24h && (
          <span className="text-[10px] sm:text-xs font-bold tracking-widest text-neutral-400 ml-3 uppercase border border-neutral-800 px-1 py-0.5 rounded bg-neutral-950/50">
            {period}
          </span>
        )}
      </div>

      {/* Binary Clock Matrix or Hex Clock Overlay based on configs */}
      <div className="mt-2.5 w-full border-t border-neutral-800/60 pt-2 flex items-center justify-between z-10">
        {/* Shift progress / status representation */}
        <div className="flex flex-col items-start font-mono text-[10px] tracking-wider text-neutral-400">
          {settings.showWorkProgress ? (
            <div className="flex flex-col items-start">
              <span className="text-neutral-500 font-bold">SHIFT PROGRESS</span>
              <span
                className={`${colors.text} font-bold font-mono text-xs sm:text-sm mt-0.5 animate-pulse`}
              >
                {shift?.text}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-start">
              <span className="text-neutral-500 font-bold">SYSTEM STATUS</span>
              <span className="text-neutral-300 font-mono text-xs mt-0.5">
                ESTABLISHED SECURE LINK
              </span>
            </div>
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
            TX: {displayTx} | RX: {displayRx}
          </span>
        </div>
      </div>

      {/* Embedded Floating Binary Matrix if user requested High Tech vibes */}
      {settings.showHexClock && (
        <div
          className="mt-4 flex space-x-2.5 justify-center z-10"
          id="binary-matrix"
        >
          {binaryColumns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col space-y-1">
              {col.map((bit, bitIdx) => (
                <div
                  key={bitIdx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    bit === "1"
                      ? `${colors.accentBg} shadow-[0_0_6px_var(--color-theme)] scale-110`
                      : "bg-neutral-800 border border-neutral-700/20"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Circumference of the analog dial's rim circle (r = 94 in its 200x200 viewBox).
const RIM_CIRCUMFERENCE = 2 * Math.PI * 94;

// Compact work-shift tracker for the faces that have no telemetry footer to put it in.
function ShiftReadout({
  shift,
  colors,
}: {
  shift: ShiftProgress;
  colors: ClockColors;
}) {
  return (
    <div className="mt-3 flex flex-col items-center gap-1.5 font-mono z-10">
      <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-500">
        Shift{" "}
        <span className={`${colors.text} font-bold tracking-wider`}>
          {shift.text}
        </span>
      </div>
      <div className="h-0.5 w-40 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.accentBg} transition-[width] duration-700`}
          style={{ width: `${shift.pct}%` }}
        />
      </div>
    </div>
  );
}

// A stripped-down face for anyone who wants the time without the telemetry noise:
// just the digits, the date, and a thin accent divider.
function MinimalFace({
  settings,
  colors,
  formattedHours,
  formattedMins,
  formattedSecs,
  period,
  formatFullDate,
  shift,
}: ClockFaceProps) {
  return (
    <div
      className={`relative w-full py-8 sm:py-10 px-6 rounded-2xl border ${colors.border} bg-neutral-900/20 backdrop-blur-sm shadow-2xl flex flex-col items-center justify-center overflow-hidden z-10`}
      id="clock-shield"
    >
      <div
        className="flex items-baseline font-mono z-10 select-none"
        id="clock-timestamp-readout"
      >
        <span className="text-6xl sm:text-7xl md:text-8xl font-light tracking-tight text-white">
          {formattedHours}
        </span>
        <span className="text-6xl sm:text-7xl md:text-8xl font-thin text-neutral-500 mx-2">
          :
        </span>
        <span className="text-6xl sm:text-7xl md:text-8xl font-light tracking-tight text-white">
          {formattedMins}
        </span>
        {settings.showSeconds && (
          <span className="text-2xl sm:text-3xl font-light text-neutral-500 ml-3 w-[1.25em] inline-block">
            {formattedSecs}
          </span>
        )}
        {!settings.timeFormat24h && (
          <span className="text-xs font-medium tracking-widest text-neutral-500 ml-4 uppercase">
            {period}
          </span>
        )}
      </div>

      <div
        className={`h-px w-16 my-3 ${colors.accentBg} opacity-50 rounded-full`}
      />

      <span className="text-[11px] sm:text-xs font-mono tracking-[0.35em] text-neutral-500 uppercase">
        {formatFullDate()}
      </span>

      {shift && <ShiftReadout shift={shift} colors={colors} />}
    </div>
  );
}

// A literal analog face — SVG hands driven by the same `time` value everything
// else reads from, so it never drifts out of sync with the digital styles.
function AnalogFace({
  settings,
  time,
  colors,
  formatFullDate,
  shift,
}: ClockFaceProps) {
  const hours = time.getHours() % 12;
  const mins = time.getMinutes();
  const secs = time.getSeconds();

  const hourDeg = hours * 30 + mins * 0.5;
  const minDeg = mins * 6 + secs * 0.1;
  const secDeg = secs * 6;

  const accentHex =
    {
      "text-emerald-400": "#34d399",
      "text-cyan-400": "#22d3ee",
      "text-amber-400": "#fbbf24",
      "text-purple-400": "#c084fc",
      "text-rose-400": "#fb7185",
    }[colors.text] ?? "#34d399";

  const tickMarks = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      className={`relative w-full py-6 sm:py-7 px-6 rounded-2xl border ${colors.border} bg-neutral-900/20 backdrop-blur-sm shadow-2xl flex flex-col items-center justify-center overflow-hidden z-10`}
      id="clock-shield"
    >
      <svg
        viewBox="0 0 200 200"
        className="w-40 h-40 sm:w-48 sm:h-48 select-none"
        role="img"
        aria-label={`Analog clock reading ${time.toLocaleTimeString()}`}
      >
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2"
        />
        {/* Shift progress traced clockwise around the rim from 12 o'clock */}
        {shift && (
          <circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            stroke={accentHex}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(shift.pct / 100) * RIM_CIRCUMFERENCE} ${RIM_CIRCUMFERENCE}`}
            transform="rotate(-90 100 100)"
            opacity={shift.pct > 0 ? 0.85 : 0}
          />
        )}
        {tickMarks.map((i) => {
          const angle = i * 30;
          const isMajor = i % 3 === 0;
          return (
            <line
              key={i}
              x1="100"
              y1={isMajor ? 12 : 16}
              x2="100"
              y2="22"
              stroke={isMajor ? "#e5e5e5" : "rgba(255,255,255,0.3)"}
              strokeWidth={isMajor ? 2.5 : 1.5}
              transform={`rotate(${angle} 100 100)`}
            />
          );
        })}

        {/* Hour hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="58"
          stroke="#ffffff"
          strokeWidth="5"
          strokeLinecap="round"
          transform={`rotate(${hourDeg} 100 100)`}
        />
        {/* Minute hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="34"
          stroke="#e5e5e5"
          strokeWidth="3.5"
          strokeLinecap="round"
          transform={`rotate(${minDeg} 100 100)`}
        />
        {/* Second hand */}
        {settings.showSeconds && (
          <line
            x1="100"
            y1="112"
            x2="100"
            y2="26"
            stroke={accentHex}
            strokeWidth="1.5"
            strokeLinecap="round"
            transform={`rotate(${secDeg} 100 100)`}
          />
        )}
        <circle cx="100" cy="100" r="4.5" fill={accentHex} />
      </svg>

      <span className="mt-3 text-[11px] sm:text-xs font-mono tracking-[0.35em] text-neutral-500 uppercase z-10">
        {formatFullDate()}
      </span>

      {shift && <ShiftReadout shift={shift} colors={colors} />}
    </div>
  );
}

export default function FuturisticClock({
  settings,
  addLog,
}: FuturisticClockProps) {
  const [time, setTime] = useState(new Date());
  const [pingSim, setPingSim] = useState(12);
  const [packetTx, setPacketTx] = useState(1402);
  const [packetRx, setPacketRx] = useState(3894);
  const [cpuUsageSim, setCpuUsageSim] = useState(18);

  // Keep the latest settings/addLog available to the interval below without needing
  // to recreate the interval itself every tick (which previously reset every 250ms).
  const settingsRef = useRef(settings);
  const addLogRef = useRef(addLog);
  useEffect(() => {
    settingsRef.current = settings;
    addLogRef.current = addLog;
  }, [settings, addLog]);

  // Tracks the last second we fired telemetry for, so the check below doesn't need to
  // read the previous `time` state — doing that via setTime's updater fired other
  // components' setState calls (addLog -> App's setLogs) mid-render, which React flags
  // as invalid and can cause a render pass to be discarded.
  const lastTelemetrySecondRef = useRef(-1);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextTime = new Date();
      setTime(nextTime);

      const nextSeconds = nextTime.getSeconds();
      if (
        nextSeconds !== lastTelemetrySecondRef.current &&
        nextSeconds % 15 === 0
      ) {
        lastTelemetrySecondRef.current = nextSeconds;

        const rndPing = Math.floor(Math.random() * 8) + 8;
        setPingSim(rndPing);
        setCpuUsageSim(Math.floor(Math.random() * 15) + 10);
        setPacketTx((prev) => prev + Math.floor(Math.random() * 5) + 1);
        setPacketRx((prev) => prev + Math.floor(Math.random() * 12) + 2);

        if (settingsRef.current.techPingDelaySim) {
          addLogRef.current(
            "NET",
            "packet",
            `ICMP Echo Request: seq=${nextSeconds} size=64 bytes rtt=${rndPing}ms`,
          );
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, []);

  // Telemetry readouts ease toward each new simulated value rather than jumping.
  const displayPing = useAnimatedNumber(pingSim);
  const displayCpu = useAnimatedNumber(cpuUsageSim);
  const displayTx = useAnimatedNumber(packetTx);
  const displayRx = useAnimatedNumber(packetRx);

  // Format main clock numbers
  const hours = time.getHours();
  const rawMins = time.getMinutes();
  const rawSecs = time.getSeconds();

  const formattedHours = settings.timeFormat24h
    ? hours.toString().padStart(2, "0")
    : (hours % 12 || 12).toString().padStart(2, "0");

  const formattedMins = rawMins.toString().padStart(2, "0");
  const formattedSecs = rawSecs.toString().padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";

  // Generate binary clock grid (6 columns: 2 for hours, 2 for mins, 2 for secs)
  const toBinaryDigits = (val: number): string[][] => {
    const tens = Math.floor(val / 10);
    const units = val % 10;
    // Tens binary array (4-bit representation), reversed for bottom-up layouts
    const tensBinary = tens.toString(2).padStart(4, "0").split("");
    const unitsBinary = units.toString(2).padStart(4, "0").split("");
    return [tensBinary, unitsBinary];
  };

  const hrBinary = toBinaryDigits(hours);
  const minBinary = toBinaryDigits(rawMins);
  const secBinary = toBinaryDigits(rawSecs);
  const binaryColumns = [...hrBinary, ...minBinary, ...secBinary];

  // Helper string mapping of Month Names
  const formatFullDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return time.toLocaleDateString("en-US", options).toUpperCase();
  };

  const getShiftProgress = (): ShiftProgress | null => {
    if (
      !settings.showWorkProgress ||
      !settings.workStart ||
      !settings.workEnd
    ) {
      return null;
    }

    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const parts = timeStr.split(":");
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return h * 60 + m;
      };

      const startMin = parseTimeToMinutes(settings.workStart);
      const endMin = parseTimeToMinutes(settings.workEnd);
      const currentMin = time.getHours() * 60 + time.getMinutes();

      if (Number.isNaN(startMin) || Number.isNaN(endMin)) return null;

      if (currentMin < startMin) {
        return { pct: 0, text: `0% (Starts at ${settings.workStart})` };
      }
      if (currentMin >= endMin) {
        return { pct: 100, text: "100% (Shift Ended)" };
      }

      const totalShift = endMin - startMin;
      if (totalShift <= 0) return { pct: 0, text: "0%" };

      const elapsed = currentMin - startMin;
      const pct = (elapsed / totalShift) * 100;
      return { pct, text: `${(Math.round(pct * 10) / 10).toFixed(1)}% Active` };
    } catch {
      return null;
    }
  };

  // Theme color styling mappings
  const getColorClasses = (): ClockColors => {
    switch (settings.themeId) {
      case "emerald":
        return {
          text: "text-emerald-400",
          glow: "shadow-emerald-500/10",
          border: "border-emerald-500/20",
          bgGlow: "from-emerald-500/5",
          accentBg: "bg-emerald-500",
          accentText: "text-emerald-300",
        };
      case "cyan":
        return {
          text: "text-cyan-400",
          glow: "shadow-cyan-500/10",
          border: "border-cyan-500/20",
          bgGlow: "from-cyan-500/5",
          accentBg: "bg-cyan-500",
          accentText: "text-cyan-300",
        };
      case "amber":
        return {
          text: "text-amber-400",
          glow: "shadow-amber-500/10",
          border: "border-amber-500/20",
          bgGlow: "from-amber-500/5",
          accentBg: "bg-amber-500",
          accentText: "text-amber-300",
        };
      case "purple":
        return {
          text: "text-purple-400",
          glow: "shadow-purple-500/10",
          border: "border-purple-500/20",
          bgGlow: "from-purple-500/5",
          accentBg: "bg-purple-500",
          accentText: "text-purple-300",
        };
      case "rose":
        return {
          text: "text-rose-400",
          glow: "shadow-rose-500/10",
          border: "border-rose-500/20",
          bgGlow: "from-rose-500/5",
          accentBg: "bg-rose-500",
          accentText: "text-rose-300",
        };
      default:
        return {
          text: "text-emerald-400",
          glow: "shadow-emerald-500/10",
          border: "border-emerald-500/20",
          bgGlow: "from-emerald-500/5",
          accentBg: "bg-emerald-500",
          accentText: "text-emerald-300",
        };
    }
  };

  const colors = getColorClasses();

  const getThemeBorderColor = () => {
    switch (settings.themeId) {
      case "emerald":
        return "border-emerald-500/50";
      case "cyan":
        return "border-cyan-500/50";
      case "amber":
        return "border-amber-500/50";
      case "purple":
        return "border-purple-500/50";
      case "rose":
        return "border-rose-500/50";
      default:
        return "border-cyan-500/50";
    }
  };

  const themeCornerBorder = getThemeBorderColor();

  const faceProps: ClockFaceProps = {
    settings,
    time,
    colors,
    formattedHours,
    formattedMins,
    formattedSecs,
    period,
    formatFullDate,
    shift: getShiftProgress(),
    binaryColumns,
    displayTx,
    displayRx,
  };

  return (
    <div
      className="flex flex-col items-center select-none max-w-4xl w-full relative group mt-2 px-4"
      id="root-futuristic-clock-container"
    >
      {/* Decorative Outer Tech Frames from Elegant Dark guidelines */}
      <div className="absolute -inset-2 border border-neutral-800/20 rounded-xl pointer-events-none -z-10"></div>
      <div
        className={`absolute -top-2 -left-2 w-10 h-10 border-t-2 border-l-2 ${themeCornerBorder} pointer-events-none -z-10`}
      ></div>
      <div
        className={`absolute -bottom-2 -right-2 w-10 h-10 border-b-2 border-r-2 ${themeCornerBorder} pointer-events-none -z-10`}
      ></div>

      {/* Top micro coordinates strip */}
      <div
        className="flex items-center space-x-5 text-xs font-mono text-neutral-400 tracking-wider mb-2 z-10"
        id="micro-coord-strip"
      >
        <span className="flex items-center gap-1.5 font-semibold">
          <Globe className="w-3.5 h-3.5 text-neutral-500 animate-pulse" />
          UTC {(time.getTimezoneOffset() / 60) * -1 > 0 ? "+" : ""}
          {(time.getTimezoneOffset() / 60) * -1}H
        </span>
        <span className="text-neutral-800">|</span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-neutral-500" />
          CPU {displayCpu}%
        </span>
        <span className="text-neutral-800">|</span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Wifi className="w-3.5 h-3.5 text-neutral-300" />
          {displayPing}ms
        </span>
      </div>

      {/* Actual Digital Clock Backdrop segment (88:88:88 tracing overlay) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] select-none pointer-events-none z-0 overflow-hidden">
        <div className="text-[140px] font-black tracking-tighter select-none font-mono">
          88:88:88
        </div>
      </div>

      {settings.clockStyle === "minimal" ? (
        <MinimalFace {...faceProps} />
      ) : settings.clockStyle === "analog" ? (
        <AnalogFace {...faceProps} />
      ) : (
        <CyberFace {...faceProps} />
      )}
    </div>
  );
}
