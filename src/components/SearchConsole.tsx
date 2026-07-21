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

interface SearchConsoleProps {
  settings: UserSettings;
  updateSettings: (key: keyof UserSettings, value: any) => void;
  addLog: (
    module: "SYS" | "NET" | "IO" | "EXT",
    type: "info" | "success" | "warning" | "packet",
    message: string,
  ) => void;
}

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

const AI_PORTALS = [
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    desc: "Google Synapse",
    tag: "v1.5_PRO",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    desc: "OpenAI Core",
    tag: "GPT-4o",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    desc: "Anthropic Hub",
    tag: "v3.5_SON",
  },
  {
    id: "qwen",
    name: "Qwen",
    url: "https://chat.qwenlm.ai",
    desc: "Neural Matrix",
    tag: "v2.5_MAX",
  },
];

export default function SearchConsole({
  settings,
  updateSettings,
  addLog,
}: SearchConsoleProps) {
  const [query, setQuery] = useState("");
  const activeEngine = useMemo(
    () =>
      SEARCH_ENGINES.find((e) => e.id === settings.searchEngineId) ??
      SEARCH_ENGINES[1],
    [settings.searchEngineId],
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
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
        updateSettings("searchEngineId", engine.id);
        setQuery(val.substring(engine.shortcut.length + 1));
        addLog(
          "SYS",
          "success",
          `Active routing engine switched to ${engine.name} via shortcut`,
        );
        break;
      }
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

    // Check if the query itself is a valid looking URL - if so we can offer to navigate directly!
    const isUrl =
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(
        trimmedQuery,
      );
    if (isUrl) {
      targetUrl = trimmedQuery.startsWith("http")
        ? trimmedQuery
        : `https://${trimmedQuery}`;
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

  const selectEngine = (engine: SearchEngine) => {
    updateSettings("searchEngineId", engine.id);
    addLog("SYS", "info", `Routing engine changed manually: ${engine.name}`);
    setIsEngineMenuOpen(false);
    inputRef.current?.focus();
  };

  const getThemeColor = () => {
    switch (settings.themeId) {
      case "emerald":
        return "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5 ring-emerald-500/10 focus-within:border-emerald-400 focus-within:ring-emerald-400/20";
      case "cyan":
        return "text-cyan-400 border-cyan-500/20 shadow-cyan-500/5 ring-cyan-500/10 focus-within:border-cyan-400 focus-within:ring-cyan-400/20";
      case "amber":
        return "text-amber-400 border-amber-500/20 shadow-amber-500/5 ring-amber-500/10 focus-within:border-amber-400 focus-within:ring-amber-400/20";
      case "purple":
        return "text-purple-400 border-purple-500/20 shadow-purple-500/5 ring-purple-500/10 focus-within:border-purple-400 focus-within:ring-purple-400/20";
      case "rose":
        return "text-rose-400 border-rose-500/20 shadow-rose-500/5 ring-rose-500/10 focus-within:border-rose-400 focus-within:ring-rose-400/20";
      default:
        return "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5 ring-emerald-500/10 focus-within:border-emerald-400 focus-within:ring-emerald-400/20";
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
        className={`w-full flex items-center bg-neutral-950/80 backdrop-blur-md rounded-xl border ${themeClass} shadow-xl ring-1 transition-all duration-300 py-1.5 pl-4 pr-2.5 z-10`}
        style={
          isFocused
            ? {
                boxShadow: `0 0 20px ${accentColor}35, inset 0 0 10px ${accentColor}15`,
                borderColor: accentColor,
              }
            : undefined
        }
      >
        <div className="relative shrink-0" ref={engineMenuRef}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            transition={BTN_SPRING}
            type="button"
            onClick={() => setIsEngineMenuOpen((prev) => !prev)}
            aria-label={`Change search engine (currently ${activeEngine.name})`}
            aria-expanded={isEngineMenuOpen}
            className="flex items-center text-neutral-400 mr-3 select-none hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <Terminal className="w-4.5 h-4.5 mr-1.5 text-neutral-500" />
            <span className="text-xs font-mono tracking-wider font-bold text-neutral-400 uppercase">
              {activeEngine.name.substring(0, 3)}:
            </span>
            <ChevronDown
              className={`w-3 h-3 ml-0.5 text-neutral-600 transition-transform ${isEngineMenuOpen ? "rotate-180" : ""}`}
            />
          </motion.button>

          <AnimatePresence>
            {isEngineMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-2 w-44 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden z-20 font-mono"
                id="search-engine-picker-menu"
              >
                {SEARCH_ENGINES.map((engine) => (
                  <motion.button
                    key={engine.id}
                    whileHover={{ scale: 1.03, x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    transition={BTN_SPRING}
                    type="button"
                    onClick={() => selectEngine(engine)}
                    className={`w-full text-left px-3 py-2 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-between ${
                      engine.id === activeEngine.id
                        ? "bg-neutral-900 text-white font-bold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    {engine.name}
                    <span className="text-neutral-600 text-[10px] normal-case">
                      {engine.shortcut}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
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
      <div
        className="w-full mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 z-10"
        id="dedicated-ai-terminals-wrapper"
      >
        {AI_PORTALS.map((portal) => {
          return (
            <motion.a
              key={portal.id}
              whileHover={{ ...CARD_HOVER, transition: CARD_SPRING }}
              whileTap={{ ...CARD_TAP, transition: CARD_SPRING }}
              href={portal.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                addLog(
                  "EXT",
                  "info",
                  `Direct linkage: Routed telemetry query to ${portal.name} node`,
                )
              }
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
              className="relative p-2.5 rounded-xl border border-neutral-900 bg-neutral-950/50 hover:bg-neutral-900/40 hover:border-neutral-800 transition-colors duration-300 group flex items-start justify-between cursor-pointer overflow-hidden text-left"
              style={
                {
                  "--hover-glow": accentColor,
                  "--mouse-x": "50%",
                  "--mouse-y": "50%",
                } as React.CSSProperties
              }
            >
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
    </div>
  );
}
