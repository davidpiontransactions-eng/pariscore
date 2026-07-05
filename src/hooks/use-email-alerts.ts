"use client";

import { useCallback, useEffect, useState } from "react";
import { useAnalytics } from "@/components/analytics-provider";

const STORAGE_KEY = "setpoint-email-alerts";

/**
 * Read the subscribed email from localStorage (client-side only).
 * Returns `null` when not subscribed or when localStorage is unavailable.
 */
function readStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredEmail(email: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, email);
  } catch {
    // localStorage may be disabled — silently ignore
  }
}

function clearStoredEmail() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Basic client-side email format check (mirrors the server-side validator).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailAlertState =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "unsubscribing";

export type ValueBetAlertPayload = {
  matchId: string;
  playerA: string;
  playerB: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
};

export function useEmailAlerts() {
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<EmailAlertState>("idle");
  const [mounted, setMounted] = useState(false);
  const { track } = useAnalytics();

  // Hydrate from localStorage on mount. setState is deferred out of the
  // effect body (microtask) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    Promise.resolve().then(() => {
      setMounted(true);
      const stored = readStoredEmail();
      if (stored) {
        setEmail(stored);
        setState("subscribed");
      }
    });
    // Sync across tabs — if another tab unsubscribes, reflect it here.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      Promise.resolve().then(() => {
        if (e.newValue) {
          setEmail(e.newValue);
          setState("subscribed");
        } else {
          setEmail(null);
          setState("idle");
        }
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const subscribe = useCallback(
    async (rawEmail: string): Promise<boolean> => {
      const trimmed = rawEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed)) return false;
      setState("subscribing");
      try {
        const res = await fetch("/api/email/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        if (!res.ok) {
          setState("idle");
          return false;
        }
        writeStoredEmail(trimmed);
        setEmail(trimmed);
        setState("subscribed");
        track("email_subscribed", { email: trimmed });
        return true;
      } catch (err) {
        console.error("[email] subscribe failed", err);
        setState("idle");
        return false;
      }
    },
    [track]
  );

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    const current = email ?? readStoredEmail();
    setState("unsubscribing");
    try {
      // Fire-and-forget the API call — local state clears regardless so the
      // UI feels instant even if the network is slow.
      if (current) {
        await fetch("/api/email/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: current }),
        });
      }
      clearStoredEmail();
      setEmail(null);
      setState("idle");
      track("email_unsubscribed", { email: current ?? undefined });
      return true;
    } catch (err) {
      console.error("[email] unsubscribe failed", err);
      // Still clear local state — user intent is to unsubscribe.
      clearStoredEmail();
      setEmail(null);
      setState("idle");
      return false;
    }
  }, [email, track]);

  const sendTestAlert = useCallback(
    async (payload: ValueBetAlertPayload): Promise<boolean> => {
      try {
        const res = await fetch("/api/email/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return false;
        track("email_test_alert_sent", {
          match_id: payload.matchId,
          bookmaker: payload.bookmaker,
        });
        return true;
      } catch (err) {
        console.error("[email] test alert failed", err);
        return false;
      }
    },
    [track]
  );

  return {
    mounted,
    email,
    subscribed: state === "subscribed" && Boolean(email),
    state,
    subscribe,
    unsubscribe,
    sendTestAlert,
  };
}
