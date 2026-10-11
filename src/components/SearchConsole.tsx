/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, Terminal, Sparkles } from "lucide-react";
import { SearchEngine, UserSettings } from "../types";
import {
  BTN_HOVER,
  BTN_TAP,
  BTN_SPRING,
  CARD_HOVER,
  CARD_TAP,
  CARD_SPRING,
} from "../lib/motion";
import { ALL_AI_PORTALS, type AiPortal } from "../lib/aiPortals";
import { emitPulse } from "../lib/pulseBus";
import WarpBurst, { WARP_BURST_MS } from "./WarpBurst";

interface SearchConsoleProps {
  settings: UserSettings;
  updateSettings: (key: keyof UserSettings, value: any) => void;
  addLog: (
    module: "SYS" | "NET" | "IO" | "EXT",
    type: "info" | "success" | "warning" | "packet",
    message: string,
  ) => void;
}

// How long a portal click is held so its warp effect can play before the new tab
// takes focus, in ms.
const PORTAL_WARP_MS = 420;

const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com/search?q=",
    placeholder: "Search the Web via Secure Index...",
    shortcut: "/g",
    icon: "search",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=",
    placeholder: "Query encrypted index tracker-free...",
    shortcut: "/d",
    icon: "shield",
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com/search?q=",
    placeholder: "Scan repository nodes and codes...",
    shortcut: "/git",
    icon: "github",
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/results?search_query=",
    placeholder: "Query decentral video payload streams...",
    shortcut: "/yt",
    icon: "video",
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Special:Search?search=",
    placeholder: "Query mainframe archive database...",
    shortcut: "/w",
    icon: "book",
  },
];

// Extensions that make a bare "name.ext" far more likely a file being searched for
// than a site to open (several, like .py, .rs and .sh, are also real TLDs).
const FILE_EXTENSIONS = new Set(
  (
    "py js ts tsx jsx md rs sh pl cc cpp hpp cs go rb php java kt swift json yaml " +
    "yml toml xml html htm css scss txt pdf zip exe png jpg jpeg gif svg mp3 mp4 " +
    "mov csv log ini cfg lock sql so ps"
  ).split(" "),
);

