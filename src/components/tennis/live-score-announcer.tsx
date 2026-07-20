"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { formatPoints } from "@/lib/tennis-format";
import { cn } from "@/lib/utils";

/**
 * Minimum delay between two screen-reader announcements, in milliseconds.
 *
 * The live data source polls every 30s (`useLiveMatches`), so in practice we
 * never hit this throttle — it is a defensive guard against bursty updates
 * (SSE replays, dev-time fast polling) that would otherwise spam the user's
 * assistive tech. WCAG 4.1.3 (Status Messages) wants changes announced
 * without disrupting the user; rate-limiting is part of "without disrupting".
 */
const ANNOUNCE_THROTTLE_MS = 1000;

/**
 * Micro-delay used by the clear-then-set re-announce trick.
 *
 * Screen readers (NVDA, VoiceOver) only announce an `aria-live` mutation when
 * the text content actually changes. Setting the same string twice in a row
 * is a no-op. To force a re-announce of an identical message (e.g. "30-15,
 * X serving" reached twice in the same game), we briefly render the empty
 * string and then the message on the next tick.
 */
const REANNOUNCE_DELAY_MS = 50;

type Props = {
  /** Current live match state. Diffed against the previous render's value. */
  liveState: LiveMatchState;
  /** Display name of side A (used in spoken announcements). */
  player1Name: string;
  /** Display name of side B (used in spoken announcements). */
  player2Name: string;
  className?: string;
};

/**
 * `LiveScoreAnnouncer` — accessible live region for tennis score changes.
 *
 * Implements WCAG 2.2 AA criterion **4.1.3 Status Messages** (Level AA): when
 * the live score changes (point won, game won, set won, break point reached),
 * the change is announced to assistive technologies via an `aria-live="polite"`
 * region, **without moving focus**.
 *
 * Why `polite` and not `assertive`: score changes are informational, not
 * urgent. `polite` queues the announcement so the screen reader finishes its
 * current utterance first — assertive would interrupt the user mid-sentence,
 * which is reserved for errors / safety-critical alerts.
 *
 * Detection strategy — the component diffs the incoming `liveState` against the
 * previous snapshot (kept in a ref) and emits a single human-readable message
 * per tick, covering the most significant event first:
 *
 *   1. **Set won** (`scoreX.sets.length` increased) — includes final set score
 *      and, when the match continues, the next set number.
 *   2. **Game won** (`scoreX.games` increased without a set boundary) —
 *      includes the new game score.
 *   3. **Break point reached** (receiver one point from winning the game) —
 *      only announced on the `false → true` transition to avoid spamming
 *      during deuce cycles.
 *   4. **Point score change** — the new formatted point score with server.
 *
 * The region is visually hidden via Tailwind's `sr-only` utility (1x1 clipped,
 * `position: absolute`) — present in the a11y tree, absent from the visual
 * layout.
 *
 * **Not wired into any card yet** — this is the Phase 3.5 deliverable. The
 * integration into `match-card.tsx` / `match-card-header.tsx` happens in a
 * separate commit.
 *
 * @example
 *   <LiveScoreAnnouncer
 *     liveState={liveState}
 *     player1Name="Sinner"
 *     player2Name="Alcaraz"
 *   />
 */
