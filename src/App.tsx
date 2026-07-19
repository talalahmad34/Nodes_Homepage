/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Cpu, X, Globe, User, Palette, Eye, Terminal, FolderSync } from 'lucide-react';
import { PinnedSite, UserSettings, SystemLog, SystemTheme } from './types';
import { readLocal, readSync, write } from './lib/storage';
import NetworkBackground from './components/NetworkBackground';
import FuturisticClock from './components/FuturisticClock';
import SearchConsole from './components/SearchConsole';
import PinnedSites from './components/PinnedSites';

const THEMES: SystemTheme[] = [
  {
    id: 'emerald',
    name: 'Emerald Cyber',
    primary: 'emerald-400',
    secondary: 'emerald-600',
    accent: '#34d399',
    bgClass: 'rgba(6, 78, 59, 0.15)',
    terminalColor: '#059669',
  },
  {
    id: 'cyan',
    name: 'Cyan Hologram',
    primary: 'cyan-400',
    secondary: 'cyan-600',
    accent: '#22d3ee',
    bgClass: 'rgba(8, 145, 178, 0.15)',
    terminalColor: '#0891b2',
  },
  {
    id: 'amber',
    name: 'Retro Amber',
    primary: 'amber-400',
    secondary: 'amber-600',
    accent: '#fbbf24',
    bgClass: 'rgba(146, 64, 14, 0.15)',
    terminalColor: '#d97706',
  },
  {
    id: 'purple',
    name: 'Quantum Purple',
    primary: 'purple-400',
    secondary: 'purple-600',
    accent: '#c084fc',
    bgClass: 'rgba(107, 33, 168, 0.15)',
    terminalColor: '#9333ea',
  },
  {
    id: 'rose',
    name: 'Rose Matrix',
    primary: 'rose-400',
    secondary: 'rose-600',
    accent: '#fb7185',
    bgClass: 'rgba(159, 18, 57, 0.15)',
    terminalColor: '#e11d48',
  },
];

const DEFAULT_SITES: PinnedSite[] = [
  {
    id: 'google',
    title: 'Google',
    url: 'https://google.com',
    iconType: 'initials',
    iconValue: 'GO',
    category: 'Search',
    visitCount: 0,
  },
  {
    id: 'github',
    title: 'GitHub',
    url: 'https://github.com',
    iconType: 'initials',
    iconValue: 'GH',
    category: 'Development',
    visitCount: 0,
  },
  {
    id: 'youtube',
    title: 'YouTube',
    url: 'https://youtube.com',
    iconType: 'initials',
    iconValue: 'YT',
    category: 'Media',
    visitCount: 0,
  },
  {
    id: 'stackoverflow',
    title: 'StackOverflow',
    url: 'https://stackoverflow.com',
    iconType: 'initials',
    iconValue: 'SO',
    category: 'Development',
    visitCount: 0,
  },
];

// Structural validation for a single pinned site parsed from an untrusted backup file/paste —
// guards against e.g. an array of plain strings passing the earlier `Array.isArray` check alone.
function isValidPinnedSite(value: unknown): value is PinnedSite {
  if (!value || typeof value !== 'object') return false;
  const site = value as Record<string, unknown>;
  return (
    typeof site.id === 'string' &&
    typeof site.title === 'string' &&
    typeof site.url === 'string' &&
    (site.iconType === 'initials' || site.iconType === 'icon' || site.iconType === 'custom') &&
    typeof site.iconValue === 'string' &&
    typeof site.visitCount === 'number'
  );
}

interface BackupPayload {
  settings?: Partial<UserSettings>;
  pinnedSites?: PinnedSite[];
}

// Parses and structurally validates a backup JSON string; returns null if the shape can't be trusted.
function parseBackupPayload(raw: string): BackupPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, unknown>;
  const result: BackupPayload = {};

  if (data.settings && typeof data.settings === 'object') {
    result.settings = data.settings as Partial<UserSettings>;
  }
  if (Array.isArray(data.pinnedSites)) {
    if (!data.pinnedSites.every(isValidPinnedSite)) return null;
    result.pinnedSites = data.pinnedSites as PinnedSite[];
  }

  return result.settings || result.pinnedSites ? result : null;
}

