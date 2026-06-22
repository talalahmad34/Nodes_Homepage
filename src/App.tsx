/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Cpu, X, Globe, User, Palette, Eye, ShieldCheck, Heart, Terminal, FolderSync } from 'lucide-react';
import { PinnedSite, UserSettings, SystemLog, SystemTheme } from './types';
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
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem('netgrid_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Force duckduckgo if the stored default is old 'google' or missing
        if (parsed.searchEngineId === 'google') {
          parsed.searchEngineId = 'duckduckgo';
        }
        return parsed;
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [pinnedSites, setPinnedSites] = useState<PinnedSite[]>(() => {
    try {
      const stored = localStorage.getItem('netgrid_pinned_sites');
      if (stored) {
        const parsed = JSON.parse(stored) as PinnedSite[];
        // Filter out ChatGPT / Gemini standard bookmarks to avoid duplication
        return parsed.filter(s => s.id !== 'chatgpt' && s.id !== 'gemini');
      }
      return DEFAULT_SITES;
    } catch {
      return DEFAULT_SITES;
    }
  });

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const [localIp, setLocalIp] = useState('192.168.1.104');

  // Auto-save settings when updated
  useEffect(() => {
    localStorage.setItem('netgrid_settings', JSON.stringify(settings));
  }, [settings]);

  // Auto-save pinned sites when updated
  useEffect(() => {
    localStorage.setItem('netgrid_pinned_sites', JSON.stringify(pinnedSites));
  }, [pinnedSites]);

  // Sync state to telemetry text area ref when state updates
  useEffect(() => {
    if (telemetryRef.current && document.activeElement !== telemetryRef.current) {
      telemetryRef.current.value = JSON.stringify({ settings, pinnedSites });
    }
  }, [settings, pinnedSites, isSettingsOpen]);

  // Read environment variable injects at startup (AI Studio runtime variables)
  useEffect(() => {
    // Read window origin as backup, or direct process env variables if present
    const envUrl = process.env.APP_URL || '';
    setAppUrl(envUrl);
  }, []);

  // Get actual local IP address on startup and listen for network changes
  useEffect(() => {
    const updateIp = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.system && chrome.system.network) {
          chrome.system.network.getNetworkInterfaces((interfaces) => {
            const ipv4Interface = interfaces.find(
              (iface) =>
                iface.address.includes('.') && 
                !iface.address.startsWith('127.0')
            );
            if (ipv4Interface) {
              setLocalIp(ipv4Interface.address);
            }
          });
        }
      } catch (e) {
        // Fail silent
      }
    };

    updateIp();

    if (typeof chrome !== 'undefined' && chrome.system && chrome.system.network && chrome.system.network.onNetworkLinkChanged) {
      chrome.system.network.onNetworkLinkChanged.addListener(updateIp);
      return () => {
        chrome.system.network.onNetworkLinkChanged.removeListener(updateIp);
      };
    }
  }, []);

  // System actions telemetry log callback function, stabilized safely to prevent triggers
  const addLog = useCallback((
    module: 'SYS' | 'NET' | 'IO' | 'EXT',
    type: 'info' | 'success' | 'warning' | 'packet',
    message: string
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
  }, []);

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
      prev.map((s) => (s.id === id ? { ...s, visitCount: s.visitCount + 1 } : s))
    );
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
      <NetworkBackground
        type={settings.activeBackground}
        colorTheme={currentTheme.primary}
      />

      {/* Technical Grid Overlay from Elegant Dark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] -z-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Background Ambient radial spotlight matches user theme */}
      <div 
        className="absolute inset-0 pointer-events-none -z-10 transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${currentTheme.id === 'cyan' ? 'rgba(6, 182, 212, 0.08)' : currentTheme.bgClass}, transparent 75%)`
        }}
      />

      {/* Floating System Header navigation styled to match Elegant Dark */}
      <header className="w-full max-w-none px-6 sm:px-10 pt-3 sm:pt-4 pb-2 flex justify-between items-center z-10 select-none border-b border-neutral-900/50" id="primary-app-header">
        <div className="space-y-1 font-mono w-1/3">
          <div className="flex items-center gap-2">
            <div 
              className="w-2.5 h-2.5 rounded-full animate-pulse" 
              style={{ 
                backgroundColor: currentTheme.accent,
                boxShadow: `0 0 10px ${currentTheme.accent}`
              }}
            ></div>
            <span className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: currentTheme.accent }}>
              System Online
            </span>
          </div>
          <h2 className="text-xs tracking-widest text-neutral-400 uppercase">CORE_NODE // NETGRID-HK92</h2>
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Network Latency</div>
            <div className="text-sm text-neutral-300">14.2ms <span className="text-neutral-600">/</span> 1.2gbps</div>
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
        <FuturisticClock
          settings={settings}
          addLog={addLog}
        />

        {/* 2. Interactive Search terminal bar */}
        <SearchConsole
          settings={settings}
          updateSettings={updateSettingField}
          addLog={addLog}
        />

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
          <span>Local IP: {localIp}</span>
          <span className="text-neutral-805 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Gateway: Connected</span>
        </div>
        <div className="flex gap-3 items-center font-medium">
          <div className="flex gap-1.5 items-center">
            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: currentTheme.accent }} />
            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: currentTheme.accent }} />
            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: currentTheme.accent }} />
            <div className="w-1.5 h-3 rounded-xs bg-neutral-800" />
            <div className="w-1.5 h-3 rounded-xs bg-neutral-800" />
          </div>
          <span className="text-neutral-300">Secure Node Session Active</span>
        </div>
      </footer>

      {/* Slide-out Terminal Settings Drawer Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            {/* Backdrop click closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsSettingsOpen(false)} />

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

              <div className="space-y-6 overflow-y-auto flex-grow max-h-[84vh] pr-2 scrollbar-none pb-4" id="calibration-drawer-scroller">
                {/* Drawer header */}
                <div className="flex justify-between items-center pb-3 border-b border-neutral-900 select-none">
                  <span className="text-[11px] font-bold text-neutral-300 tracking-[0.25em] uppercase flex items-center gap-1.5">
                    <Cpu className={`w-4 h-4 text-${currentTheme.primary}`} />
                    SYSTEM CALIBRATION
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
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
                            borderColor: isSelected ? theme.accent : undefined
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: theme.accent }}
                            />
                            {theme.name}
                          </span>
                          {isSelected && <span className="text-[9px] opacity-65 font-bold">[ACTIVE]</span>}
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
                            borderColor: isSelected ? currentTheme.accent : undefined
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
                      className="hidden"
                    />
                    <div 
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{ backgroundColor: settings.timeFormat24h ? currentTheme.accent : '#262626' }}
                    >
                      <div className={`w-3 h-3 rounded-full bg-black transition-all ${settings.timeFormat24h ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>

                  {/* Seconds clock toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Show Live Seconds readout</span>
                    <input
                      type="checkbox"
                      checked={settings.showSeconds}
                      onChange={(e) => updateSettingField('showSeconds', e.target.checked)}
                      className="hidden"
                    />
                    <div 
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{ backgroundColor: settings.showSeconds ? currentTheme.accent : '#262626' }}
                    >
                      <div className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showSeconds ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>

                  {/* Binary Clock indicator toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Binary Clock Matrix overlay</span>
                    <input
                      type="checkbox"
                      checked={settings.showHexClock}
                      onChange={(e) => updateSettingField('showHexClock', e.target.checked)}
                      className="hidden"
                    />
                    <div 
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{ backgroundColor: settings.showHexClock ? currentTheme.accent : '#262626' }}
                    >
                      <div className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showHexClock ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>

                  {/* ICMP Packet Logging Toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Simulated Networking Pings Log</span>
                    <input
                      type="checkbox"
                      checked={settings.techPingDelaySim}
                      onChange={(e) => updateSettingField('techPingDelaySim', e.target.checked)}
                      className="hidden"
                    />
                    <div 
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{ backgroundColor: settings.techPingDelaySim ? currentTheme.accent : '#262626' }}
                    >
                      <div className={`w-3 h-3 rounded-full bg-black transition-all ${settings.techPingDelaySim ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>

                  {/* Work Hours Progress Tracker Toggle */}
                  <label className="flex items-center justify-between text-xs text-neutral-350 hover:text-white cursor-pointer py-1.5">
                    <span>Work Hours Tracker overlay</span>
                    <input
                      type="checkbox"
                      checked={!!settings.showWorkProgress}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          const start = prompt('Enter shift start time (24h format, e.g., 09:00):', settings.workStart || '09:00');
                          if (start === null) return;
                          const end = prompt('Enter shift end time (24h format, e.g., 17:00):', settings.workEnd || '17:00');
                          if (end === null) return;
                          
                          setSettings((prev) => ({
                            ...prev,
                            showWorkProgress: true,
                            workStart: start,
                            workEnd: end
                          }));
                          addLog('SYS', 'success', `Work tracker activated: ${start} to ${end}`);
                        } else {
                          updateSettingField('showWorkProgress', false);
                        }
                      }}
                      className="hidden"
                    />
                    <div 
                      className="w-8 h-4 rounded-full p-0.5 transition-all"
                      style={{ backgroundColor: settings.showWorkProgress ? currentTheme.accent : '#262626' }}
                    >
                      <div className={`w-3 h-3 rounded-full bg-black transition-all ${settings.showWorkProgress ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>

                  {settings.showWorkProgress && (
                    <div className="pl-4 pb-2 flex gap-4 text-xs font-mono select-none" id="work-hours-adjust-inputs">
                      <div className="flex flex-col">
                        <span className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">Shift Start</span>
                        <input
                          type="text"
                          value={settings.workStart || '09:00'}
                          onChange={(e) => updateSettingField('workStart', e.target.value)}
                          className="w-16 bg-neutral-900 border border-neutral-800 rounded p-1 text-center outline-none text-white focus:border-neutral-700 text-[10.5px]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">Shift End</span>
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
                <div className="space-y-2.5 pt-4 border-t border-neutral-900" id="system-telemetry-backup-wrapper">
                  <span className="text-[11px] text-neutral-400 uppercase tracking-widest block font-bold flex items-center gap-1.5">
                    <FolderSync className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
                    TELEMETRY CALIBRATION BACKUP
                  </span>
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    Export or import customized system nodes (bookmarks) and setup parameters as a JSON telemetry code.
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
                          addLog('SYS', 'success', 'Telemetry configuration backup string copied to clipboard');
                        }
                      }}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Copy Telemetry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const inputVal = telemetryRef.current?.value;
                        if (inputVal) {
                          try {
                            const parsed = JSON.parse(inputVal);
                            if (parsed && typeof parsed === 'object') {
                              if (parsed.settings) {
                                setSettings((prev) => ({ ...prev, ...parsed.settings }));
                              }
                              if (parsed.pinnedSites && Array.isArray(parsed.pinnedSites)) {
                                setPinnedSites(parsed.pinnedSites);
                              }
                              addLog('SYS', 'success', 'System backup telemetry successfully restored');
                              alert('System backup telemetry successfully restored!');
                            } else {
                              alert('Telemetry restore failed: Invalid configuration layout.');
                            }
                          } catch (err) {
                            addLog('SYS', 'warning', 'Restoration sequence failed: Invalid segment format');
                            alert('Restoration failed: Please paste a valid backup JSON format.');
                          }
                        }
                      }}
                      className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all text-center select-none"
                    >
                      Restore System
                    </button>
                  </div>
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
