"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// === Types ===
export type ConsentStatus = "necessary" | "all" | "analytics-only" | "rejected" | "pending";

export type ConsentState = {
  status: ConsentStatus;
  analytics: boolean;
  marketing: boolean;
  // Necessary is always true
  necessary: true;
  // Timestamp of consent
  grantedAt: string | null;
};

const DEFAULT_STATE: ConsentState = {
  status: "pending",
  analytics: false,
  marketing: false,
  necessary: true,
  grantedAt: null,
};

const STORAGE_KEY = "setpoint-consent";
const COOKIE_KEY = "setpoint-consent";
const COOKIE_TTL_DAYS = 180;

// === Context ===
type ConsentContextValue = {
  state: ConsentState;
  hasDecided: boolean;
  acceptAll: () => void;
  acceptAnalyticsOnly: () => void;
  rejectAll: () => void;
  reset: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

// === Helpers ===
function readConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Fallback: check cookie
      const cookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${COOKIE_KEY}=`));
      if (cookie) {
        const value = cookie.split("=")[1];
        return deserializeConsent(value);
      }
      return DEFAULT_STATE;
    }
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function deserializeConsent(value: string): ConsentState {
  // Compact format: "all|1234567890" or "a|1234567890" or "n|1234567890"
  const [code, ts] = value.split("|");
  const grantedAt = ts ? new Date(parseInt(ts, 10)).toISOString() : null;
  switch (code) {
    case "all":
      return { ...DEFAULT_STATE, status: "all", analytics: true, marketing: true, grantedAt };
    case "a":
      return { ...DEFAULT_STATE, status: "analytics-only", analytics: true, marketing: false, grantedAt };
    case "n":
      return { ...DEFAULT_STATE, status: "rejected", analytics: false, marketing: false, grantedAt };
    default:
      return DEFAULT_STATE;
  }
}

function serializeConsent(state: ConsentState): string {
  const ts = state.grantedAt ? new Date(state.grantedAt).getTime() : Date.now();
  switch (state.status) {
    case "all":
      return `all|${ts}`;
    case "analytics-only":
      return `a|${ts}`;
    case "rejected":
      return `n|${ts}`;
    default:
      return `n|${ts}`;
  }
}

function writeConsent(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be disabled — fall back to cookie only
  }
  const serialized = serializeConsent(state);
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_TTL_DAYS);
  document.cookie = `${COOKIE_KEY}=${serialized}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// === Provider ===
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConsentState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Read consent on mount (deferred to satisfy react-hooks/set-state-in-effect)
  useEffect(() => {
    Promise.resolve().then(() => {
      setState(readConsent());
      setHydrated(true);
    });
  }, []);

  const applyConsent = useCallback((next: ConsentState) => {
    writeConsent(next);
    setState(next);
    // Notify PostHog to update opt-in/out status
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consent-changed", { detail: next }));
    }
  }, []);

  const acceptAll = useCallback(() => {
    applyConsent({
      status: "all",
      analytics: true,
      marketing: true,
      necessary: true,
      grantedAt: new Date().toISOString(),
    });
  }, [applyConsent]);

  const acceptAnalyticsOnly = useCallback(() => {
    applyConsent({
      status: "analytics-only",
      analytics: true,
      marketing: false,
      necessary: true,
      grantedAt: new Date().toISOString(),
    });
  }, [applyConsent]);

  const rejectAll = useCallback(() => {
    applyConsent({
      status: "rejected",
      analytics: false,
      marketing: false,
      necessary: true,
      grantedAt: new Date().toISOString(),
    });
  }, [applyConsent]);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent("consent-changed", { detail: DEFAULT_STATE }));
    }
    setState(DEFAULT_STATE);
  }, []);

  const value: ConsentContextValue = {
    state,
    hasDecided: hydrated && state.status !== "pending",
    acceptAll,
    acceptAnalyticsOnly,
    rejectAll,
    reset,
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

// === Hook ===
export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}

// === Convenience hook for analytics opt-in check ===
export function useHasAnalyticsConsent(): boolean {
  const { state, hasDecided } = useConsent();
  // Before user has decided, do NOT fire analytics (precautionary principle)
  if (!hasDecided) return false;
  return state.analytics;
}
