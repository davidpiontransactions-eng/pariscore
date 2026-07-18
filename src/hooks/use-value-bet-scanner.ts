"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { useAnalytics } from "@/components/analytics-provider";
import { isDigestEnabled } from "@/hooks/use-digest-scheduler";
import type { TennisMatch } from "@/lib/tennis-data";

// Value bet threshold: model proba must exceed bookmaker implied proba by this margin
const VALUE_BET_THRESHOLD = 3; // percentage points

type AlertedMatch = {
  matchId: string;
  playerA: string;
  probA: number;
  bookmaker: string;
  decimalA: number;
  impliedProbA: number;
  alertedAt: string;
};

const ALERTED_KEY = "setpoint-alerted-value-bets";
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level set shared across hook instances and the reset function
const alertedRefSet = new Set<string>();

// Read alerted match IDs from localStorage (to avoid spamming)
function readAlerted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ALERTED_KEY);
    const items: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const set = new Set(items);
    alertedRefSet.clear();
    for (const id of set) alertedRefSet.add(id);
    return set;
  } catch {
    return new Set();
  }
}

function writeAlerted(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALERTED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function useValueBetScanner() {
  const { data } = usePrematchMatches();
  const { subscribed: pushSubscribed, sendTestAlert: sendPushAlert } = usePushNotifications();
  const { subscribed: emailSubscribed, sendTestAlert: sendEmailAlert } = useEmailAlerts();
  const { track } = useAnalytics();
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [alertsSent, setAlertsSent] = useState(0);
  const [alertedCount, setAlertedCount] = useState(0);
  const alertedRef = useRef<Set<string>>(readAlerted());

  // Refs to avoid retriggering the scan effect
  const matchesRef = useRef<TennisMatch[]>(data?.matches ?? []);
  const pushRef = useRef(pushSubscribed);
  const emailRef = useRef(emailSubscribed);
  const pushAlertRef = useRef(sendPushAlert);
  const emailAlertRef = useRef(sendEmailAlert);
  const trackRef = useRef(track);

  // Keep refs updated
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
    pushAlertRef.current = sendPushAlert;
  }, [sendPushAlert]);
  useEffect(() => {
    emailAlertRef.current = sendEmailAlert;
  }, [sendEmailAlert]);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Sync alertedCount after mount
  useEffect(() => {
    Promise.resolve().then(() => setAlertedCount(alertedRef.current.size));
  }, []);

  // Scan runs once on mount + every 5 minutes. Uses refs to read latest values
  // without retriggering the effect.
  useEffect(() => {
    let cancelled = false;

    const scan = async () => {
      if (cancelled) return;
      const matches = matchesRef.current;
      if (!matches.length) return;

      const now = new Date().toISOString();

      // Daily digest mode: suppress individual alerts — the digest
      // scheduler hook (`useDigestScheduler`) will send a single grouped
      // notification once per 24h instead. We still update lastScanAt so
      // the indicator UI reflects that the scan ran.
      if (isDigestEnabled()) {
        setLastScanAt(now);
        return;
      }

      const newAlerts: AlertedMatch[] = [];

      for (const match of matches) {
        if (!match.allOdds || match.allOdds.length === 0) continue;

        for (const odd of match.allOdds) {
          const modelProbA = match.probA;
          const impliedProbA = odd.impliedProbA;
          const edge = modelProbA - impliedProbA;

          if (edge >= VALUE_BET_THRESHOLD) {
            const alertKey = `${match.id}-${odd.bookmaker}`;
            if (alertedRef.current.has(alertKey)) continue;

            newAlerts.push({
              matchId: match.id,
              playerA: match.playerA.name,
              probA: modelProbA,
              bookmaker: odd.bookmaker,
              decimalA: odd.decimalA,
              impliedProbA,
              alertedAt: now,
            });
            alertedRef.current.add(alertKey);
            break;
          }
        }
      }

      if (cancelled) return;

      if (newAlerts.length > 0) {
        writeAlerted(alertedRef.current);
        setAlertsSent((n) => n + newAlerts.length);
        setAlertedCount(alertedRef.current.size);

        // Send push notifications
        if (pushRef.current) {
          for (const alert of newAlerts) {
            await pushAlertRef.current({
              matchId: alert.matchId,
              playerA: alert.playerA,
              playerB: "",
              probA: alert.probA,
              bookmaker: alert.bookmaker,
              decimalA: alert.decimalA,
              impliedProbA: alert.impliedProbA,
            });
          }
        }

        // Send email notifications
        if (emailRef.current) {
          for (const alert of newAlerts) {
            await emailAlertRef.current({
              matchId: alert.matchId,
              playerA: alert.playerA,
              playerB: "",
              probA: alert.probA,
              bookmaker: alert.bookmaker,
              decimalA: alert.decimalA,
              impliedProbA: alert.impliedProbA,
            });
          }
        }

        // Track alerts
        for (const alert of newAlerts) {
          trackRef.current("value_bet_alert_sent", {
            match_id: alert.matchId,
            player_a: alert.playerA,
            prob_a: alert.probA,
            bookmaker: alert.bookmaker,
            implied_prob_a: alert.impliedProbA,
            edge: alert.probA - alert.impliedProbA,
            push_sent: pushRef.current,
            email_sent: emailRef.current,
          });
        }
      }

      setLastScanAt(now);
    };

    // Initial scan (delayed to let data load)
    const initialTimer = setTimeout(scan, 2000);
    const interval = setInterval(scan, SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []); // Empty deps — run once on mount

  return {
    lastScanAt,
    alertsSent,
    alertedCount,
  };
}

/**
 * Reset the alerted set (for testing or user action "clear history").
 */
export function resetAlertedValueBets() {
  if (typeof window === "undefined") return;
  alertedRefSet.clear();
  localStorage.removeItem(ALERTED_KEY);
}