const DEFAULT_SETTINGS: UserSettings = {
  userName: 'Operator',
  themeId: 'cyan',
  timeFormat24h: true,
  showSeconds: true,
  searchEngineId: 'duckduckgo',
  showHexClock: true,
  activeBackground: 'network',
  showAnalogOverlay: false,
  techPingDelaySim: true,
  showWorkProgress: false,
  workStart: '09:00',
  workEnd: '17:00',
};

export default function App() {
  const telemetryRef = useRef<HTMLTextAreaElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const parsed = readLocal<UserSettings>('netgrid_settings', DEFAULT_SETTINGS);
    // Force duckduckgo if the stored default is old 'google' or missing
    if (parsed.searchEngineId === 'google') {
      parsed.searchEngineId = 'duckduckgo';
    }
    return parsed;
  });

  const [pinnedSites, setPinnedSites] = useState<PinnedSite[]>(() => {
    const parsed = readLocal<PinnedSite[]>('netgrid_pinned_sites', DEFAULT_SITES);
    // Filter out ChatGPT / Gemini standard bookmarks to avoid duplication
    return parsed.filter((s) => s.id !== 'chatgpt' && s.id !== 'gemini');
  });

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [telemetryStatus, setTelemetryStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localIp, setLocalIp] = useState<string | null>(null);

  // Pull the latest chrome.storage.sync copy (if any) shortly after the instant
  // local-cache paint, so edits made on another signed-in device show up here too.
  useEffect(() => {
    let cancelled = false;
    readSync(['netgrid_settings', 'netgrid_pinned_sites']).then((synced) => {
      if (cancelled) return;
      if (synced.netgrid_settings) {
        setSettings((prev) => ({ ...prev, ...(synced.netgrid_settings as UserSettings) }));
      }
      if (Array.isArray(synced.netgrid_pinned_sites)) {
        setPinnedSites(synced.netgrid_pinned_sites as PinnedSite[]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save settings when updated (mirrors to localStorage + chrome.storage.sync)
  useEffect(() => {
    write('netgrid_settings', settings);
  }, [settings]);

  // Auto-save pinned sites when updated (mirrors to localStorage + chrome.storage.sync)
  useEffect(() => {
    write('netgrid_pinned_sites', pinnedSites);
  }, [pinnedSites]);

  // Sync state to telemetry text area ref when state updates
  useEffect(() => {
    if (telemetryRef.current && document.activeElement !== telemetryRef.current) {
      telemetryRef.current.value = JSON.stringify({ settings, pinnedSites });
    }
  }, [settings, pinnedSites, isSettingsOpen]);

  // Get actual local IP address on startup and listen for network changes
  useEffect(() => {
    const updateIp = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.system && chrome.system.network) {
          chrome.system.network.getNetworkInterfaces((interfaces) => {
            const ipv4Interface = interfaces.find(
              (iface) => iface.address.includes('.') && !iface.address.startsWith('127.0'),
            );
            if (ipv4Interface) {
              setLocalIp(ipv4Interface.address);
            }
          });
        }
      } catch {
        // Fail silent
      }
    };

    updateIp();

    if (
      typeof chrome !== 'undefined' &&
      chrome.system &&
      chrome.system.network &&
      chrome.system.network.onNetworkLinkChanged
    ) {
      chrome.system.network.onNetworkLinkChanged.addListener(updateIp);
      return () => {
        chrome.system.network.onNetworkLinkChanged.removeListener(updateIp);
      };
    }
  }, []);

  // System actions telemetry log callback function, stabilized safely to prevent triggers
  const addLog = useCallback(
    (
      module: 'SYS' | 'NET' | 'IO' | 'EXT',
      type: 'info' | 'success' | 'warning' | 'packet',
      message: string,
    ) => {
      const formattedDate = new Date();
      const ts = formattedDate.toLocaleTimeString('en-US', { hour12: false });

      setLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: ts,
          module,
          type,
          message,
        },
        ...prev.slice(0, 49), // Max 50 rows of history cache
      ]);
    },
    [],
  );

  // Generate welcome log only once at initial boot up
  useEffect(() => {
    addLog('SYS', 'success', 'NETGRID core system initialized successfully.');
    addLog('NET', 'info', `Established listening channel on port 3000.`);
    addLog('SYS', 'info', 'Interactive clock matrix calibrated to physical UTC parameters.');
  }, [addLog]);

  const updateSettingField = (key: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    addLog('SYS', 'success', `Configuration calibration updated: ${key} -> ${value}`);
  };

  const handleAddSite = (site: Omit<PinnedSite, 'id' | 'visitCount'>) => {
    const newSite: PinnedSite = {
      ...site,
      id: Math.random().toString(36).substring(2, 9),
      visitCount: 0,
    };
    setPinnedSites((prev) => [...prev, newSite]);
  };

  const handleEditSite = (updated: PinnedSite) => {
    setPinnedSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDeleteSite = (id: string) => {
    const target = pinnedSites.find((s) => s.id === id);
    if (target) {
      setPinnedSites((prev) => prev.filter((s) => s.id !== id));
      addLog('IO', 'warning', `Connection node removed from active index: ${target.title}`);
    }
  };

  const handleIncrementVisit = (id: string) => {
    setPinnedSites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visitCount: s.visitCount + 1 } : s)),
    );
  };

  // Shared entry point for both the paste-to-restore textarea and the file-upload import —
  // parses + structurally validates before ever touching state.
  const applyBackupPayload = (raw: string) => {
    const payload = parseBackupPayload(raw);
    if (!payload) {
      addLog('SYS', 'warning', 'Restoration sequence failed: Invalid segment format');
      setTelemetryStatus({ ok: false, message: 'Please provide a valid backup JSON format.' });
      setTimeout(() => setTelemetryStatus(null), 4000);
      return;
    }

    if (payload.settings) {
      setSettings((prev) => ({ ...prev, ...payload.settings }));
    }
    if (payload.pinnedSites) {
      setPinnedSites(payload.pinnedSites);
    }
    addLog('SYS', 'success', 'System backup telemetry successfully restored');
    setTelemetryStatus({ ok: true, message: 'Backup restored successfully.' });
    setTimeout(() => setTelemetryStatus(null), 4000);
  };

  const handleDownloadBackup = () => {
    const payload = JSON.stringify({ settings, pinnedSites }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `nodes-homepage-backup-${dateStamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog('SYS', 'success', 'Telemetry configuration backup downloaded as file');
  };

  const handleImportBackupFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(applyBackupPayload);
  };

  // Human greeting calculator dependent on hours
  const calculateGreeting = () => {
    const currentHr = new Date().getHours();
    let bracket = 'INITIATE';

    if (settings.userName) {
      bracket = settings.userName;
    }

    if (currentHr < 12) return `ACCESS_GRANTED: Good Morning, ${bracket}`;
    if (currentHr < 17) return `ACCESS_GRANTED: Good Afternoon, ${bracket}`;
    return `ACCESS_GRANTED: Good Evening, ${bracket}`;
  };

  const currentTheme = THEMES.find((th) => th.id === settings.themeId) || THEMES[0];

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between text-[#A0A0A5] overflow-x-hidden font-sans pb-3 sm:pb-5 select-none bg-transparent">
      {/* Absolute solid background behind everything to keep -z-20 canvas visible */}
      <div className="absolute inset-0 bg-[#050506] -z-30 pointer-events-none" />

      {/* Background Interactive Canvas Overlay */}
      <NetworkBackground type={settings.activeBackground} colorTheme={currentTheme.primary} />

      {/* Technical Grid Overlay from Elegant Dark */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] -z-10"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      ></div>

      {/* Background Ambient radial spotlight matches user theme */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${currentTheme.id === 'cyan' ? 'rgba(6, 182, 212, 0.08)' : currentTheme.bgClass}, transparent 75%)`,
        }}
      />

      {/* Floating System Header navigation styled to match Elegant Dark */}
      <header
        className="w-full max-w-none px-6 sm:px-10 pt-3 sm:pt-4 pb-2 flex justify-between items-center z-10 select-none border-b border-neutral-900/50"
        id="primary-app-header"
      >
        <div className="space-y-1 font-mono w-1/3">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{
                backgroundColor: currentTheme.accent,
                boxShadow: `0 0 10px ${currentTheme.accent}`,
              }}
            ></div>
            <span
              className="text-xs uppercase tracking-[0.2em] font-bold"
              style={{ color: currentTheme.accent }}
            >
              System Online
            </span>
          </div>
          <h2 className="text-xs tracking-widest text-neutral-400 uppercase">
            CORE_NODE // NETGRID-HK92
          </h2>
        </div>

        {/* Center greetings tag inline with header info */}
        <div className="flex justify-center w-1/3">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center font-mono select-none"
          >
            <h2 className="text-xs md:text-sm text-neutral-100 font-bold tracking-wider uppercase font-mono px-3.5 py-1 bg-neutral-950/40 border border-neutral-900 rounded-full inline-block">
              {calculateGreeting()}
            </h2>
          </motion.div>
        </div>

        {/* Action controls button links & Network display from design */}
        <div className="flex items-center justify-end gap-6 w-1/3">
          <div className="text-right space-y-1 font-mono hidden sm:block font-medium">
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Network Latency
            </div>
            <div className="text-sm text-neutral-300">
              14.2ms <span className="text-neutral-600">/</span> 1.2gbps
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 px-3 select-none text-neutral-300 rounded-lg border border-neutral-800 bg-neutral-950/80 hover:text-white hover:border-neutral-700 transition-all cursor-pointer flex items-center gap-1.5 font-mono"
            id="control-settings-trigger-btn"
          >
            <Settings className="w-4 h-4 text-neutral-450" />
            <span className="text-xs uppercase tracking-wider">Config</span>
          </button>
        </div>
      </header>

      {/* Main Body Centered Column */}
      <main className="w-full max-w-none px-6 sm:px-10 flex flex-col items-center justify-start pt-3 sm:pt-5 md:pt-6 space-y-2 md:space-y-3 lg:space-y-3.5 flex-grow z-10 py-1 sm:py-1.5">
        {/* 1. Futuristic Digital Clock Widget */}
        <FuturisticClock settings={settings} addLog={addLog} />

        {/* 2. Interactive Search terminal bar */}
        <SearchConsole settings={settings} updateSettings={updateSettingField} addLog={addLog} />

        {/* 3. Pinned custom shortcut grid items */}
        <PinnedSites
          settings={settings}
          pinnedSites={pinnedSites}
          onAddSite={handleAddSite}
          onEditSite={handleEditSite}
          onDeleteSite={handleDeleteSite}
          onUpdateSiteVisits={handleIncrementVisit}
          onReorderSites={(reorderedSites) => setPinnedSites(reorderedSites)}
          addLog={addLog}
        />
      </main>

      {/* Footer Status Bar from Elegant Dark guidelines */}
      <footer className="w-full max-w-none px-6 sm:px-10 py-3 border-t border-neutral-800/40 mt-3 sm:mt-4 flex justify-between items-center text-[10.5px] uppercase tracking-[0.25em] text-neutral-400 z-10 font-mono">
        <div className="flex gap-3 sm:gap-6 font-medium">
          <span>Local IP: {localIp ?? 'Unavailable'}</span>
          <span className="text-neutral-805 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Gateway: Connected</span>
          <span className="text-neutral-805 hidden sm:inline">|</span>
          <span className="hidden sm:inline" title="NETGRID build version">
            v{__APP_VERSION__}
          </span>
        </div>
        <div className="flex gap-3 items-center font-medium">
          <button
            onClick={() => setIsLogPanelOpen((prev) => !prev)}
            aria-label={isLogPanelOpen ? 'Hide system log' : 'Show system log'}
            aria-expanded={isLogPanelOpen}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all cursor-pointer normal-case tracking-normal ${
              isLogPanelOpen
                ? 'border-neutral-700 text-white bg-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider hidden sm:inline">
              System Log
            </span>
          </button>
          <div className="flex gap-1.5 items-center">
            <div
              className="w-1.5 h-3 rounded-xs"
              style={{ backgroundColor: currentTheme.accent }}
            />
            <div
              className="w-1.5 h-3 rounded-xs"
              style={{ backgroundColor: currentTheme.accent }}
            />
            <div
              className="w-1.5 h-3 rounded-xs"
              style={{ backgroundColor: currentTheme.accent }}
            />
            <div className="w-1.5 h-3 rounded-xs bg-neutral-800" />
            <div className="w-1.5 h-3 rounded-xs bg-neutral-800" />
          </div>
          <span className="text-neutral-300">Secure Node Session Active</span>
        </div>
      </footer>

      {/* Collapsible System Log Panel — surfaces the telemetry events already being recorded */}
      <AnimatePresence>
        {isLogPanelOpen && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed bottom-3 right-3 sm:right-5 z-40 w-[calc(100%-1.5rem)] sm:w-96 max-h-64 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md font-mono overflow-hidden flex flex-col"
            id="system-log-panel"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-900">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                System Log
              </span>
              <button
                onClick={() => setIsLogPanelOpen(false)}
                aria-label="Close system log"
                className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              className="overflow-y-auto scrollbar-thin px-3 py-2 space-y-1 text-[10.5px]"
              role="log"
              aria-live="polite"
              aria-label="System telemetry log"
            >
              {logs.length === 0 && (
                <div className="text-neutral-600 py-4 text-center">No events recorded yet.</div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-neutral-400">
                  <span className="text-neutral-600 shrink-0">{log.timestamp}</span>
                  <span
                    className={`shrink-0 font-bold ${
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'warning'
                          ? 'text-amber-400'
                          : log.type === 'packet'
                            ? 'text-cyan-400'
                            : 'text-neutral-500'
                    }`}
                  >
                    [{log.module}]
                  </span>
                  <span className="text-neutral-300 break-words">{log.message}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Terminal Settings Drawer Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            {/* Backdrop click closer */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={() => setIsSettingsOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative w-full max-w-sm h-full bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col justify-between font-mono z-10 shadow-2xl"
              id="settings-drawer-container"
            >
              {/* Corner notches decorations */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-700" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neutral-700" />

              <div
                className="space-y-6 overflow-y-auto flex-grow max-h-[84vh] pr-2 scrollbar-none pb-4"
                id="calibration-drawer-scroller"
              >
                {/* Drawer header */}
                <div className="flex justify-between items-center pb-3 border-b border-neutral-900 select-none">
                  <span className="text-[11px] font-bold text-neutral-300 tracking-[0.25em] uppercase flex items-center gap-1.5">
                    <Cpu className={`w-4 h-4 text-${currentTheme.primary}`} />
                    SYSTEM CALIBRATION
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    aria-label="Close system calibration panel"
                    className="p-1 px-1.5 rounded hover:bg-neutral-900 text-neutral-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Username handler field */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest block flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Operator Greeting Tag
                  </span>
                  <input
                    type="text"
                    value={settings.userName}
                    onChange={(e) => updateSettingField('userName', e.target.value)}
                    placeholder="e.g. Initiator"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-700 transition-all font-mono"
                    id="username-setting-field"
                  />
                </div>

                {/* Color theme selectors dashboard */}
                <div className="space-y-2">
                  <span className="text-xs text-neutral-400 uppercase tracking-widest block flex items-center gap-1.5 font-bold">
                    <Palette className="w-4 h-4" />
                    Glow Prism Theme
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {THEMES.map((theme) => {
                      const isSelected = theme.id === settings.themeId;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => updateSettingField('themeId', theme.id)}
                          className={`p-2.5 rounded-lg border text-xs text-left transition-all flex items-center justify-between cursor-pointer focus:outline-none ${
                            isSelected
                              ? 'bg-neutral-900 text-white'
                              : 'border-neutral-900 hover:border-neutral-800 text-neutral-500 hover:text-neutral-400'
                          }`}
                          style={{
                            borderColor: isSelected ? theme.accent : undefined,
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: theme.accent }}
                            />
                            {theme.name}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] opacity-65 font-bold">[ACTIVE]</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Animated Background Selector options picker */}
                <div className="space-y-2">
                  <span className="text-xs text-neutral-400 uppercase tracking-widest block flex items-center gap-1.5 font-bold">
                    <Eye className="w-4 h-4" />
                    Backdrop Visualizer Node
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['network', 'grid', 'starfield'] as const).map((bgType) => {
                      const isSelected = settings.activeBackground === bgType;
                      return (
                        <button
                          key={bgType}
                          onClick={() => updateSettingField('activeBackground', bgType)}
                          className={`p-2 rounded text-[10.5px] text-center uppercase tracking-wide border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-neutral-700 bg-neutral-900 text-white font-bold'
                              : 'border-neutral-900 text-neutral-500 hover:text-neutral-400'
                          }`}
                        >
                          {bgType}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Default Search Engine router calibrator */}
                <div className="space-y-2">
                  <span className="text-xs text-neutral-400 uppercase tracking-widest block flex items-center gap-1.5 font-bold">
                    <Globe className="w-4 h-4" />
                    Default Search Engine
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'duckduckgo', name: 'DuckDuckGo' },
                      { id: 'google', name: 'Google' },
                      { id: 'github', name: 'GitHub' },
                      { id: 'youtube', name: 'YouTube' },
                      { id: 'wikipedia', name: 'Wikipedia' },
                    ].map((engine) => {
                      const isSelected = settings.searchEngineId === engine.id;
                      return (
                        <button
                          key={engine.id}
                          onClick={() => updateSettingField('searchEngineId', engine.id)}
                          className={`p-2 rounded text-[10.5px] text-center uppercase tracking-wide border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-900 text-white font-bold'
                              : 'border-neutral-900 text-neutral-500 hover:text-neutral-400'
                          }`}
                          style={{
                            borderColor: isSelected ? currentTheme.accent : undefined,
                          }}
                        >
                          {engine.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Switch checklist fields */}
                <div className="space-y-3 pt-3 border-t border-neutral-900">
                  <span className="text-xs text-neutral-400 uppercase tracking-widest block select-none font-bold">
                    Toggles & Calibrations
                  </span>

                  {/* 24 Hour clock toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Use 24-Hour Time Format</span>
                    <input
                      type="checkbox"
                      checked={settings.timeFormat24h}
                      onChange={(e) => updateSettingField('timeFormat24h', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{
                        backgroundColor: settings.timeFormat24h ? currentTheme.accent : '#262626',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-black transition-all ${settings.timeFormat24h ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </label>

                  {/* Seconds clock toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Show Live Seconds readout</span>
                    <input
                      type="checkbox"
                      checked={settings.showSeconds}
                      onChange={(e) => updateSettingField('showSeconds', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{
                        backgroundColor: settings.showSeconds ? currentTheme.accent : '#262626',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showSeconds ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </label>

                  {/* Binary Clock indicator toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Binary Clock Matrix overlay</span>
                    <input
                      type="checkbox"
                      checked={settings.showHexClock}
                      onChange={(e) => updateSettingField('showHexClock', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{
                        backgroundColor: settings.showHexClock ? currentTheme.accent : '#262626',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showHexClock ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </label>

                  {/* ICMP Packet Logging Toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Simulated Networking Pings Log</span>
                    <input
                      type="checkbox"
                      checked={settings.techPingDelaySim}
                      onChange={(e) => updateSettingField('techPingDelaySim', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{
                        backgroundColor: settings.techPingDelaySim
                          ? currentTheme.accent
                          : '#262626',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-black transition-all ${settings.techPingDelaySim ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </label>

                  {/* Work Hours Progress Tracker Toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Work Hours Tracker overlay</span>
                    <input
                      type="checkbox"
                      checked={!!settings.showWorkProgress}
                      onChange={(e) => {
                        setSettings((prev) => ({
                          ...prev,
                          showWorkProgress: e.target.checked,
                          workStart: prev.workStart || '09:00',
                          workEnd: prev.workEnd || '17:00',
                        }));
                        addLog(
                          'SYS',
                          'success',
                          e.target.checked
                            ? 'Work tracker activated: adjust shift times below'
                            : 'Work tracker deactivated',
                        );
                      }}
                      className="sr-only"
                    />
                    <div
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{
                        backgroundColor: settings.showWorkProgress
                          ? currentTheme.accent
                          : '#262626',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showWorkProgress ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </label>

                  {settings.showWorkProgress && (
                    <div
                      className="pl-4 pb-2 flex gap-4 text-xs font-mono select-none"
                      id="work-hours-adjust-inputs"
                    >
                      <div className="flex flex-col">
                        <span className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">
                          Shift Start
                        </span>
                        <input
                          type="text"
                          value={settings.workStart || '09:00'}
                          onChange={(e) => updateSettingField('workStart', e.target.value)}
                          className="w-16 bg-neutral-900 border border-neutral-800 rounded p-1 text-center outline-none text-white focus:border-neutral-700 text-[10.5px]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">
                          Shift End
                        </span>
                        <input
                          type="text"
                          value={settings.workEnd || '17:00'}
                          onChange={(e) => updateSettingField('workEnd', e.target.value)}
                          className="w-16 bg-neutral-900 border border-neutral-800 rounded p-1 text-center outline-none text-white focus:border-neutral-700 text-[10.5px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. System Configuration Backup (JSON) */}
                <div
                  className="space-y-2.5 pt-4 border-t border-neutral-900"
                  id="system-telemetry-backup-wrapper"
                >
                  <span className="text-[11px] text-neutral-400 uppercase tracking-widest block font-bold flex items-center gap-1.5">
                    <FolderSync className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
                    TELEMETRY CALIBRATION BACKUP
                  </span>
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    Export or import customized system nodes (bookmarks) and setup parameters —
                    copy/paste the JSON below, or download/import it as a file.
                  </p>

                  <textarea
                    ref={telemetryRef}
                    defaultValue={JSON.stringify({ settings, pinnedSites })}
                    onClick={(e) => {
                      (e.target as HTMLTextAreaElement).select();
                    }}
                    className="w-full h-18 bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-[9.5px] text-neutral-400 outline-none font-mono focus:border-neutral-700 select-all cursor-pointer leading-tight resize-none scrollbar-none"
                    placeholder="Telemetry backup string..."
                    id="system-telemetry-backup-data-field"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (telemetryRef.current) {
                          navigator.clipboard.writeText(telemetryRef.current.value);
                          addLog(
                            'SYS',
                            'success',
                            'Telemetry configuration backup string copied to clipboard',
                          );
                        }
                      }}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Copy Telemetry
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBackupPayload(telemetryRef.current?.value || '')}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Restore System
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Download File
                    </button>
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Import File
                    </button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={handleImportBackupFile}
                      className="hidden"
                      id="system-telemetry-backup-file-input"
                    />
                  </div>
                  {telemetryStatus && (
                    <div
                      className={`text-[10px] font-mono px-2 py-1.5 rounded border ${
                        telemetryStatus.ok
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                          : 'border-rose-500/30 text-rose-400 bg-rose-500/5'
                      }`}
                      role="status"
                    >
                      {telemetryStatus.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Close / Return safe button */}
              <button
                onClick={() => setIsSettingsOpen(false)}
                className={`w-full p-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-bold hover:text-white transition-all text-xs rounded-lg uppercase tracking-wider cursor-pointer mt-6 select-none`}
              >
                Sync adjustments
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