// Returns the address to open when the query looks like a URL rather than a search:
// an explicit http(s) link, localhost, an IPv4 address, or a dotted domain name —
// each optionally with a port, path, query string or fragment.
function toDirectUrl(input: string): string | null {
  if (/\s/.test(input)) return null;

  if (/^https?:\/\//i.test(input)) {
    try {
      return new URL(input).href;
    } catch {
      return null;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${input}`);
  } catch {
    return null;
  }
  // "user@example.com" parses as a URL with credentials, but is an email address
  if (parsed.username || parsed.password) return null;

  // Classified from the typed host, not `parsed.hostname`: the URL parser rewrites
  // numeric hosts, turning a search for "3.14" into the address 3.0.0.14.
  const host = input.split(/[/?#]/)[0].replace(/:\d+$/, "");
  const hasPortOrPath = host !== input;
  const labels = host.split(".");
  const tld = labels[labels.length - 1].toLowerCase();

  const isLocalhost = host.toLowerCase() === "localhost";
  const isIpv4 =
    labels.length === 4 &&
    labels.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  const isDomain =
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9-]+$/i.test(label)) &&
    /^[a-z]{2,}$/.test(tld);

  if (isLocalhost || isIpv4) return `http://${input}`;
  if (!isDomain) return null;
  if (labels.length === 2 && !hasPortOrPath && FILE_EXTENSIONS.has(tld)) {
    return null;
  }
  return `https://${input}`;
}

export default function SearchConsole({
  settings,
  updateSettings,
  addLog,
}: SearchConsoleProps) {
  const [query, setQuery] = useState("");
  // Engine picked by a typed shortcut (e.g. "/g "). It applies to the search being
  // typed only — the saved default in settings is left alone.
  const [oneOffEngineId, setOneOffEngineId] = useState<string | null>(null);
  const activeEngine = useMemo(
    () =>
      SEARCH_ENGINES.find((e) => e.id === oneOffEngineId) ??
      SEARCH_ENGINES.find((e) => e.id === settings.searchEngineId) ??
      SEARCH_ENGINES[1],
    [oneOffEngineId, settings.searchEngineId],
  );
  const activePortals = useMemo(
    () =>
      settings.aiPortalIds
        .map((id) => ALL_AI_PORTALS.find((p) => p.id === id))
        .filter((p): p is (typeof ALL_AI_PORTALS)[number] => p !== undefined),
    [settings.aiPortalIds],
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  // The most recent portal activation: where it happened (for the burst overlay) and
  // on which card (for the light band). `seq` differs every time so a repeat click on
  // the same portal replays the effect.
  const [warp, setWarp] = useState<{
    seq: number;
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const warpSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const engineMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the engine picker on outside click
  useEffect(() => {
    if (!isEngineMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        engineMenuRef.current &&
        !engineMenuRef.current.contains(e.target as Node)
      ) {
        setIsEngineMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEngineMenuOpen]);

  // Autofocus the search bar on load, as expected of a new-tab page
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse quick command shortcuts in search box
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    // Look for matching engine shortcut prefixes (e.g. "/g ")
    for (const engine of SEARCH_ENGINES) {
      if (val.startsWith(`${engine.shortcut} `)) {
        setOneOffEngineId(engine.id);
        setQuery(val.substring(engine.shortcut.length + 1));
        addLog(
          "SYS",
          "success",
          `Routing engine set to ${engine.name} for this query via shortcut`,
        );
        break;
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace on an empty bar (or Escape) drops a shortcut-selected engine
    if (!oneOffEngineId) return;
    if (e.key === "Escape" || (e.key === "Backspace" && query === "")) {
      setOneOffEngineId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const trimmedQuery = query.trim();
    addLog(
      "NET",
      "success",
      `Search transmission initialized: engine=${activeEngine.name} payload="${trimmedQuery}"`,
    );

    // Let the user know the target, and then execute client-side redirect
    let targetUrl = activeEngine.url + encodeURIComponent(trimmedQuery);

    // If the query itself looks like a URL, navigate to it directly instead
    const directUrl = toDirectUrl(trimmedQuery);
    if (directUrl) {
      targetUrl = directUrl;
      addLog(
        "NET",
        "info",
        `Direct routing detected. Navigating directly to node: ${targetUrl}`,
      );
    }

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 150);
  };

  // Plays the warp effect for a portal: a ripple through the backdrop canvas, the
  // burst overlay at the activation point, and the light band across its card.
  const openWarp = (e: React.MouseEvent<HTMLElement>, portal: AiPortal) => {
    addLog(
      "EXT",
      "info",
      `Direct linkage: Routed telemetry query to ${portal.name} node`,
    );
    // Keyboard activation reports the pointer at 0,0 — use the card's centre instead
    const rect = e.currentTarget.getBoundingClientRect();
    const fromPointer = e.clientX !== 0 || e.clientY !== 0;
    const x = fromPointer ? e.clientX : rect.left + rect.width / 2;
    const y = fromPointer ? e.clientY : rect.top + rect.height / 2;
    emitPulse(x, y);
    warpSeqRef.current += 1;
    const seq = warpSeqRef.current;
    setWarp({ seq, id: portal.id, x, y });
    // Unmount once the keyframes have finished, unless a newer burst replaced it
    setTimeout(() => {
      setWarp((current) => (current?.seq === seq ? null : current));
    }, WARP_BURST_MS);
  };

  const handlePortalClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    portal: AiPortal,
  ) => {
    openWarp(e, portal);
    // Modifier clicks keep the browser's own behaviour (background tab, new window)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    // The portal opens in a new tab that takes focus straight away, so hold it back
    // just long enough for the effect to be seen.
    e.preventDefault();
    setTimeout(() => {
      window.open(portal.url, "_blank", "noopener,noreferrer");
    }, PORTAL_WARP_MS);
  };

  const selectEngine = (engine: SearchEngine) => {
    updateSettings("searchEngineId", engine.id);
    setOneOffEngineId(null);
    addLog("SYS", "info", `Routing engine changed manually: ${engine.name}`);
    setIsEngineMenuOpen(false);
    inputRef.current?.focus();
  };

  const getThemeColor = () => {
    switch (settings.themeId) {
      case "emerald":
        return "text-emerald-400 border-white/[0.08] shadow-emerald-500/5 ring-emerald-500/10 focus-within:border-emerald-400 focus-within:ring-emerald-400/20";
      case "cyan":
        return "text-cyan-400 border-white/[0.08] shadow-cyan-500/5 ring-cyan-500/10 focus-within:border-cyan-400 focus-within:ring-cyan-400/20";
      case "amber":
        return "text-amber-400 border-white/[0.08] shadow-amber-500/5 ring-amber-500/10 focus-within:border-amber-400 focus-within:ring-amber-400/20";
      case "purple":
        return "text-purple-400 border-white/[0.08] shadow-purple-500/5 ring-purple-500/10 focus-within:border-purple-400 focus-within:ring-purple-400/20";
      case "rose":
        return "text-rose-400 border-white/[0.08] shadow-rose-500/5 ring-rose-500/10 focus-within:border-rose-400 focus-within:ring-rose-400/20";
      default:
        return "text-emerald-400 border-white/[0.08] shadow-emerald-500/5 ring-emerald-500/10 focus-within:border-emerald-400 focus-within:ring-emerald-400/20";
    }
  };

  const getThemeAccentColor = () => {
    switch (settings.themeId) {
      case "emerald":
        return "#34d399";
      case "cyan":
        return "#22d3ee";
      case "amber":
        return "#fbbf24";
      case "purple":
        return "#c084fc";
      case "rose":
        return "#fb7185";
      default:
        return "#34d399";
    }
  };

  const themeClass = getThemeColor();
  const accentColor = getThemeAccentColor();

  return (
    <div
      className="w-full max-w-4xl flex flex-col items-center animate-fade-in"
      id="search-console-wrapper"
    >
      <form
        onSubmit={handleSearchSubmit}
        className={`w-full flex items-center glass-panel [--glass-tint:0.5] rounded-xl border ${themeClass} transition-all duration-300 py-1.5 pl-4 pr-2.5 z-10 boot-draw`}
        style={
          isFocused
            ? {
                boxShadow: `0 0 18px ${accentColor}1f, inset 0 0 10px ${accentColor}0d, inset 0 1px 0.5px rgba(255, 255, 255, 0.17)`,
                borderColor: `${accentColor}66`,
              }
            : undefined
        }
      >
        <div className="flex items-center shrink-0" ref={engineMenuRef}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            transition={BTN_SPRING}
            type="button"
            onClick={() => setIsEngineMenuOpen((prev) => !prev)}
            aria-label={`Change search engine (currently ${activeEngine.name})`}
            aria-expanded={isEngineMenuOpen}
            className="flex items-center text-neutral-400 mr-3 select-none hover:text-neutral-200 transition-colors cursor-pointer shrink-0"
          >
            <Terminal className="w-4.5 h-4.5 mr-1.5 text-neutral-500" />
            <span className="text-xs font-mono tracking-wider font-bold text-neutral-400 uppercase">
              {activeEngine.name.substring(0, 3)}:
            </span>
            <ChevronDown
              className={`w-3 h-3 ml-0.5 text-neutral-600 transition-transform ${isEngineMenuOpen ? "rotate-180" : ""}`}
            />
          </motion.button>

          {/* Expands horizontally inside the search box itself (pushing the input over)
              instead of overlaying a dropdown below — avoids ever overlapping other
              sections of the page regardless of viewport width. */}
          <AnimatePresence>
            {isEngineMenuOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 32 }}
                className="flex items-center gap-1 overflow-hidden pr-3 mr-1 border-r border-neutral-800 font-mono"
                id="search-engine-picker-menu"
              >
                {SEARCH_ENGINES.map((engine) => {
                  const isActive = engine.id === activeEngine.id;
                  return (
                    <motion.button
                      key={engine.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={BTN_SPRING}
                      type="button"
                      onClick={() => selectEngine(engine)}
                      className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? "font-bold"
                          : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${accentColor}25`,
                              color: accentColor,
                            }
                          : undefined
                      }
                    >
                      {engine.name}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={activeEngine.placeholder}
          className="w-full bg-transparent border-none outline-none text-base text-neutral-100 font-mono py-2 tracking-wide placeholder-neutral-600 focus:ring-0 focus:border-none focus:outline-none"
          id="search-input"
        />

        <motion.button
          whileHover={BTN_HOVER}
          whileTap={BTN_TAP}
          transition={BTN_SPRING}
          type="submit"
          className="p-1.5 px-3 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-75 w-fit text-neutral-350 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
          id="search-trigger-btn"
        >
          <Search className="w-4 h-4 text-neutral-300" />
          <span className="text-xs font-mono uppercase tracking-wider hidden sm:inline-block">
            EXEC
          </span>
        </motion.button>
      </form>

      {/* Dedicated Pinned AI Infrastructure Sections */}
      {activePortals.length > 0 && (
        <div
          className="w-full mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 z-10"
          id="dedicated-ai-terminals-wrapper"
        >
          {activePortals.map((portal, portalIndex) => {
            return (
              <motion.a
                key={portal.id}
                whileHover={{ ...CARD_HOVER, transition: CARD_SPRING }}
                whileTap={{ ...CARD_TAP, transition: CARD_SPRING }}
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handlePortalClick(e, portal)}
                onAuxClick={(e) => {
                  if (e.button === 1) openWarp(e, portal);
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty(
                    "--mouse-x",
                    `${e.clientX - rect.left}px`,
                  );
                  e.currentTarget.style.setProperty(
                    "--mouse-y",
                    `${e.clientY - rect.top}px`,
                  );
                }}
                className="relative p-2.5 rounded-xl border border-white/[0.06] glass-panel hover:border-white/[0.14] transition-colors duration-300 group flex items-start justify-between cursor-pointer overflow-hidden text-left boot-rise"
                style={
                  {
                    borderColor:
                      warp?.id === portal.id ? accentColor : undefined,
                    "--hover-glow": accentColor,
                    animationDelay: `${0.7 + portalIndex * 0.06}s`,
                    "--mouse-x": "50%",
                    "--mouse-y": "50%",
                  } as React.CSSProperties
                }
              >
                {/* Warp: a band of light tears across the card as its portal opens */}
                {warp?.id === portal.id && (
                  <div
                    key={warp.seq}
                    className="warp-sweep absolute inset-y-0 left-0 w-2/3 pointer-events-none z-20"
                    style={{
                      background: `linear-gradient(100deg, transparent, ${accentColor}55 42%, #ffffffb0 50%, ${accentColor}55 58%, transparent)`,
                    }}
                  />
                )}

                {/* Dynamic theme mouse spotlight glow when hovered */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(110px circle at var(--mouse-x) var(--mouse-y), ${accentColor}24, transparent 80%)`,
                  }}
                />

                {/* Dynamic theme glow when hovered */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                  style={{
                    backgroundImage: `radial-gradient(circle at 100% 100%, ${accentColor}1A, transparent)`,
                  }}
                />

                <div className="space-y-0.5 relative z-10 group-hover:translate-x-1.5 transition-transform duration-300">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Sparkles
                      className="w-3.5 h-3.5 text-neutral-500 group-hover:text-[var(--hover-glow)] transition-colors duration-300 shrink-0"
                      style={{ color: accentColor }}
                    />
                    <span className="text-xs font-bold tracking-wider text-neutral-200 group-hover:text-white transition-colors duration-300 uppercase">
                      {portal.name}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-neutral-500 tracking-normal font-mono group-hover:text-neutral-400 transition-colors duration-300 leading-tight">
                    {portal.desc}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between h-full min-h-[34px] relative z-10 font-mono text-[8px] tracking-widest shrink-0">
                  <span className="px-1.5 py-0.5 rounded border border-neutral-800/60 bg-neutral-950/80 text-neutral-500 text-xxs scale-90 origin-top-right uppercase font-semibold">
                    {portal.tag}
                  </span>
                  <span className="flex items-center gap-1 text-[8px] text-neutral-600 scale-90 origin-bottom-right group-hover:text-[var(--hover-glow)] transition-all">
                    <span
                      className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"
                      style={{ backgroundColor: accentColor }}
                    />
                    LINK
                  </span>
                </div>
              </motion.a>
            );
          })}
        </div>
      )}

      {/* Portal warp burst at the point a model portal was activated */}
      {warp && <WarpBurst seq={warp.seq} x={warp.x} y={warp.y} />}
    </div>
  );
}
