"use client";

import { useTranslations } from "next-intl";
import { Check, X, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One recent match for a player, forward-compatible with a future
 * `useLastMatches(playerId)` hook. The caller is responsible for sorting
 * (most recent first); this component only slices `maxItems`.
 */
export type RecentMatch = {
  id: string;
  /** ISO date. */
  date: string;
  opponent: string;
  won: boolean;
  /** Human-readable score, e.g. "6-4 6-3". */
  score: string;
  tournament: string;
  surface: "Dur" | "Terre" | "Gazon" | "Moquette" | (string & {});
  /** Round label, e.g. "QF", "8e", "F". */
  round: string;
};

type Props = {
  matches: RecentMatch[];
  /** Optional, used to build the list aria-label. */
  playerName?: string;
  /** Defaults to 10. */
  maxItems?: number;
  className?: string;
};

/**
 * LastMatchesList — replaces the binary W/L BarChart in the "form" tab of
 * MatchDetailDialog with a compact, readable list of the player's last matches.
 *
 * Layout (desktop ≥ sm): single grid row per match with 5 columns
 *   [W/L badge] [score] [vs] [opponent] [tournament · surface · round]
 *
 * Layout (mobile): two rows per match
 *   row 1 → badge + score
 *   row 2 → vs · opponent · tournament · surface · round
 *
 * The second row is a flex container on mobile that becomes
 * `display: contents` on `sm+`, letting its children flow into the 5-column
 * grid alongside the badge and score.
 *
 * Composition notes (react-patterns):
 *  - `DEFAULT_MAX_ITEMS` is hoisted out of the component to keep the props
 *    default referentially stable.
 *  - The list is pure (no state/effects) — derived entirely from props.
 */
const DEFAULT_MAX_ITEMS = 10;

export function LastMatchesList({
  matches,
  playerName,
  maxItems = DEFAULT_MAX_ITEMS,
  className,
}: Props) {
  const t = useTranslations("tennis");

  const items = matches.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-10 text-center",
          className
        )}
      >
        <Trophy className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("noRecentMatches")}</p>
      </div>
    );
  }

  const ariaLabel = playerName
    ? t("ariaList", { player: playerName, n: items.length })
    : t("recentMatches");

  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className={cn("divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60", className)}
    >
      {items.map((m) => (
        <li
          key={m.id}
          role="listitem"
          className={cn(
            "grid items-center gap-x-2 px-3 py-2 transition-colors",
            "grid-cols-[auto_minmax(0,1fr)]",
            "sm:grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] sm:gap-x-3",
            "hover:bg-muted/40"
          )}
        >
          <ResultBadge won={m.won} />

          <span className="row-start-1 col-start-2 font-mono text-sm tabular-nums text-foreground">
            {m.score}
          </span>

          {/*
            Mobile: flex row in grid cell (row 2, col 2) holding vs + opponent + meta.
            Desktop: `sm:contents` dissolves the wrapper so each child becomes a
            direct grid item placed explicitly in columns 3, 4, 5.
          */}
          <div className="row-start-2 col-start-2 flex min-w-0 items-baseline gap-1.5 text-xs sm:contents">
            <span className="shrink-0 text-muted-foreground sm:row-start-1 sm:col-start-3">
              {t("vs")}
            </span>
            <span className="truncate font-semibold text-foreground sm:row-start-1 sm:col-start-4">
              {m.opponent}
            </span>
            <span className="truncate text-muted-foreground sm:row-start-1 sm:col-start-5">
              {m.tournament}
              <span className="mx-1" aria-hidden="true">·</span>
              {m.surface}
              <span className="mx-1" aria-hidden="true">·</span>
              {m.round}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * W/L badge: green check for a win, rose cross for a loss.
 * Shows both the icon and the letter (e.g. "✓ W") per the visual spec.
 */
function ResultBadge({ won }: { won: boolean }) {
  return (
    <span
      aria-label={won ? "W" : "L"}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none",
        won
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
      )}
    >
      {won ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <X className="h-3 w-3" aria-hidden="true" />
      )}
      {won ? "W" : "L"}
    </span>
  );
}

export default LastMatchesList;
