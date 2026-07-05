"use client";

import { useEffect, useRef, useState } from "react";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { useHasAnalyticsConsent } from "@/components/consent-provider";
import { useAnalytics } from "@/components/analytics-provider";
import type { TennisMatch } from "@/lib/tennis-data";

/**
 * Daily digest scheduler.
 *
 * Groups all value bets detected on the current matches into a single
 * notification sent once per 24h (per channel). Opt-in: only fires when
 * the user has toggled the digest on (localStorage `setpoint-digest-enabled`
 * === "true") AND has granted analytics consent (RGPD).
 *
 * - Stores last-sent timestamp in localStorage `setpoint-digest-last-sent`.
 * - Sends to push (if subscribed) and email (if subscribed) channels in
 *   parallel — each channel is independent.
 * - Runs the check on mount (after a short delay for data to load) and
 *   every 30 minutes (in case the user keeps the tab open).
 *
 * The hook is intentionally side-effect-only from the caller's POV — the
 * returned `enabled` / `lastSent` values are for diagnostics/UI display
 * only and are read once on mount (re-renders driven by the toggle UI
 * itself).
 */

const DIGEST_ENABLED_KEY = "setpoint-digest-enabled";
const DIGEST_LAST_SENT_KEY = "setpoint-digest-last-sent";

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const INITIAL_DELAY_MS = 3000; // let SWR hydrate before first check

// Value bet threshold — kept in sync with src/hooks/use-value-bet-scanner.ts
const VALUE_BET_THRESHOLD = 3; // percentage points (model proba - implied proba)

export type DigestBet = {
  matchId: string;
  playerA: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
};

// === localStorage helpers (SSR-safe) ============================

export function isDigestEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DIGEST_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDigestEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIGEST_ENABLED_KEY, enabled ? "true" : "false");
    // Notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(
      new CustomEvent("setpoint-digest-change", { detail: enabled })
    );
  } catch {
    /* localStorage may be disabled — silently ignore */
  }
}

export function readDigestLastSent(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DIGEST_LAST_SENT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeDigestLastSent(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIGEST_LAST_SENT_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

// === Value bet computation ======================================

/**
 * Scan the current matches and return one value bet per match (the
 * bookmaker with the highest edge). Mirrors the logic in
 * `use-value-bet-scanner.ts` but returns a flat list suitable for the
 * digest payload (no per-match deduplication state).
 */
function computeValueBets(matches: TennisMatch[]): DigestBet[] {
  const bets: DigestBet[] = [];
  for (const match of matches) {
    if (!match.allOdds || match.allOdds.length === 0) continue;
    let best: DigestBet | null = null;
    let bestEdge = -Infinity;
    for (const odd of match.allOdds) {
      const edge = match.probA - odd.impliedProbA;
      if (edge >= VALUE_BET_THRESHOLD && edge > bestEdge) {
        best = {
          matchId: match.id,
          playerA: match.playerA.name,
          probA: match.probA,
          bookmaker: odd.bookmaker,
          decimalA: odd.decimalA,
          impliedProbA: odd.impliedProbA,
        };
        bestEdge = edge;
      }
    }
    if (best) bets.push(best);
  }
  // Sort by edge descending so the top N are the most interesting
  bets.sort((a, b) => (b.probA - b.impliedProbA) - (a.probA - a.impliedProbA));
  return bets;
}

// === Hook =======================================================

export function useDigestScheduler() {
  const { data } = usePrematchMatches();
  const { subscribed: pushSubscribed } = usePushNotifications();
  const { subscribed: emailSubscribed } = useEmailAlerts();
  const hasConsent = useHasAnalyticsConsent();
  const { track } = useAnalytics();

  const [enabled, setEnabled] = useState(false);
  const [lastSent, setLastSent] = useState(0);

  // Refs to read latest values inside the interval without retriggering
  // the mount-only effect.
  const matchesRef = useRef<TennisMatch[]>(data?.matches ?? []);
  const pushRef = useRef(pushSubscribed);
  const emailRef = useRef(emailSubscribed);
  const consentRef = useRef(hasConsent);
  const trackRef = useRef(track);

  useEffect(() => {
    matchesRef.current = data?.matches ?? [];
  }, [data?.matches]);
  useEffect(() => {
    pushRef.current = pushSubscribed;
  }, [pushSubscribed]);
  useEffect(() => {
    emailRef.current = emailSubscribed;
  }, [emailSubscribed]);
  useEffect(() => {
    consentRef.current = hasConsent;
  }, [hasConsent]);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Hydrate enabled/lastSent from localStorage on mount. Deferred
  // setState (microtask) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    Promise.resolve().then(() => {
      setEnabled(isDigestEnabled());
      setLastSent(readDigestLastSent());
    });
    // Sync with same-tab toggle events (custom event from setDigestEnabled)
    // AND cross-tab storage events.
    const onToggle = (e: Event) => {
      const detail =
        (e as CustomEvent<boolean>).detail ?? isDigestEnabled();
      setEnabled(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === DIGEST_ENABLED_KEY) {
        setEnabled(e.newValue === "true");
      }
      if (e.key === DIGEST_LAST_SENT_KEY) {
        setLastSent(e.newValue ? parseInt(e.newValue, 10) || 0 : 0);
      }
    };
    window.addEventListener("setpoint-digest-change", onToggle);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("setpoint-digest-change", onToggle);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Scheduler effect — mount + every 30 min. Reads via refs to avoid
  // re-subscribing on every state change.
  useEffect(() => {
    let cancelled = false;

    const sendDigest = async (bets: DigestBet[]) => {
      const top5 = bets.slice(0, 5);
      const payload = { bets: top5 };
      const channels: string[] = [];

      // Push channel
      if (pushRef.current) {
        try {
          const res = await fetch("/api/push/digest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) channels.push("push");
        } catch (err) {
          console.error("[digest] push send failed", err);
        }
      }

      // Email channel
      if (emailRef.current) {
        try {
          const res = await fetch("/api/email/digest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) channels.push("email");
        } catch (err) {
          console.error("[digest] email send failed", err);
        }
      }

      const now = Date.now();
      writeDigestLastSent(now);
      setLastSent(now);
      trackRef.current("digest_sent", {
        bet_count: bets.length,
        channels,
        top_player: top5[0]?.playerA ?? null,
      });
    };

    const check = async () => {
      if (cancelled) return;
      // RGPD: only fire when analytics consent has been granted.
      if (!consentRef.current) return;
      // Digest must be opted-in.
      if (!isDigestEnabled()) return;
      // 24h must have elapsed since the last send (or never sent).
      const last = readDigestLastSent();
      const now = Date.now();
      if (last > 0 && now - last < DIGEST_INTERVAL_MS) return;
      // At least one channel must be subscribed.
      if (!pushRef.current && !emailRef.current) return;
      // Need at least one value bet on the current matches.
      const bets = computeValueBets(matchesRef.current);
      if (bets.length === 0) return;

      await sendDigest(bets);
    };

    const initialTimer = setTimeout(check, INITIAL_DELAY_MS);
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return { enabled, lastSent };
}