export function LiveScoreAnnouncer({
  liveState,
  player1Name,
  player2Name,
  className,
}: Props) {
  const t = useTranslations("match.liveAnnounce");

  // The string currently rendered inside the live region.
  const [announcement, setAnnouncement] = useState("");

  // Previous snapshot — compared against on every prop change.
  const prevLiveStateRef = useRef<LiveMatchState | null>(null);

  // Throttle bookkeeping.
  const lastAnnouncedAtRef = useRef(0);
  const pendingMessageRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Render the message into the live region, using the clear-then-set trick
   * so identical consecutive messages still get re-announced by the SR.
   */
  const announceNow = (message: string) => {
    setAnnouncement("");
    // Defer to a separate task so React commits the empty string first.
    setTimeout(() => setAnnouncement(message), REANNOUNCE_DELAY_MS);
    lastAnnouncedAtRef.current = Date.now();
  };

  /**
   * Throttled announce: emit immediately if the throttle window has elapsed,
   * otherwise coalesce the message into the pending buffer and flush it once
   * the window opens. Coalescing (`. ` join) means no event is silently
   * dropped — the user hears everything, just batched.
   */
  const scheduleAnnounce = (message: string) => {
    const now = Date.now();
    const elapsed = now - lastAnnouncedAtRef.current;

    if (elapsed >= ANNOUNCE_THROTTLE_MS) {
      pendingMessageRef.current = "";
      announceNow(message);
      return;
    }

    // Inside the throttle window: accumulate and defer.
    pendingMessageRef.current = pendingMessageRef.current
      ? `${pendingMessageRef.current}. ${message}`
      : message;

    if (flushTimerRef.current) return; // already scheduled

    const remaining = ANNOUNCE_THROTTLE_MS - elapsed;
    flushTimerRef.current = setTimeout(() => {
      const pending = pendingMessageRef.current;
      pendingMessageRef.current = "";
      flushTimerRef.current = null;
      if (pending) announceNow(pending);
    }, remaining);
  };

  // ─── Diff + announce ──────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevLiveStateRef.current;
    prevLiveStateRef.current = liveState;

    // Skip the very first render (no previous snapshot to diff against) and
    // any match switch (avoid diffing two unrelated matches).
    if (!prev) return;
    if (prev.matchId !== liveState.matchId) return;

    const message = buildAnnouncementMessage(prev, liveState, {
      player1Name,
      player2Name,
      t,
    });

    if (message) scheduleAnnounce(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState, player1Name, player2Name]);

  // Clean up any pending throttle timer on unmount to avoid setting state
  // on an unmounted component.
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className={cn("sr-only", className)}
    >
      {announcement}
    </div>
  );
}

// ─── Pure diff + i18n helpers ────────────────────────────────────────────────
//
// Extracted so the logic is testable in isolation and the effect body stays
// readable. `t` is typed loosely (`(key, vars?) => string`) to avoid leaking
// next-intl's richer translator signature into this module boundary.

type Translator = (key: string, vars?: Record<string, string | number>) => string;

type BuildArgs = {
  player1Name: string;
  player2Name: string;
  t: Translator;
};

/**
 * Compare two consecutive {@link LiveMatchState} snapshots and return a single
 * human-readable announcement string (already localised), or `""` if nothing
 * changed worth announcing.
 *
 * Note on the `sets[]` shape: in this codebase `scoreX.sets` holds the **game
 * counts of completed sets** (see `use-live-matches.ts` →
 * `setsA = m.setsDetail.map((s) => s.p1)`). A set ends when a new entry is
 * appended to `sets[]` (length increases by 1) and the current-set `games`
 * counter resets to 0.
 */
