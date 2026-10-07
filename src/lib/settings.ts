/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PinnedSite, UserSettings } from "../types";
import { DEFAULT_AI_PORTAL_IDS } from "./aiPortals";

export const DEFAULT_SETTINGS: UserSettings = {
  userName: "Operator",
  themeId: "cyan",
  timeFormat24h: true,
  showSeconds: true,
  searchEngineId: "duckduckgo",
  showHexClock: true,
  activeBackground: "orbit",
  clockStyle: "cyber",
  aiPortalIds: DEFAULT_AI_PORTAL_IDS,
  techPingDelaySim: true,
  showWorkProgress: false,
  workStart: "09:00",
  workEnd: "17:00",
};

const BACKGROUNDS = ["orbit", "starfield", "grid"] as const;
const CLOCK_STYLES = ["cyber", "minimal", "analog"] as const;

// Normalizes an "H:MM" / "HH:MM" string to zero-padded "HH:MM", or returns the
// fallback when it isn't a real time of day.
function toTimeOfDay(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

// Rebuilds a full, well-typed settings object from data that can't be trusted to
// have the current shape — localStorage written by an older version, a value synced
// from another device, or a pasted/imported backup. Anything missing or of the wrong
// type falls back to its default, so the UI never renders from a malformed field.
export function sanitizeSettings(raw: unknown): UserSettings {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaults = DEFAULT_SETTINGS;

  const str = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;
  const oneOf = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    fallback: T,
  ): T => (allowed.includes(value as T) ? (value as T) : fallback);

  return {
    userName: str(src.userName, defaults.userName),
    themeId: str(src.themeId, defaults.themeId),
    timeFormat24h: bool(src.timeFormat24h, defaults.timeFormat24h),
    showSeconds: bool(src.showSeconds, defaults.showSeconds),
    searchEngineId: str(src.searchEngineId, defaults.searchEngineId),
    showHexClock: bool(src.showHexClock, defaults.showHexClock),
    activeBackground: oneOf(
      src.activeBackground,
      BACKGROUNDS,
      defaults.activeBackground,
    ),
    clockStyle: oneOf(src.clockStyle, CLOCK_STYLES, defaults.clockStyle),
    aiPortalIds: Array.isArray(src.aiPortalIds)
      ? [
          ...new Set(
            src.aiPortalIds.filter(
              (id): id is string => typeof id === "string",
            ),
          ),
        ]
      : defaults.aiPortalIds,
    techPingDelaySim: bool(src.techPingDelaySim, defaults.techPingDelaySim),
    showWorkProgress: bool(src.showWorkProgress, false),
    workStart: toTimeOfDay(src.workStart, "09:00"),
    workEnd: toTimeOfDay(src.workEnd, "17:00"),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Structural validation for a single pinned site from an untrusted source — guards
// against e.g. an array of plain strings, and against non-web link targets.
export function isValidPinnedSite(value: unknown): value is PinnedSite {
  if (!value || typeof value !== "object") return false;
  const site = value as Record<string, unknown>;
  return (
    typeof site.id === "string" &&
    typeof site.title === "string" &&
    typeof site.url === "string" &&
    isHttpUrl(site.url) &&
    (site.iconType === "initials" ||
      site.iconType === "icon" ||
      site.iconType === "custom") &&
    typeof site.iconValue === "string" &&
    typeof site.visitCount === "number" &&
    Number.isFinite(site.visitCount) &&
    (site.category === undefined || typeof site.category === "string") &&
    (site.position === undefined ||
      (typeof site.position === "number" && Number.isInteger(site.position)))
  );
}

// Keeps only the well-formed entries of a stored/synced site list.
export function sanitizePinnedSites(raw: unknown[]): PinnedSite[] {
  return raw.filter(isValidPinnedSite);
}
