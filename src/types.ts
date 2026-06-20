/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PinnedSite {
  id: string;
  title: string;
  url: string;
  iconType: 'initials' | 'icon' | 'custom';
  iconValue: string; // Initials or Lucide icon name or image URL
  category?: string;
  visitCount: number;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  placeholder: string;
  shortcut: string; // e.g., "/g", "/d", "/w"
  icon: string; // Lucide icon name
}

export interface SystemTheme {
  id: string;
  name: string;
  primary: string;      // Tailwind custom theme color (e.g., "emerald-400")
  secondary: string;    // Secondary tech color
  accent: string;       // Accent light
  bgClass: string;      // Background radial gradient styling
  terminalColor: string;// Color code for terminal aesthetics
}

export interface UserSettings {
  userName: string;
  themeId: string;
  timeFormat24h: boolean;
  showSeconds: boolean;
  searchEngineId: string;
  showHexClock: boolean;
  activeBackground: 'network' | 'starfield' | 'grid';
  showAnalogOverlay: boolean;
  techPingDelaySim: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  module: 'SYS' | 'NET' | 'IO' | 'EXT';
  type: 'info' | 'success' | 'warning' | 'packet';
  message: string;
}
