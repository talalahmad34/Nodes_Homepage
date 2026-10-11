/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence, useSpring } from "motion/react";
import {
  Plus,
  X,
  Edit2,
  Trash2,
  HelpCircle,
  LayoutGrid,
  Globe,
  Globe2,
  GripVertical,
} from "lucide-react";
import { PinnedSite, UserSettings } from "../types";
import {
  BTN_HOVER,
  BTN_TAP,
  BTN_SPRING,
  CARD_HOVER,
  CARD_TAP,
  CARD_SPRING,
  TILT_MAX_DEG,
  TILT_SPRING,
} from "../lib/motion";
import { emitPulse } from "../lib/pulseBus";
import { trackCursorLight } from "../lib/cursorLight";
import WarpBurst, { WARP_BURST_MS } from "./WarpBurst";
import {
  TILE_BOOT_DELAY,
  TILE_BOOT_STAGGER,
  isBooting,
  msUntilBootEnds,
} from "../lib/boot";

// Free, no-key-required favicon lookup service — used for the "Site Favicon" icon option.
const getFaviconUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(
      rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`,
    );
    return `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`;
  } catch {
    return "";
  }
};

// Renders a fetched favicon, falling back to text initials if the image fails to load.
function SiteFavicon({ site }: { site: PinnedSite }) {
  const [failed, setFailed] = useState(false);

  if (failed || !site.iconValue) {
    return (
      <span className="text-xs">
        {site.title.substring(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={site.iconValue}
      alt=""
      className="w-6 h-6 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// Tilts its contents in 3D toward the cursor, giving the bookmark grid a holographic
// feel. Rotation is spring-driven off the pointer's offset from the element centre and
// released back to flat on leave.
//
// This deliberately owns *only* the tilt transform: Framer Motion lets either the
// `animate` prop or `style` motion values drive an element's transform, not both, so the
// caller's entry/tap animations must live on a separate parent element or the rotation
// here is silently discarded.
function TiltCard({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    trackCursorLight(e);
    rotateY.set(px * TILT_MAX_DEG * 2);
    rotateX.set(-py * TILT_MAX_DEG * 2);
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 700,
        transformStyle: "preserve-3d",
      }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}

interface PinnedSitesProps {
  settings: UserSettings;
  pinnedSites: PinnedSite[];
  onAddSite: (site: Omit<PinnedSite, "id" | "visitCount">) => void;
  onEditSite: (site: PinnedSite) => void;
  onDeleteSite: (id: string) => void;
  onUpdateSiteVisits: (id: string) => void;
  onReorderSites: (sites: PinnedSite[]) => void;
  addLog: (
    module: "SYS" | "NET" | "IO" | "EXT",
    type: "info" | "success" | "warning" | "packet",
    message: string,
  ) => void;
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
  // While the tab is booting, tiles wait for the clock and search bar and then drop
  // in as a wave. Afterwards (e.g. a node added later) they appear straight away.
  const [bootDelay, setBootDelay] = useState(() =>
    isBooting() ? TILE_BOOT_DELAY : 0,
  );
  React.useEffect(() => {
    const timer = setTimeout(() => setBootDelay(0), msUntilBootEnds());
    return () => clearTimeout(timer);
  }, []);
  const [editingSite, setEditingSite] = useState<PinnedSite | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Position of the most recent tile activation, used to render the launch burst overlay.
  // `seq` only has to differ between consecutive launches so WarpBurst remounts the
  // burst and replays it, even when the same tile is activated twice.
  const [launch, setLaunch] = useState<{
    seq: number;
    x: number;
    y: number;
  } | null>(null);
  const launchSeqRef = React.useRef(0);
  const confirmDeleteTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const requestDelete = (site: PinnedSite) => {
    if (confirmDeleteId === site.id) {
      if (confirmDeleteTimerRef.current)
        clearTimeout(confirmDeleteTimerRef.current);
      setConfirmDeleteId(null);
      onDeleteSite(site.id);
      return;
    }
    setConfirmDeleteId(site.id);
    if (confirmDeleteTimerRef.current)
      clearTimeout(confirmDeleteTimerRef.current);
    confirmDeleteTimerRef.current = setTimeout(
      () => setConfirmDeleteId(null),
      3000,
    );
  };

  const [isManualGrid, setIsManualGrid] = useState(() => {
    try {
      return localStorage.getItem("netgrid_manual_grid") === "true";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    localStorage.setItem("netgrid_manual_grid", String(isManualGrid));
  }, [isManualGrid]);

  // Ensure every site has a unique position
  const sitesWithPositions = React.useMemo(() => {
    let updated = false;
    const resolved = pinnedSites.map((s) => ({ ...s }));

    resolved.forEach((site) => {
      if (site.position === undefined) {
        let emptyPos = 0;
        while (resolved.some((s) => s.position === emptyPos)) {
          emptyPos++;
        }
        site.position = emptyPos;
        updated = true;
      }
    });

    if (updated) {
      setTimeout(() => onReorderSites(resolved), 0);
    }

    return resolved.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [pinnedSites, onReorderSites]);

  // Calculate grid dimensions (full rows of 8, minimum 16)
  const totalSlotsCount = React.useMemo(() => {
    const maxPos = sitesWithPositions.reduce(
      (max, s) => Math.max(max, s.position ?? 0),
      0,
    );
    const count = Math.max(16, maxPos + 1);
    return Math.ceil(count / 8) * 8;
  }, [sitesWithPositions]);

  // Drag and drop ordering states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [hoveredDragIdx, setHoveredDragIdx] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [iconType, setIconType] = useState<"initials" | "icon" | "custom">(
    "initials",
  );
  const [iconValue, setIconValue] = useState("");
  const [category, setCategory] = useState("");

  const handleDragStart = (e: React.DragEvent, positionIndex: number) => {
    setDraggedIdx(positionIndex);
    e.dataTransfer.effectAllowed = "move";
    const site = sitesWithPositions.find((s) => s.position === positionIndex);
    if (site) {
      addLog(
        "SYS",
        "info",
        `Initiated rearrange calibration on node [${site.title}]`,
      );
    }
  };

  const handleDragOver = (e: React.DragEvent, positionIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === positionIndex) return;
    setHoveredDragIdx(positionIndex);
  };

  const handleDrop = (e: React.DragEvent, targetPosition: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetPosition) return;

    const sourceSite = sitesWithPositions.find(
      (s) => s.position === draggedIdx,
    );
    const targetSite = sitesWithPositions.find(
      (s) => s.position === targetPosition,
    );

    if (sourceSite) {
      const updated = sitesWithPositions.map((s) => {
        if (s.id === sourceSite.id) {
          return { ...s, position: targetPosition };
        }
        if (targetSite && s.id === targetSite.id) {
          return { ...s, position: draggedIdx };
        }
        return s;
      });
      onReorderSites(updated);
      addLog(
        "SYS",
        "success",
        `Configuration path routed: Moved '${sourceSite.title}' to slot ${targetPosition + 1}`,
      );
    }

    setDraggedIdx(null);
    setHoveredDragIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setHoveredDragIdx(null);
  };

  // Keyboard-accessible alternative to mouse drag-and-drop: swaps a node with
  // whichever node (if any) currently occupies the adjacent slot.
  const moveByKeyboard = (site: PinnedSite, direction: -1 | 1) => {
    const currentPosition = site.position ?? 0;
    const targetPosition = currentPosition + direction;
    if (targetPosition < 0) return;

    const targetSite = sitesWithPositions.find(
      (s) => s.position === targetPosition,
    );
    const updated = sitesWithPositions.map((s) => {
      if (s.id === site.id) return { ...s, position: targetPosition };
      if (targetSite && s.id === targetSite.id)
        return { ...s, position: currentPosition };
      return s;
    });
    onReorderSites(updated);
    addLog(
      "SYS",
      "success",
      `Configuration path routed: Moved '${site.title}' to slot ${targetPosition + 1}`,
    );
  };

  const handleGripKeyDown = (e: React.KeyboardEvent, site: PinnedSite) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveByKeyboard(site, -1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveByKeyboard(site, 1);
    }
  };

  const openAddModal = () => {
    setEditingSite(null);
    setTitle("");
    setUrl("");
    setIconType("initials");
    setIconValue("");
    setCategory("");
    setIsModalOpen(true);
    addLog("SYS", "info", "Console opened for registering connection endpoint");
  };

  const openEditModal = (site: PinnedSite) => {
    setEditingSite(site);
    setTitle(site.title);
    setUrl(site.url);
    setIconType(site.iconType);
    setIconValue(site.iconValue);
    setCategory(site.category || "");
    setIsModalOpen(true);
    addLog(
      "SYS",
      "info",
      `Configuration module accessed for endpoint: ${site.title}`,
    );
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSite(null);
  };

  const handleUrlBlur = () => {
    // Automatically extract initials if field is empty
    if (!title && url) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        const parts = parsed.hostname.replace("www.", "").split(".");
        const namePart = parts[0];
        setTitle(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        if (iconType === "initials" && !iconValue) {
          setIconValue(namePart.substring(0, 2).toUpperCase());
        }
      } catch {
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

    const valueOfIcon =
      iconType === "custom"
        ? getFaviconUrl(formattedUrl) || iconValue.trim()
        : iconValue.trim() || title.substring(0, 2).toUpperCase();

    if (editingSite) {
      onEditSite({
        ...editingSite,
        title: title.trim(),
        url: formattedUrl,
        iconType,
        iconValue: valueOfIcon,
        category: category.trim() || undefined,
      });
      addLog(
        "IO",
        "success",
        `Bookmark endpoint calibrated and saved: ${title}`,
      );
    } else {
      onAddSite({
        title: title.trim(),
        url: formattedUrl,
        iconType,
        iconValue: valueOfIcon,
        category: category.trim() || undefined,
      });
      addLog("IO", "success", `New bookmark registered: ${title}`);
    }

    closeModal();
  };

  // Kicks off the visual "packet launch" from a tile: a ripple on the background canvas
  // at the tile's centre, plus an overlay burst rendered at that point.
  const launchPacketFrom = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    emitPulse(cx, cy);
    launchSeqRef.current += 1;
    const seq = launchSeqRef.current;
    setLaunch({ seq, x: cx, y: cy });
    // Unmount once the keyframes have finished, unless a newer burst replaced it
    setTimeout(() => {
      setLaunch((current) => (current?.seq === seq ? null : current));
    }, WARP_BURST_MS);
  };

  // Tiles are real links, so the browser handles everything except a plain left
  // click: Ctrl/Cmd/Shift-click, middle-click and the context menu open the site in
  // a new tab or window natively, and Enter activates a focused tile.
  const handleCardClick = (e: React.MouseEvent, id: string, url: string) => {
    const opensElsewhere = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;
    onUpdateSiteVisits(id);
    addLog(
      "NET",
      "packet",
      `Socket stream forwarding: routing client interface${opensElsewhere ? " (new tab)" : ""} -> ${url}`,
    );

    launchPacketFrom(e.currentTarget as HTMLElement);
    if (opensElsewhere) return;

    // Give the launch animation a beat to play before the page navigates away
    e.preventDefault();
    setTimeout(() => {
      window.location.href = url;
    }, 380);
  };

  const handleCardMiddleClick = (
    e: React.MouseEvent,
    id: string,
    url: string,
  ) => {
    onUpdateSiteVisits(id);
    addLog(
      "NET",
      "packet",
      `Socket stream forwarding: routing client interface (new tab) -> ${url}`,
    );
    launchPacketFrom(e.currentTarget as HTMLElement);
  };

  // Escape closes the add/edit form
  React.useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setEditingSite(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const getThemeColors = () => {
    switch (settings.themeId) {
      case "emerald":
        return {
          text: "text-emerald-400",
          border: "border-emerald-500/20",
          hoverBorder: "group-hover:border-emerald-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(52,211,153,0.3)]",
          glowRGB: "52, 211, 153",
          modalBtn: "bg-emerald-500 hover:bg-emerald-600",
        };
      case "cyan":
        return {
          text: "text-cyan-400",
          border: "border-cyan-500/20",
          hoverBorder: "group-hover:border-cyan-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]",
          glowRGB: "34, 211, 238",
          modalBtn: "bg-cyan-500 hover:bg-cyan-600",
        };
      case "amber":
        return {
          text: "text-amber-400",
          border: "border-amber-500/20",
          hoverBorder: "group-hover:border-amber-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]",
          glowRGB: "251, 191, 36",
          modalBtn: "bg-amber-500 hover:bg-amber-600",
        };
      case "purple":
        return {
          text: "text-purple-400",
          border: "border-purple-500/20",
          hoverBorder: "group-hover:border-purple-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(192,132,252,0.3)]",
          glowRGB: "192, 132, 252",
          modalBtn: "bg-purple-500 hover:bg-purple-600",
        };
      case "rose":
        return {
          text: "text-rose-400",
          border: "border-rose-500/20",
          hoverBorder: "group-hover:border-rose-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(251,113,133,0.3)]",
          glowRGB: "251, 113, 133",
          modalBtn: "bg-rose-500 hover:bg-rose-600",
        };
      default:
        return {
          text: "text-emerald-400",
          border: "border-emerald-500/20",
          hoverBorder: "group-hover:border-emerald-400/30",
          iconGlow: "group-hover:shadow-[0_0_12px_rgba(52,211,153,0.3)]",
          glowRGB: "52, 211, 153",
          modalBtn: "bg-emerald-500 hover:bg-emerald-600",
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div
      className="w-full max-w-none px-2 mt-2 flex flex-col items-center"
      id="pinned-node-grid-hub"
    >
      {/* Category Tabs & Header */}
      <div className="w-full mb-4 z-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-px flex-grow bg-neutral-800/40"></div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-400 font-mono flex items-center gap-2">
            <LayoutGrid className={`w-3.5 h-3.5 ${colors.text}`} />
            PINNED PROTOCOLS // INDEX ({pinnedSites.length}) [DRAG OR ARROW KEYS
            TO REARRANGE]
          </div>
          <div className="h-px flex-grow bg-neutral-800/40 font-mono"></div>

          {/* Manual Grid Toggle Button */}
          <motion.button
            whileHover={BTN_HOVER}
            whileTap={BTN_TAP}
            transition={BTN_SPRING}
            onClick={() => setIsManualGrid(!isManualGrid)}
            className={`flex items-center gap-1.5 border font-mono text-[10px] uppercase py-1 px-3 rounded transition-colors duration-300 cursor-pointer ${
              isManualGrid
                ? "bg-neutral-900 text-white shadow-md"
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-300 hover:border-neutral-700"
            }`}
            style={
              isManualGrid
                ? {
                    borderColor: colors.text.includes("emerald")
                      ? "#34d399"
                      : colors.text.includes("cyan")
                        ? "#22d3ee"
                        : colors.text.includes("amber")
                          ? "#fbbf24"
                          : colors.text.includes("purple")
                            ? "#c084fc"
                            : "#fb7185",
                  }
                : undefined
            }
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {isManualGrid ? "Grid Mode: ON" : "Manual Grid"}
          </motion.button>

          <motion.button
            whileHover={BTN_HOVER}
            whileTap={BTN_TAP}
            transition={BTN_SPRING}
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-mono text-[10px] uppercase py-1 px-3 rounded transition-colors duration-300 cursor-pointer"
            id="pin-site-add-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Node
          </motion.button>
        </div>
      </div>

      {/* Grid displays */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 w-full z-10">
        {(isManualGrid
          ? Array.from({ length: totalSlotsCount }, (_, i) => i)
          : sitesWithPositions.map((s) => s.position ?? 0)
        ).map((posIndex, index) => {
          const site = sitesWithPositions.find((s) => s.position === posIndex);

          if (!site) {
            const isHoveredSlot = hoveredDragIdx === posIndex;
            const isDraggingActive = draggedIdx !== null;
            return (
              <div
                key={`empty-slot-${posIndex}`}
                onDragOver={(e) => handleDragOver(e, posIndex)}
                onDrop={(e) => handleDrop(e, posIndex)}
                onDragLeave={() => setHoveredDragIdx(null)}
                className={`relative h-[110px] w-full p-3 rounded-xl border border-dashed backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center font-mono select-none ${
                  isDraggingActive
                    ? isHoveredSlot
                      ? "border-neutral-400 bg-neutral-900/30 scale-102"
                      : "border-neutral-800 bg-neutral-950/10"
                    : "border-transparent bg-transparent"
                }`}
              >
                {isDraggingActive && (
                  <>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                      Slot {String(posIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[8.5px] text-neutral-600 mt-1 uppercase tracking-widest">
                      Empty Node
                    </span>
                  </>
                )}
              </div>
            );
          }

          const simPort = site.url.includes("https") ? 443 : 80;
          const simIndex = posIndex + 1;
          const isDraggedIdx = draggedIdx === posIndex;
          const isHoveredIdx = hoveredDragIdx === posIndex;

          return (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: bootDelay ? -18 : 12, scale: 0.95 }}
              animate={{
                opacity: isDraggedIdx ? 0.35 : 1,
                y: 0,
                scale: 1,
                transition: {
                  delay:
                    bootDelay + index * (bootDelay ? TILE_BOOT_STAGGER : 0.02),
                  type: "spring",
                  stiffness: 240,
                  damping: 20,
                },
              }}
              whileHover={
                isDraggedIdx
                  ? undefined
                  : { ...CARD_HOVER, transition: CARD_SPRING }
              }
              whileTap={
                isDraggedIdx
                  ? undefined
                  : { ...CARD_TAP, transition: CARD_SPRING }
              }
              className="group relative bookmark-tile-node"
              draggable={activeDragId === site.id}
              onDragStart={(e) => handleDragStart(e, posIndex)}
              onDragOver={(e) => handleDragOver(e, posIndex)}
              onDrop={(e) => handleDrop(e, posIndex)}
              onDragEnd={() => {
                handleDragEnd();
                setActiveDragId(null);
              }}
              onDragLeave={() => setHoveredDragIdx(null)}
            >
              <TiltCard disabled={isDraggedIdx}>
                {/* Floating Holographic Glow Border background */}
                <div
                  className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r from-transparent to-transparent group-hover:from-neutral-800 group-hover:to-neutral-900 transition-all duration-300 pointer-events-none -z-10`}
                  style={{
                    boxShadow: isHoveredIdx
                      ? `0 0 18px rgba(${colors.glowRGB}, 0.25)`
                      : `0 0 16px rgba(${colors.glowRGB}, var(--tw-hover-glow, 0))`,
                  }}
                />

                <a
                  href={site.url}
                  // The tile is reordered by its grip handle; without this the
                  // browser would start dragging the link itself instead.
                  draggable={false}
                  className={`relative h-[110px] w-full p-3 flex flex-col justify-between rounded-xl border glass-panel cursor-light cursor-pointer transition-all duration-300 outline-none focus-visible:border-neutral-400 ${
                    isDraggedIdx
                      ? "border-dashed border-neutral-700/85 scale-95 opacity-50 bg-neutral-950/60"
                      : isHoveredIdx
                        ? `border-neutral-500 scale-102 bg-neutral-900/35 shadow-lg shadow-[rgba(${colors.glowRGB},0.08)]`
                        : `border-white/[0.07] ${colors.hoverBorder} hover:bg-neutral-900/35`
                  }`}
                  onClick={(e) => handleCardClick(e, site.id, site.url)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      handleCardMiddleClick(e, site.id, site.url);
                    }
                  }}
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
                    <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        transition={BTN_SPRING}
                        onClick={(e) => {
                          // preventDefault: the button sits inside the tile's link
                          e.preventDefault();
                          e.stopPropagation();
                          openEditModal(site);
                        }}
                        aria-label={`Edit ${site.title}`}
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        transition={BTN_SPRING}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          requestDelete(site);
                        }}
                        aria-label={
                          confirmDeleteId === site.id
                            ? `Confirm delete ${site.title}`
                            : `Delete ${site.title}`
                        }
                        title={
                          confirmDeleteId === site.id
                            ? "Click again to confirm"
                            : undefined
                        }
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          confirmDeleteId === site.id
                            ? "bg-rose-950 text-rose-400 animate-pulse"
                            : "hover:bg-rose-950 text-neutral-400 hover:text-rose-400"
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Micro logo representation */}
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-neutral-800/60 bg-neutral-900/50 text-sm font-semibold font-mono tracking-wider text-neutral-300 group-hover:text-white group-hover:border-neutral-700 select-none group-shadow transition-all overflow-hidden ${colors.iconGlow}`}
                    >
                      {site.iconType === "initials" && site.iconValue}
                      {site.iconType === "icon" && (
                        <Globe className="w-4.5 h-4.5 text-neutral-400 group-hover:text-white" />
                      )}
                      {site.iconType === "custom" && (
                        <SiteFavicon site={site} />
                      )}
                    </div>

                    {/* Bookmark descriptive metadata */}
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="text-sm text-neutral-200 font-semibold font-sans group-hover:text-white transition-colors truncate">
                        {site.title}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 truncate mt-0.5 group-hover:text-neutral-300 transition-colors">
                        {site.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </span>
                    </div>
                  </div>

                  {/* Base status and tracking coordinates inside connection */}
                  <div className="flex items-center justify-between w-full pt-1">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-ping`}
                      />
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
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        handleGripKeyDown(e, site);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Reorder ${site.title}. Use arrow keys to move it earlier or later in the grid.`}
                      className="p-1 px-1.5 rounded bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700/80 hover:bg-neutral-850/80 focus:border-neutral-500 focus:outline-none cursor-grab active:cursor-grabbing transition-all text-neutral-500 hover:text-neutral-300 transform group-hover:scale-105"
                      title="Hover to Grab & Drag, or focus and use Arrow keys to reorder"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </a>
              </TiltCard>
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

      {/* Launch burst: fired from the centre of an activated tile as the navigation is
          queued, reading as the outbound socket stream leaving the node. */}
      {launch && <WarpBurst seq={launch.seq} x={launch.x} y={launch.y} />}

      {/* Cyber Register / Edit Site Overlay popup modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* Backdrop click closer */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={closeModal}
            />
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
                <span
                  className={`text-[11px] font-mono text-neutral-400 tracking-[0.2em] font-medium uppercase`}
                >
                  {editingSite
                    ? "CALIBRATE CONNECTION_NODE"
                    : "REGISTER CONNECTION_NODE"}
                </span>
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.85 }}
                  transition={BTN_SPRING}
                  type="button"
                  onClick={closeModal}
                  aria-label="Close node registration form"
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
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
                <div className="grid grid-cols-3 gap-2 pb-1.5">
                  <motion.button
                    whileHover={BTN_HOVER}
                    whileTap={BTN_TAP}
                    transition={BTN_SPRING}
                    type="button"
                    onClick={() => {
                      setIconType("initials");
                    }}
                    className={`p-2 rounded-lg border text-[10px] text-center transition-colors cursor-pointer ${
                      iconType === "initials"
                        ? `${colors.border} bg-neutral-900 text-white`
                        : "border-neutral-900 text-neutral-500 hover:text-neutral-400"
                    }`}
                  >
                    Initials
                  </motion.button>
                  <motion.button
                    whileHover={BTN_HOVER}
                    whileTap={BTN_TAP}
                    transition={BTN_SPRING}
                    type="button"
                    onClick={() => {
                      setIconType("custom");
                      setIconValue(getFaviconUrl(url));
                    }}
                    className={`p-2 rounded-lg border text-[10px] text-center transition-colors cursor-pointer ${
                      iconType === "custom"
                        ? `${colors.border} bg-neutral-900 text-white`
                        : "border-neutral-900 text-neutral-500 hover:text-neutral-400"
                    }`}
                  >
                    Site Favicon
                  </motion.button>
                  <motion.button
                    whileHover={BTN_HOVER}
                    whileTap={BTN_TAP}
                    transition={BTN_SPRING}
                    type="button"
                    onClick={() => {
                      setIconType("icon");
                      setIconValue("globe");
                    }}
                    className={`p-2 rounded-lg border text-[10px] text-center transition-colors cursor-pointer ${
                      iconType === "icon"
                        ? `${colors.border} bg-neutral-900 text-white`
                        : "border-neutral-900 text-neutral-500 hover:text-neutral-400"
                    }`}
                  >
                    Globe Icon
                  </motion.button>
                </div>

                {iconType === "custom" && (
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 -mt-1 pb-1.5">
                    <div className="w-6 h-6 rounded border border-neutral-800 bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0">
                      {url ? (
                        <img
                          src={getFaviconUrl(url)}
                          alt=""
                          className="w-4 h-4 object-contain"
                        />
                      ) : (
                        <Globe2 className="w-3 h-3 text-neutral-600" />
                      )}
                    </div>
                    <span>Auto-detected from the source link above.</span>
                  </div>
                )}

                {/* Dynamic Icon character value input depending on type selection */}
                {iconType === "initials" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                      Custom Icon Initials (Max 1-2 Chars)
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={iconValue}
                      onChange={(e) =>
                        setIconValue(e.target.value.toUpperCase())
                      }
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
                  <motion.button
                    whileHover={BTN_HOVER}
                    whileTap={BTN_TAP}
                    transition={BTN_SPRING}
                    type="button"
                    onClick={closeModal}
                    className="p-2 border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors text-xs rounded-lg uppercase tracking-wider cursor-pointer"
                  >
                    Abort
                  </motion.button>
                  <motion.button
                    whileHover={BTN_HOVER}
                    whileTap={BTN_TAP}
                    transition={BTN_SPRING}
                    type="submit"
                    className={`p-2 text-neutral-950 font-bold ${colors.modalBtn} transition-colors text-xs rounded-lg uppercase tracking-wider cursor-pointer`}
                  >
                    Save Config
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
