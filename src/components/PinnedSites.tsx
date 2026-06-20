/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Edit2, Trash2, ArrowUpRight, HelpCircle, LayoutGrid, Globe, Globe2, ShieldCheck, Cpu, GripVertical } from 'lucide-react';
import { PinnedSite, UserSettings } from '../types';

interface PinnedSitesProps {
  settings: UserSettings;
  pinnedSites: PinnedSite[];
  onAddSite: (site: Omit<PinnedSite, 'id' | 'visitCount'>) => void;
  onEditSite: (site: PinnedSite) => void;
  onDeleteSite: (id: string) => void;
  onUpdateSiteVisits: (id: string) => void;
  onReorderSites: (sites: PinnedSite[]) => void;
  addLog: (module: 'SYS' | 'NET' | 'IO' | 'EXT', type: 'info' | 'success' | 'warning' | 'packet', message: string) => void;
}

export default function PinnedSites({
  settings,
  pinnedSites,
  onAddSite,
  onEditSite,
  onDeleteSite,
  onUpdateSiteVisits,
  onReorderSites,
  addLog,
}: PinnedSitesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<PinnedSite | null>(null);

  // Drag and drop ordering states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [hoveredDragIdx, setHoveredDragIdx] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [iconType, setIconType] = useState<'initials' | 'icon' | 'custom'>('initials');
  const [iconValue, setIconValue] = useState('');
  const [category, setCategory] = useState('');

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    addLog('SYS', 'info', `Initiated rearrange calibration on segment node [${pinnedSites[index].title}]`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setHoveredDragIdx(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    const reordered = [...pinnedSites];
    const [removed] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIndex, 0, removed);

    onReorderSites(reordered);
    addLog('SYS', 'success', `Configuration path routed: Moved '${removed.title}' sequence index to ${targetIndex + 1}`);

    setDraggedIdx(null);
    setHoveredDragIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setHoveredDragIdx(null);
  };

  const openAddModal = () => {
    setEditingSite(null);
    setTitle('');
    setUrl('');
    setIconType('initials');
    setIconValue('');
    setCategory('');
    setIsModalOpen(true);
    addLog('SYS', 'info', 'Console opened for registering connection endpoint');
  };

  const openEditModal = (site: PinnedSite) => {
    setEditingSite(site);
    setTitle(site.title);
    setUrl(site.url);
    setIconType(site.iconType);
    setIconValue(site.iconValue);
    setCategory(site.category || '');
    setIsModalOpen(true);
    addLog('SYS', 'info', `Configuration module accessed for endpoint: ${site.title}`);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSite(null);
  };

  const handleUrlBlur = () => {
    // Automatically extract initials if field is empty
    if (!title && url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const parts = parsed.hostname.replace('www.', '').split('.');
        const namePart = parts[0];
        setTitle(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        if (iconType === 'initials' && !iconValue) {
          setIconValue(namePart.substring(0, 2).toUpperCase());
        }
      } catch (err) {
        // Silent error
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    // Check link protocol
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const valueOfIcon = iconValue.trim() || title.substring(0, 2).toUpperCase();

    if (editingSite) {
      onEditSite({
        ...editingSite,
        title: title.trim(),
        url: formattedUrl,
        iconType,
        iconValue: valueOfIcon,
        category: category.trim() || undefined,
      });
      addLog('IO', 'success', `Bookmark endpoint calibrated and saved: ${title}`);
    } else {
      onAddSite({
        title: title.trim(),
        url: formattedUrl,
        iconType,
        iconValue: valueOfIcon,
        category: category.trim() || undefined,
      });
      addLog('IO', 'success', `New bookmark registered: ${title}`);
    }

    closeModal();
  };

  const handleCardClick = (id: string, url: string) => {
    onUpdateSiteVisits(id);
    addLog('NET', 'packet', `Socket stream forwarding: routing client interface -> ${url}`);
    
    // Smooth delay for log visualization then redirect
    setTimeout(() => {
      window.location.href = url;
    }, 150);
  };

  // Group sites by category if desired, or render flat grid
  const categories = Array.from(
    new Set(pinnedSites.map((s) => s.category || 'General'))
  );

  const getThemeColors = () => {
    switch (settings.themeId) {
      case 'emerald': return { text: 'text-emerald-400', border: 'border-emerald-500/20', hoverBorder: 'group-hover:border-emerald-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(52,211,153,0.3)]', glowRGB: '52, 211, 153', modalBtn: 'bg-emerald-500 hover:bg-emerald-600' };
      case 'cyan': return { text: 'text-cyan-400', border: 'border-cyan-500/20', hoverBorder: 'group-hover:border-cyan-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]', glowRGB: '34, 211, 238', modalBtn: 'bg-cyan-500 hover:bg-cyan-600' };
      case 'amber': return { text: 'text-amber-400', border: 'border-amber-500/20', hoverBorder: 'group-hover:border-amber-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]', glowRGB: '251, 191, 36', modalBtn: 'bg-amber-500 hover:bg-amber-600' };
      case 'purple': return { text: 'text-purple-400', border: 'border-purple-500/20', hoverBorder: 'group-hover:border-purple-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(192,132,252,0.3)]', glowRGB: '192, 132, 252', modalBtn: 'bg-purple-500 hover:bg-purple-600' };
      case 'rose': return { text: 'text-rose-400', border: 'border-rose-500/20', hoverBorder: 'group-hover:border-rose-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(251,113,133,0.3)]', glowRGB: '251, 113, 133', modalBtn: 'bg-rose-500 hover:bg-rose-600' };
      default: return { text: 'text-emerald-400', border: 'border-emerald-500/20', hoverBorder: 'group-hover:border-emerald-400/50', iconGlow: 'group-hover:shadow-[0_0_12px_rgba(52,211,153,0.3)]', glowRGB: '52, 211, 153', modalBtn: 'bg-emerald-500 hover:bg-emerald-600' };
    }
  };

  const colors = getThemeColors();

  return (
    <div className="w-full max-w-7xl px-4 mt-4 flex flex-col items-center" id="pinned-node-grid-hub">
      
      {/* Category Tabs & Header */}
      <div className="w-full mb-4 z-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-px flex-grow bg-neutral-800/40"></div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-400 font-mono flex items-center gap-2">
            <LayoutGrid className={`w-3.5 h-3.5 ${colors.text}`} />
            PINNED PROTOCOLS // INDEX ({pinnedSites.length}) [DRAG TO REARRANGE]
          </div>
          <div className="h-px flex-grow bg-neutral-800/40 font-mono"></div>
          
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-mono text-[10px] uppercase py-1 px-3 rounded transition-all duration-300 cursor-pointer"
            id="pin-site-add-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Node
          </button>
        </div>
      </div>

      {/* Grid displays */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full z-10">
        {pinnedSites.map((site, index) => {
          // Generate customized ports for cyber diagnostics feel 
          const simPort = site.url.includes('https') ? 443 : 80;
          const simIndex = index + 1;
          const isDraggedIdx = draggedIdx === index;
          const isHoveredIdx = hoveredDragIdx === index;

          return (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: isDraggedIdx ? 0.35 : 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="group relative bookmark-tile-node"
              draggable={activeDragId === site.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => {
                handleDragEnd();
                setActiveDragId(null);
              }}
              onDragLeave={() => setHoveredDragIdx(null)}
            >
              {/* Floating Holographic Glow Border background */}
              <div 
                className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r from-transparent to-transparent group-hover:from-neutral-800 group-hover:to-neutral-900 transition-all duration-300 pointer-events-none -z-10`}
                style={{
                  boxShadow: isHoveredIdx 
                    ? `0 0 18px rgba(${colors.glowRGB}, 0.25)` 
                    : `0 0 16px rgba(${colors.glowRGB}, var(--tw-hover-glow, 0))`
                }}
              />

              <div
                className={`relative h-[120px] w-full p-4 flex flex-col justify-between rounded-xl border bg-neutral-950/40 backdrop-blur-sm cursor-pointer transition-all duration-300 ${
                  isDraggedIdx 
                    ? 'border-dashed border-neutral-700/85 scale-95 opacity-50 bg-neutral-950/80' 
                    : isHoveredIdx
                      ? `border-neutral-500 scale-102 bg-neutral-900/40 shadow-lg shadow-[rgba(${colors.glowRGB},0.08)]` 
                      : `${colors.border} ${colors.hoverBorder} hover:bg-neutral-900/10`
                }`}
                onClick={() => handleCardClick(site.id, site.url)}
              >
                {/* Tech scanline visual lines within individual bookmark */}
                <div className="absolute right-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-neutral-800/10 to-transparent" />
                
                {/* Visual Top Bar decoration */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-500">
                    <span className="text-neutral-600">ID:</span>
                    <span>0{simIndex}</span>
                    <span className="text-neutral-600 ml-1.5">PORT:</span>
                    <span>{simPort}</span>
                  </div>

                  {/* Settings dropdown / option buttons for modifying bookmarks */}
                  <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(site);
                      }}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSite(site.id);
                      }}
                      className="p-1 rounded hover:bg-rose-950 text-neutral-400 hover:text-rose-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Micro logo representation */}
                <div className="flex items-center space-x-3">
                  <div 
                    className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-neutral-800/60 bg-neutral-900/50 text-sm font-semibold font-mono tracking-wider text-neutral-300 group-hover:text-white group-hover:border-neutral-700 select-none group-shadow transition-all ${colors.iconGlow}`}
                  >
                    {site.iconType === 'initials' && site.iconValue}
                    {site.iconType === 'icon' && (
                      <Globe className="w-4.5 h-4.5 text-neutral-400 group-hover:text-white" />
                    )}
                    {site.iconType === 'custom' && (
                      <span className="text-xs">{site.iconValue.substring(0, 2)}</span>
                    )}
                  </div>

                  {/* Bookmark descriptive metadata */}
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-sm text-neutral-200 font-semibold font-sans group-hover:text-white transition-colors truncate">
                      {site.title}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 truncate mt-0.5 group-hover:text-neutral-300 transition-colors">
                      {site.url.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  </div>
                </div>

                {/* Base status and tracking coordinates inside connection */}
                <div className="flex items-center justify-between w-full pt-1">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-ping`} />
                    <span className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-300 transition-colors uppercase">
                      socket_ok
                    </span>
                  </div>

                  {/* Custom Drag Grip Handle Area */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setActiveDragId(site.id);
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      setActiveDragId(null);
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (draggedIdx === null) {
                        setActiveDragId(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    className="p-1 px-1.5 rounded bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700/80 hover:bg-neutral-850/80 cursor-grab active:cursor-grabbing transition-all text-neutral-500 hover:text-neutral-300 transform group-hover:scale-105"
                    title="Hover to Grab & Drag Node"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {pinnedSites.length === 0 && (
        <div className="text-center py-8 text-neutral-500 font-mono text-xs z-10 w-full border border-dashed border-neutral-900 rounded-2xl flex flex-col items-center justify-center space-y-2">
          <HelpCircle className="w-6 h-6 text-neutral-700" />
          <span>No nodes currently registered in the database grid.</span>
        </div>
      )}

      {/* Cyber Register / Edit Site Overlay popup modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 w-full max-w-sm relative shadow-2xl font-mono overflow-hidden"
              id="node-settings-modal"
            >
              {/* Corner tech decals */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-700" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-neutral-700" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neutral-700" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neutral-700" />

              <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-900">
                <span className={`text-[11px] font-mono text-neutral-400 tracking-[0.2em] font-medium uppercase`}>
                  {editingSite ? 'CALIBRATE CONNECTION_NODE' : 'REGISTER CONNECTION_NODE'}
                </span>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Link URL field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                    Source Link (URL) *
                  </label>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="e.g. github.com"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-600 transition-all font-mono"
                  />
                </div>

                {/* Node label field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                    Node Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. GitHub"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-600 transition-all font-mono"
                  />
                </div>

                {/* Icon option field */}
                <div className="grid grid-cols-2 gap-2 pb-1.5">
                  <button
                    type="button"
                    onClick={() => { setIconType('initials'); }}
                    className={`p-2 rounded-lg border text-[10px] text-center transition-all cursor-pointer ${
                      iconType === 'initials'
                        ? `${colors.border} bg-neutral-900 text-white`
                        : 'border-neutral-900 text-neutral-500 hover:text-neutral-400'
                    }`}
                  >
                    Custom Initials
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIconType('icon'); setIconValue('globe'); }}
                    className={`p-2 rounded-lg border text-[10px] text-center transition-all cursor-pointer ${
                      iconType === 'icon'
                        ? `${colors.border} bg-neutral-900 text-white`
                        : 'border-neutral-900 text-neutral-500 hover:text-neutral-400'
                    }`}
                  >
                    Globe Icon
                  </button>
                </div>

                {/* Dynamic Icon character value input depending on type selection */}
                {iconType === 'initials' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                      Custom Icon Initials (Max 1-2 Chars)
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={iconValue}
                      onChange={(e) => setIconValue(e.target.value.toUpperCase())}
                      placeholder="e.g. GH"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-600 transition-all font-mono"
                    />
                  </div>
                )}

                {/* Category label field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                    Category Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Development, Social"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-600 transition-all font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-2 border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-all text-xs rounded-lg uppercase tracking-wider cursor-pointer"
                  >
                    Abort
                  </button>
                  <button
                    type="submit"
                    className={`p-2 text-neutral-950 font-bold ${colors.modalBtn} transition-all text-xs rounded-lg uppercase tracking-wider cursor-pointer`}
                  >
                    Save Config
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
