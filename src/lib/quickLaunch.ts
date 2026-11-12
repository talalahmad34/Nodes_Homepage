/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PinnedSite } from "../types";

// True while the user is typing into a field, so single-key shortcuts stay out of the way.
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Pinned sites whose name or address contains the typed text, best match first:
// names starting with it, then addresses starting with it, then anything containing
// it. Ties keep grid order.
export function matchPinnedSites(
  query: string,
  sites: PinnedSite[],
): PinnedSite[] {
  const q = query.trim().toLowerCase();
  if (!q || q.startsWith("/")) return [];

  const ranked: { site: PinnedSite; rank: number }[] = [];
  for (const site of sites) {
    const title = site.title.toLowerCase();
    const host = hostOf(site.url);
    let rank = -1;
    if (title.startsWith(q)) rank = 0;
    else if (host.startsWith(q)) rank = 1;
    else if (title.includes(q) || host.includes(q)) rank = 2;
    if (rank >= 0) ranked.push({ site, rank });
  }

  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank || (a.site.position ?? 0) - (b.site.position ?? 0),
    )
    .map((entry) => entry.site);
}
