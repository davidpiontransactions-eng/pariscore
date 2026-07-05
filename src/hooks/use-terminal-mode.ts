"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "setpoint-terminal-mode";

/**
 * Read the terminal mode flag from localStorage.
 *
 * The mode is stored as a JSON-encoded boolean. Anything that doesn't
 * strictly parse to `true` is treated as `false` (the simple-mode default),
 * so a missing key or a corrupted value never accidentally enables the
 * dense power-user layout.
 */
function readTerminalMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed === true;
  } catch {
    return false;
  }
}

function writeTerminalMode(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage may be disabled (private mode, quota, ...) — silently ignore
  }
}

// --- Singleton state shared across all hook instances -----------------------
// Same pattern as use-favorites / use-bankroll: one module-level cache,
// one listener Set, multi-tab sync via the `storage` event. This keeps
// every component using `useTerminalMode()` in lock-step without requiring
// a context provider.
let cachedTerminalMode = false;
let initialized = false;
const listeners = new Set<(v: boolean) => void>();

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  cachedTerminalMode = readTerminalMode();
  // Sync across tabs / windows — fires when another document writes to
  // the same localStorage key. We re-read and fan out to all subscribers.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedTerminalMode = readTerminalMode();
      listeners.forEach((fn) => fn(cachedTerminalMode));
    }
  });
}

function setTerminalMode(next: boolean) {
  cachedTerminalMode = next;
  writeTerminalMode(next);
  listeners.forEach((fn) => fn(next));
}

/**
 * Singleton hook for the terminal mode toggle.
 *
 * Returns:
 *  - `terminalMode`: whether the dense power-user layout is currently active
 *    (default `false` = simple mode).
 *  - `toggle()`: flip the current mode and persist it.
 *  - `setTerminalMode(v)`: set an explicit value (used by tests / future
 *    settings panel).
 *
 * Multi-tab sync is handled via the `storage` event. The initial
 * render uses `cachedTerminalMode` (false on the server / first paint)
 * to avoid hydration mismatches, then syncs from localStorage inside a
 * `useEffect` via a deferred `Promise.resolve().then(...)` — this
 * respects the `react-hooks/set-state-in-effect` rule the same way
 * `use-favorites` and `use-bankroll` do.
 */
export function useTerminalMode() {
  const [terminalMode, setLocalTerminalMode] = useState<boolean>(cachedTerminalMode);

  useEffect(() => {
    init();
    // Sync from the (possibly just-read) singleton cache. Deferred to a
    // microtask so we never call setState synchronously inside the effect
    // body — this is the convention established by use-favorites/use-bankroll
    // and keeps `react-hooks/set-state-in-effect` happy.
    if (cachedTerminalMode !== terminalMode) {
      Promise.resolve().then(() => setLocalTerminalMode(cachedTerminalMode));
    }
    const listener = (v: boolean) => setLocalTerminalMode(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
    // We intentionally only depend on `terminalMode` — the same shape as
    // the other singleton hooks. Re-running when the value flips lets us
    // reconcile if the cache drifted from the local state (e.g. another
    // tab just toggled it).
  }, [terminalMode]);

  const toggle = useCallback(() => {
    setTerminalMode(!cachedTerminalMode);
  }, []);

  const setMode = useCallback((v: boolean) => {
    setTerminalMode(v);
  }, []);

  return {
    terminalMode,
    toggle,
    setTerminalMode: setMode,
  };
}
