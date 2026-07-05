"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Ticket,
  ChevronDown,
  X,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBetSlip, type BetSelection } from "@/hooks/use-bet-slip";
import { useBankroll } from "@/hooks/use-bankroll";
import { useAnalytics } from "@/components/analytics-provider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Floating bet slip — DraftKings-style sticky panel bottom-right.
 *
 * Position: `fixed bottom-20 right-4 z-40` — sits above the feedback widget
 * (which is at `bottom-4 right-4 z-40`) and below the modal dialogs (z-50).
 *
 * Lifecycle:
 *  - When the slip is empty, the component renders nothing.
 *  - Adding the first selection auto-expands the panel (deferred setState
 *    to respect `react-hooks/set-state-in-effect`).
 *  - Removing the last selection auto-collapses (also deferred).
 *  - The user can collapse/expand manually via the header chevron / the
 *    collapsed badge button.
 *
 * "Place bets" iterates over the selections and calls `addBet` from
 * `useBankroll` for each, fires a `bet_slip_place` PostHog event with
 * `{ count, totalStake }`, shows a confirmation toast, and clears the slip.
 */
export function BetSlip() {
  const t = useTranslations("betSlip");
  const { track } = useAnalytics();
  const { toast } = useToast();
  const {
    selections,
    count,
    isFull,
    addToSlip: _addToSlip,
    removeFromSlip,
    updateStake,
    clearSlip,
    totalStake,
    totalPayout,
    totalProfit,
  } = useBetSlip();
  const { addBet } = useBankroll();

  const [expanded, setExpanded] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Auto-expand when the first selection lands; auto-collapse when the last
  // one is removed. Both setStates are deferred via Promise.resolve() to
  // satisfy the `react-hooks/set-state-in-effect` rule (the rule flags any
  // synchronous setState inside an effect body).
  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (count > 0 && prev === 0) {
      Promise.resolve().then(() => setExpanded(true));
    } else if (count === 0 && prev > 0) {
      Promise.resolve().then(() => setExpanded(false));
    }
  }, [count]);

  // Suppress "unused" lint — addToSlip is exposed by the hook for callers
  // but this panel only reads + mutates existing selections.
  void _addToSlip;

  // Empty + collapsed → render nothing.
  if (count === 0 && !expanded) return null;

  const handlePlace = () => {
    if (selections.length === 0) return;
    setPlacing(true);
    try {
      for (const sel of selections) {
        addBet({
          matchId: sel.matchId,
          playerA: sel.playerA,
          playerB: sel.playerB,
          betOn: sel.betOn,
          betOnName: sel.betOnName,
          stake: sel.stake,
          odd: sel.odd,
          bookmaker: sel.bookmaker,
          surface: sel.surface,
          tournament: sel.tournament,
        });
      }
      track("bet_slip_place", {
        count: selections.length,
        total_stake: totalStake,
        total_payout: totalPayout,
      });
      toast({
        title: t("placed", { n: selections.length }),
        description: `${t("total")}: ${totalStake.toFixed(2)} €`,
      });
      clearSlip();
      track("bet_slip_clear", { source: "place" });
    } finally {
      setPlacing(false);
    }
  };

  const handleClear = () => {
    track("bet_slip_clear", { source: "manual" });
    clearSlip();
  };

  // Collapsed badge — shown when there are selections but the user has
  // collapsed the panel.
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={t("expand")}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full",
          "border border-emerald-500/40 bg-background px-4 py-2.5 shadow-lg",
          "text-sm font-semibold text-foreground",
          "transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-emerald-500",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span>{t("title")}</span>
        <Badge
          variant="default"
          className="ml-0.5 bg-emerald-600 px-1.5 py-0 text-[11px] font-bold leading-5 text-white tabular-nums"
        >
          {count}
        </Badge>
      </button>
    );
  }

  return (
    <section
      role="region"
      aria-label={t("title")}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex max-h-[calc(100vh-6rem)] w-[calc(100vw-2rem)] max-w-sm flex-col",
        "rounded-xl border border-border/70 bg-card shadow-2xl",
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold tracking-tight">{t("title")}</h2>
          <Badge
            variant="secondary"
            className="px-1.5 py-0 text-[11px] font-bold tabular-nums"
          >
            {count}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={count === 0 || placing}
            aria-label={t("clear")}
            title={t("clear")}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            aria-label={t("collapse")}
            title={t("collapse")}
            className="h-7 px-2 text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Body — list of selections or empty state */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {selections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selections.map((sel) => (
              <SlipRow
                key={`${sel.matchId}-${sel.betOn}`}
                selection={sel}
                onRemove={() => {
                  removeFromSlip(sel.matchId, sel.betOn);
                  track("bet_slip_remove", {
                    match_id: sel.matchId,
                    bet_on: sel.betOn,
                  });
                }}
                onStakeChange={(n) =>
                  updateStake(sel.matchId, sel.betOn, n)
                }
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer — totals + place bets */}
      <footer className="border-t border-border/60 bg-muted/20 px-4 py-3">
        <div className="mb-2 space-y-1 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("total")}</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {totalStake.toFixed(2)} €
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-700 dark:text-emerald-300">
              {t("potentialPayout")}
            </span>
            <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalPayout.toFixed(2)} €
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t("payout")}</span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                totalProfit > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : totalProfit < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground",
              )}
            >
              {totalProfit >= 0 ? "+" : ""}
              {totalProfit.toFixed(2)} €
            </span>
          </div>
        </div>
        <Button
          type="button"
          onClick={handlePlace}
          disabled={count === 0 || placing}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          size="sm"
        >
          {placing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("placeBets", { n: count })}
        </Button>
      </footer>
    </section>
  );
}

/**
 * One row in the bet slip. The stake input keeps a local string state so the
 * user can type "1.", "0.", etc. without the cursor jumping — the parsed
 * number is forwarded to the parent on every change. The component is keyed
 * by `matchId-betOn` so it remounts whenever a new selection is added (with
 * the new initial stake) rather than reusing the previous input's state.
 */
function SlipRow({
  selection,
  onRemove,
  onStakeChange,
}: {
  selection: BetSelection;
  onRemove: () => void;
  onStakeChange: (n: number) => void;
}) {
  const t = useTranslations("betSlip");
  const [stakeText, setStakeText] = useState<string>(String(selection.stake));

  return (
    <li className="rounded-lg border border-border/60 bg-background/60 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {selection.betOnName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">
              {selection.playerA} {t("vs")} {selection.playerB}
            </span>
          </div>
          {selection.bookmaker && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider">
                {selection.bookmaker}
              </span>
              <span className="text-border">·</span>
              <span className="font-mono">
                {t("odd")} {selection.odd.toFixed(2)}
              </span>
            </div>
          )}
          {!selection.bookmaker && (
            <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
              {t("odd")} {selection.odd.toFixed(2)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("remove")}
          title={t("remove")}
          className={cn(
            "shrink-0 rounded-md p-1 text-muted-foreground transition-colors",
            "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("stake")}
        </label>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={stakeText}
          onChange={(e) => {
            setStakeText(e.target.value);
            onStakeChange(parseFloat(e.target.value) || 0);
          }}
          className="h-7 flex-1 px-2 py-1 text-xs tabular-nums"
        />
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          →{" "}
          <span className="font-semibold text-foreground">
            {(selection.stake * selection.odd).toFixed(2)} €
          </span>
        </span>
      </div>
    </li>
  );
}
