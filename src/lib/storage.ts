/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Thin wrapper around chrome.storage.sync (free, built into Chrome, syncs via the
// user's existing Google sign-in) with a localStorage mirror so the page still
// works when previewed outside a real extension (e.g. `npm run dev`) and so the
// first paint never has to wait on an async read.

// chrome.storage.sync rejects any single item over 8,192 bytes (key + JSON value).
// Values that fit are stored as-is; larger ones (a long pinned-site list) are split
// into string chunks under `<key>__<n>`, with `{ __chunks: n }` left at `<key>`.
const SYNC_ITEM_BUDGET_BYTES = 7500;
// Characters per chunk. A chunk is JSON-encoded again when stored, which can double
// its length through escaping, and non-ASCII characters take up to 3 bytes each.
const CHUNK_LENGTH = 2000;

interface ChunkHeader {
  __chunks: number;
}

// JSON of the value last read from or written to sync per key — lets `writeSync`
// skip no-op writes and `onSyncChange` ignore this tab's own writes echoing back.
const lastSynced = new Map<string, string>();
// How many chunks each key currently occupies in sync, so a shrinking value can
// remove the chunks it no longer needs.
const chunkCounts = new Map<string, number>();

const chunkKey = (key: string, index: number) => `${key}__${index}`;

function isChunkHeader(value: unknown): value is ChunkHeader {
  return (
    !!value &&
    typeof value === "object" &&
    Number.isInteger((value as ChunkHeader).__chunks) &&
    (value as ChunkHeader).__chunks > 0
  );
}

export function isSyncAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    !!chrome.storage &&
    !!chrome.storage.sync &&
    typeof chrome.runtime !== "undefined" &&
    !!chrome.runtime.id
  );
}

// Synchronous read used only for the initial render, before any async sync lookup
// can resolve, so the homepage paints instantly with the last-known local state.
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage full or unavailable — nothing more we can do locally.
  }
}

function syncGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        resolve(chrome.runtime.lastError ? {} : result || {});
      });
    } catch {
      resolve({});
    }
  });
}

// Turns whatever is stored at `key` back into the original value, reassembling it
// from its chunks when it was too large to store as a single item.
async function resolveStored(key: string, stored: unknown): Promise<unknown> {
  if (!isChunkHeader(stored)) {
    chunkCounts.set(key, 0);
    return stored;
  }

  const count = stored.__chunks;
  chunkCounts.set(key, count);
  const parts = await syncGet(
    Array.from({ length: count }, (_, i) => chunkKey(key, i)),
  );

  let json = "";
  for (let i = 0; i < count; i++) {
    const part = parts[chunkKey(key, i)];
    if (typeof part !== "string") return undefined;
    json += part;
  }
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// Fetches the latest synced values (if any) from chrome.storage.sync so data set
// on another device can override the locally cached copy shortly after load.
// Keys with nothing stored are absent from the result.
export async function readSync(
  keys: string[],
): Promise<Record<string, unknown>> {
  if (!isSyncAvailable()) return {};

  const stored = await syncGet(keys);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = await resolveStored(key, stored[key]);
    if (value === undefined) continue;
    lastSynced.set(key, JSON.stringify(value));
    result[key] = value;
  }
  return result;
}

// Persists a value to chrome.storage.sync when available. Failures (quota, offline)
// are only logged — callers keep their own local copy via `writeLocal`.
export function writeSync(key: string, value: unknown): void {
  if (!isSyncAvailable()) return;

  const json = JSON.stringify(value);
  if (lastSynced.get(key) === json) return;
  lastSynced.set(key, json);

  const items: Record<string, unknown> = {};
  let count = 0;
  if (
    new TextEncoder().encode(json).length + key.length <=
    SYNC_ITEM_BUDGET_BYTES
  ) {
    items[key] = value;
  } else {
    count = Math.ceil(json.length / CHUNK_LENGTH);
    for (let i = 0; i < count; i++) {
      items[chunkKey(key, i)] = json.slice(
        i * CHUNK_LENGTH,
        (i + 1) * CHUNK_LENGTH,
      );
    }
    items[key] = { __chunks: count } satisfies ChunkHeader;
  }

  const staleChunks: string[] = [];
  for (let i = count; i < (chunkCounts.get(key) ?? 0); i++) {
    staleChunks.push(chunkKey(key, i));
  }
  chunkCounts.set(key, count);

  try {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        // Forget the value so the next change retries instead of being deduplicated.
        lastSynced.delete(key);
        console.warn(
          `Sync write skipped for "${key}":`,
          chrome.runtime.lastError.message,
        );
        return;
      }
      if (staleChunks.length > 0) chrome.storage.sync.remove(staleChunks);
    });
  } catch {
    lastSynced.delete(key);
  }
}

// Calls `handler` whenever one of `keys` is changed in chrome.storage.sync by another
// tab or another signed-in device. Returns an unsubscribe function.
export function onSyncChange(
  keys: string[],
  handler: (key: string, value: unknown) => void,
): () => void {
  if (!isSyncAvailable()) return () => {};

  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area !== "sync") return;
    const changedKeys = Object.keys(changes);

    for (const key of keys) {
      const touched = changedKeys.some(
        (changed) => changed === key || changed.startsWith(`${key}__`),
      );
      if (!touched) continue;

      const before = lastSynced.get(key);
      readSync([key]).then((result) => {
        // Unchanged since our last read/write means this was our own write echoing.
        if (!(key in result) || lastSynced.get(key) === before) return;
        handler(key, result[key]);
      });
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