function buildAnnouncementMessage(
  prev: LiveMatchState,
  curr: LiveMatchState,
  { player1Name, player2Name, t }: BuildArgs,
): string {
  const nameFor = (side: "A" | "B") =>
    side === "A" ? player1Name : player2Name;

  // ── Set won ──────────────────────────────────────────────────────────────
  // `sets[]` grows by one when a set completes. The winner is the side with
  // the higher game count in the just-completed set.
  const prevSetsLen = Math.max(
    prev.scoreA.sets.length,
    prev.scoreB.sets.length,
  );
  const currSetsLen = Math.max(
    curr.scoreA.sets.length,
    curr.scoreB.sets.length,
  );

  if (currSetsLen > prevSetsLen) {
    const setIdx = currSetsLen - 1; // 0-based index of the completed set
    const gamesA = curr.scoreA.sets[setIdx] ?? 0;
    const gamesB = curr.scoreB.sets[setIdx] ?? 0;
    const winnerSide: "A" | "B" = gamesA >= gamesB ? "A" : "B";
    const setScore = `${gamesA}-${gamesB}`;

    // If the match is no longer live, this was the deciding set — don't
    // announce a non-existent next set.
    if (!curr.isLive) {
      return t("setWonByLast", {
        n: setIdx + 1,
        player: nameFor(winnerSide),
        score: setScore,
      });
    }

    return t("setWonBy", {
      n: setIdx + 1,
      player: nameFor(winnerSide),
      score: setScore,
      next: setIdx + 2,
    });
  }

  // ── Game won (no set boundary crossed this tick) ─────────────────────────
  // The side whose `games` counter incremented won the game. We only emit
  // this when no set was completed, otherwise the set-win announcement above
  // already covers the event (and the games counter has reset to 0 anyway).
  const gamesAChanged = curr.scoreA.games !== prev.scoreA.games;
  const gamesBChanged = curr.scoreB.games !== prev.scoreB.games;

  if (gamesAChanged || gamesBChanged) {
    if (curr.scoreA.games > prev.scoreA.games) {
      return t("gameWonBy", {
        player: player1Name,
        score: `${curr.scoreA.games}-${curr.scoreB.games}`,
        set: curr.currentSet + 1,
      });
    }
    if (curr.scoreB.games > prev.scoreB.games) {
      return t("gameWonBy", {
        player: player2Name,
        score: `${curr.scoreA.games}-${curr.scoreB.games}`,
        set: curr.currentSet + 1,
      });
    }
    // games changed but neither incremented (e.g. both reset on a set
    // boundary already handled above, or a data correction). Nothing to say.
    return "";
  }

  // ── Break point reached (receiver one point from winning the game) ────────
  // Only announce the false → true transition so we don't spam during deuce
  // cycles (40-40 → Av-40 → 40-40 → Av-40 …).
  const prevBreakSide = breakPointSide(prev);
  const currBreakSide = breakPointSide(curr);

  if (currBreakSide && currBreakSide !== prevBreakSide) {
    return t("breakPointFor", { player: nameFor(currBreakSide) });
  }

  // ── Point score change ───────────────────────────────────────────────────
  // Emits the formatted point score with the server's name. Skipped while a
  // break point is active (already announced above) to avoid redundancy —
  // "Break point for Alcaraz. 30-40, Sinner serving" says the same thing twice.
  if (currBreakSide) {
    return "";
  }

  const pointsChanged =
    curr.scoreA.points !== prev.scoreA.points ||
    curr.scoreB.points !== prev.scoreB.points;

  if (pointsChanged) {
    const serverName = nameFor(curr.server);
    return t("scoreUpdate", {
      points: formatPoints(curr.scoreA.points, curr.scoreB.points),
      server: serverName,
    });
  }

  return "";
}

/**
 * Determine which side (if any) currently has a break point opportunity.
 *
 * A break point exists when the **receiver** is one point away from winning
 * the game — i.e. the receiver has reached 40 (or advantage) while the server
 * has not. Logic mirrors `use-momentum-dr.ts`'s `isBreakPoint` helper so the
 * two modules agree on what counts as a break opportunity.
 *
 * @returns `"A"` if side A has the break opportunity, `"B"` for side B, or
 *          `null` if the current game is not a break-point situation.
 */
function breakPointSide(state: LiveMatchState): "A" | "B" | null {
  const { points: ptsA, points: ptsB } = state.scoreA;
  const { points: ptsBOther } = state.scoreB;
  const server = state.server;

  // Side A is receiving → A has a break point if A is one point from winning.
  if (server === "B") {
    if (ptsA >= 3 && ptsBOther <= 2) return "A"; // 40-0/15/30
    if (ptsA >= 3 && ptsBOther >= 3 && ptsA > ptsBOther) return "A"; // Av.-40
    return null;
  }

  // Side B is receiving → B has a break point if B is one point from winning.
  if (ptsB >= 3 && ptsA <= 2) return "B";
  if (ptsA >= 3 && ptsB >= 3 && ptsB > ptsA) return "B";
  return null;
}
