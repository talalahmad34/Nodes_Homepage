/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Thin wrapper around chrome.storage.sync (free, built into Chrome, syncs via the
// user's existing Google sign-in) with a localStorage mirror so the page still
// works when previewed outside a real extension (e.g. `npm run dev`) and so the
// first paint never has to wait on an async read.

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

// Fetches the latest synced values (if any) from chrome.storage.sync so data set
// on another device can override the locally cached copy shortly after load.
export function readSync(keys: string[]): Promise<Record<string, unknown>> {
  if (!isSyncAvailable()) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch {
      resolve({});
    }
  });
}

// Persists a value locally (always) and to chrome.storage.sync (when available),
// so data survives even if the sync write fails (e.g. quota exceeded, offline).
export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage full or unavailable — nothing more we can do locally.
  }

  if (isSyncAvailable()) {
    try {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          // Likely QUOTA_BYTES_PER_ITEM exceeded — the local copy above still holds.
          console.warn(
            `Sync write skipped for "${key}":`,
            chrome.runtime.lastError.message,
          );
        }
      });
    } catch {
      // Ignore — local copy already saved above.
    }
  }
}
