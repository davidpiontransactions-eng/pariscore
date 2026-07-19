"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock,
  TrendingUp,
  Trophy,
  Activity,
  Target,
  Calendar,
  Scale,
  ExternalLink,
  WifiOff,
  BarChart3,
  Star,
  Mail,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ProbabilityBar } from "./probability-bar";
import { FormDots } from "./form-dots";
import { BacktestBadge } from "./backtest-badge";
import { PlayerStatline } from "./player-statline";
import { StatsIndicatorsGrid } from "./stats-indicators-grid";
import { PlayerBlock } from "./player-block";
import { QuickAddRing } from "./quick-add-ring";
import { BestOddBadge } from "./best-odd-badge";
import { LiveStatsPanel } from "./live-stats-panel";
import { MomentumDR } from "./momentum-dr";


import { formatRelativeTime, type TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useFavorites } from "@/hooks/use-favorites";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useEloSparkline } from "@/hooks/use-elo-sparkline";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useToast } from "@/hooks/use-toast";
import { usePlayerStats } from "@/hooks/use-player-stats";

// Normalisation de nom (NFD → strip diacritics → lowercase) pour la lookup
// des stats enrichies. Identique à player-matcher.ts:normalize et db.ts.
function normForLookup(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
import { useAnalytics } from "@/components/analytics-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch;
  defaultOpen?: boolean;
  chipsCollapsedByDefault?: boolean;
  liveState?: LiveMatchState;
  /** When true, shows a small "offline" indicator in the card footer. */
  disconnected?: boolean;
  /** Open the full detail dialog (H2H + form charts + odds comparator). */
  onOpenDetail?: () => void;
  /** Open the bet dialog to record a bet on this match. */
  onBetClick?: () => void;
  /** Mark images as high-priority (above-the-fold cards). Defaults to false. */
  priority?: boolean;
};

// Convert internal point index (0/1/2/3/4+) to tennis point notation.
function formatPoints(pA: number, pB: number): string {
  const v = (p: number) => ["0", "15", "30", "40"][p] ?? "40";
  if (pA >= 3 && pB >= 3) {
    if (pA === pB) return "40-40"; // deuce
    return pA > pB ? "Av.-40" : "40-Av.";
  }
  return `${v(pA)}-${v(pB)}`;
}

export function MatchCard({
  match,
  defaultOpen = false,
  chipsCollapsedByDefault = false,
  liveState,
  disconnected = false,
  onOpenDetail,
  onBetClick,
  priority = false,
}: Props) {
  const t = useTranslations("match");
  const tTime = useTranslations("time");
  const tEmail = useTranslations("email");
  const tSlip = useTranslations("betSlip");
  const { terminalMode } = useTerminalMode();
  const [open, setOpen] = useState(defaultOpen);
  // Terminal mode forces the stats chips to be always expanded — power
  // users want all the data visible without an extra click, so we OR the
  // user-driven flag with the terminal flag.
  const [chipsExpanded, setChipsExpanded] = useState(
    !chipsCollapsedByDefault || terminalMode
  );
  const [emailSending, setEmailSending] = useState(false);
  const { track } = useAnalytics();
  const { isFavorite, toggle } = useFavorites();
  const { sendTestAlert } = useEmailAlerts();
  const { addToSlip, isFull } = useBetSlip();
  const { toast } = useToast();
  const fav = isFavorite(match.id);
  // Sparklines Elo (P2 — Quant Terminal)
  const sparklineA = useEloSparkline(match.id, "a", 30);
  const sparklineB = useEloSparkline(match.id, "b", 30);
  // Best odds (P3 — Bet Action Hub)
  const bestOddA = match.allOdds?.length ? match.allOdds.reduce((max, o) => (o.decimalA > max.decimalA ? o : max)) : null;
  const bestOddB = match.allOdds?.length ? match.allOdds.reduce((max, o) => (o.decimalB > max.decimalB ? o : max)) : null;
  const { playerA, playerB, stats, model, modelUpdatedAt } = match;

  // Stats enrichies (Elo Surface, SPS, rangs) depuis pariscore.db. Un seul
  // fetch SWR pour les 2 joueurs du match, indexé par nom normalisé. Retourne
  // un map vide si la base est absente (local dev) → le statline affiche —.
  const playerStatsNames = `${playerA.name},${playerB.name}`;
  const { data: playerStatsMap } = usePlayerStats(playerStatsNames, stats.surface);
  const statsA = playerStatsMap?.[normForLookup(playerA.name)];
  const statsB = playerStatsMap?.[normForLookup(playerB.name)];

  const isLive = liveState?.isLive === true;
  // Live probabilities override the static prematch ones when the match is live.
  const probA = isLive ? Math.round(liveState!.liveProbA) : match.probA;
  const probB = isLive ? Math.round(liveState!.liveProbB) : match.probB;

  // Terminal mode is sticky — when it's ON we never let the chips collapse,
  // even if the A/B variant would have collapsed them. This effect runs
  // whenever the mode flips and lifts the local state to match. Deferred
  // via Promise.resolve().then(...) to satisfy `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (terminalMode && !chipsExpanded) {
      Promise.resolve().then(() => setChipsExpanded(true));
    }
  }, [terminalMode, chipsExpanded]);

  // Track match card view (once per mount)
  useEffect(() => {
    track("match_card_view", {
      match_id: match.id,
      tournament: match.tournament,
      player_a: playerA.name,
      player_b: playerB.name,
      prob_a: probA,
      prob_b: probB,
      terminal_mode: terminalMode,
    });
    // Only re-track when match changes (track is stable from useAnalytics)
  }, [match.id, match.tournament, playerA.name, playerB.name, probA, probB, track, terminalMode]);

  const handleToggleDetail = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      track("detail_open", {
        match_id: match.id,
        player_a: playerA.name,
        player_b: playerB.name,
      });
    }
  };

  const handleBetCta = () => {
    track("bet_cta_click", {
      match_id: match.id,
      player_a: playerA.name,
      player_b: playerB.name,
      prob_a: probA,
      bookmaker: match.odds?.bookmaker ?? "unknown",
      decimal_a: match.odds?.decimalA,
      decimal_b: match.odds?.decimalB,
    });
    // Open the bet dialog if handler provided, else just track
    onBetClick?.();
  };

  // Quick-add a player to the bet slip directly from the card — bypasses
  // the BetDialog and uses a default 10 € stake. The user can fine-tune
  // the stake inside the floating slip. Dedupes by matchId + betOn so
  // double-clicking the same player's + is a no-op (toast).
  const handleQuickAdd = (player: "A" | "B") => {
    const isA = player === "A";
    const playerName = isA ? playerA.name : playerB.name;
    const odd = match.odds
      ? isA
        ? match.odds.decimalA
        : match.odds.decimalB
      : 1 / (isA ? probA / 100 : probB / 100);
    const added = addToSlip({
      matchId: match.id,
      playerA: playerA.name,
      playerB: playerB.name,
      betOn: player,
      betOnName: playerName,
      stake: 10,
      odd,
      bookmaker: match.odds?.bookmaker,
      surface: stats.surface,
      tournament: match.tournament,
    });
    if (added) {
      track("bet_slip_add", {
        match_id: match.id,
        bet_on: player,
        stake: 10,
        source: "ring_quick_add",
      });
      toast({
        title: tSlip("added"),
        description: `${playerName} · 10 € @ ${odd.toFixed(2)}`,
      });
    } else {
      toast({
        title: isFull ? tSlip("maxReached") : tSlip("alreadyInSlip"),
        variant: isFull ? "destructive" : "default",
      });
    }
  };

  // Trigger a value-bet email test alert for this match. Sends to every
  // registered email subscriber (server logs to console when SMTP is unset).
  // No-op when no bookmaker odds are attached to the match.
  const handleEmailTestAlert = async () => {
    if (!match.odds) return;
    const { decimalA, decimalB, bookmaker } = match.odds;
    // Vig-inclusive implied probability for player A:
    // (1/decimalA) / (1/decimalA + 1/decimalB)
    const impliedProbA =
      decimalA > 0 && decimalB > 0
        ? Math.round((1 / decimalA) / (1 / decimalA + 1 / decimalB) * 100)
        : Math.round((1 / decimalA) * 100);
    setEmailSending(true);
    try {
      await sendTestAlert({
        matchId: match.id,
        playerA: playerA.name,
        playerB: playerB.name,
        probA,
        bookmaker,
        decimalA,
        impliedProbA,
      });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground",
        "shadow-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/30",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
      )}
    >
      {/* Header : tournoi + ronde + timer (+ LIVE badge when live) */}
      <header className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{match.tournament}</span>
          <span className="text-border">·</span>
          <span className="shrink-0">{match.round}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLive && (
            <span
              className="flex items-center gap-1 rounded-full bg-rose-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400"
              aria-label={t("liveAria")}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
              </span>
              {t("live")}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {isLive
                ? t("set", { n: liveState!.currentSet })
                : formatRelativeTime(match.scheduledAt, tTime)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              toggle(match.id);
              track("favorite_toggled", {
                match_id: match.id,
                player_a: playerA.name,
                player_b: playerB.name,
                added: !fav,
              });
            }}
            aria-label={fav ? t("removeFavorite") : t("addFavorite")}
            aria-pressed={fav}
            className={cn(
              "rounded-md p-1 transition-colors hover:bg-muted",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                fav
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            />
          </button>
        </div>
      </header>

      {/* Corps : carte duelle A + VS + B */}
      <div className={cn("px-4 sm:px-6", terminalMode ? "py-4" : "py-6 sm:py-8")}>
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
          <PlayerBlock
            player={playerA}
            align="left"
            priority={priority}
            terminalMode={terminalMode}
          >
            <PlayerStatline
              player={playerA}
              stats={statsA}
              surface={stats.surface}
              sparklineData={sparklineA}
              terminalMode={terminalMode}
            />
            <div className="mt-1.5">
              <FormDots
                form={playerA.form}
                color={playerA.color}
                size="sm"
                ariaLabel={`Forme récente ${playerA.name}`}
              />
            </div>
            {bestOddA && (
              <BestOddBadge
                decimal={bestOddA.decimalA}
                bookmaker={bestOddA.bookmaker}
                className="mt-2"
              />
            )}
            <QuickAddRing
              prob={probA}
              color={playerA.color}
              winLabel={t("win")}
              terminalMode={terminalMode}
              onQuickAdd={() => handleQuickAdd("A")}
              quickAddLabel={tSlip("quickAdd", { player: playerA.name })}
            />
          </PlayerBlock>
          <div className="flex items-center justify-center sm:py-0">
            <div
              className={cn(
                "flex items-center justify-center rounded-full",
                "border border-border/60 bg-muted/40 backdrop-blur-sm",
                "text-xs font-bold tracking-wider text-muted-foreground",
                terminalMode ? "h-8 w-8" : "h-11 w-11"
              )}
            >
              {t("vs")}
            </div>
          </div>
          <PlayerBlock
            player={playerB}
            align="right"
            priority={priority}
            terminalMode={terminalMode}
          >
            <PlayerStatline
              player={playerB}
              stats={statsB}
              surface={stats.surface}
              sparklineData={sparklineB}
              terminalMode={terminalMode}
            />
            <div className="mt-1.5">
              <FormDots
                form={playerB.form}
                color={playerB.color}
                size="sm"
                ariaLabel={`Forme récente ${playerB.name}`}
              />
            </div>
            {bestOddB && (
              <BestOddBadge
                decimal={bestOddB.decimalB}
                bookmaker={bestOddB.bookmaker}
                className="mt-2"
              />
            )}
            <QuickAddRing
              prob={probB}
              color={playerB.color}
              winLabel={t("win")}
              terminalMode={terminalMode}
              onQuickAdd={() => handleQuickAdd("B")}
              quickAddLabel={tSlip("quickAdd", { player: playerB.name })}
            />
          </PlayerBlock>
        </div>

        {/* Terminal mode: ProbabilityBar with IC bracket + decomposition —
            always visible for power users, replacing the per-player rings
            with a single dense horizontal bar that exposes the IC 95%
            bracket and the Elo / Forme / H2H weight decomposition inline. */}
        {terminalMode && (
          <div className="mt-4">
            <ProbabilityBar
              probA={probA}
              probB={probB}
              ic={stats.ic}
              colorA={playerA.color}
              colorB={playerB.color}
              shortNameA={playerA.shortName}
              shortNameB={playerB.shortName}
              weights={{ elo: 0.62, form: 0.24, h2h: 0.14 }}
              showDecomposition
            />
          </div>
        )}

        {/* Live score — shown only when the match is live */}
        {isLive && liveState && (
          <LiveScoreBar
            liveState={liveState}
            serverName={
              liveState.server === "A" ? playerA.name : playerB.name
            }
          />
        )}

        {/* Momentum DR — real-time EWMA-based dominance ratio */}
        {isLive && liveState && (
          <div className="mt-4">
            <MomentumDR
              liveState={liveState}
              player1Name={playerA.name}
              player2Name={playerB.name}
              player1Color={playerA.color}
              player2Color={playerB.color}
            />
          </div>
        )}

        {/* Live stats panel */}
        {isLive && liveState && (
          <div className="mt-4">
            <LiveStatsPanel
              matchId={match.id}
              player1Name={playerA.name}
              player2Name={playerB.name}
            />
          </div>
        )}

        {/* Cotes bookmaker (si dispo) */}
        {match.odds && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">
              {match.odds.bookmaker}
            </span>
            <span className="text-border">·</span>
            <span className="font-mono">
              {playerA.shortName}{" "}
              <span className="font-semibold text-foreground">
                {match.odds.decimalA.toFixed(2)}
              </span>
            </span>
            <span className="text-border">/</span>
            <span className="font-mono">
              {playerB.shortName}{" "}
              <span className="font-semibold text-foreground">
                {match.odds.decimalB.toFixed(2)}
              </span>
            </span>
            {match.allOdds && match.allOdds.length > 1 && onOpenDetail && (
              <>
                <span className="text-border" aria-hidden>·</span>
                <button
                  type="button"
                  onClick={onOpenDetail}
                  className="font-semibold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  +{match.allOdds.length - 1} {t("otherBookmakers")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats chips — fusion C (collapsed in A/B variant "chips_collapsed").
          In terminal mode the chips are ALWAYS expanded (power-user view),
          so we hide the collapse affordance entirely. */}
      {chipsCollapsedByDefault && !terminalMode && (
        <div className="px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setChipsExpanded((v) => !v)}
            className={cn(
              "mb-3 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold",
              "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-expanded={chipsExpanded}
          >
            {chipsExpanded ? t("hideStats") : t("seeStats")}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", chipsExpanded && "rotate-180")}
            />
          </button>
        </div>
      )}

      {chipsExpanded && (
        <div className="px-4 pb-4 sm:px-6">
          <StatsIndicatorsGrid
            stats={stats}
            surface={stats.surface}
          />
        </div>
      )}

      {/* Footer : source modèle + CTA parier + CTA détail (+ offline indicator) */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span className="font-semibold">{t("modelLabel")}</span>
            <span>{model}</span>
          </span>
          <BacktestBadge
            surface={stats.surface}
            eloGap={stats.eloGap}
            className="ml-0.5"
          />
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {isLive && liveState
                ? `${t("modelUpdated")} ${formatRelativeTime(liveState.lastUpdate, tTime)}`
                : `${t("modelUpdated")} ${formatRelativeTime(modelUpdatedAt, tTime)}`}
            </span>
          </span>
          {disconnected && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="text-border">·</span>
              <WifiOff className="h-3.5 w-3.5" />
              <span className="font-semibold">{t("offline")}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleDetail}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold",
              "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-expanded={open}
            aria-controls={`match-${match.id}-details`}
          >
            {open ? t("detailHide") : t("detail")}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
            />
          </button>
          {onOpenDetail && (
            <button
              type="button"
              onClick={onOpenDetail}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-semibold",
                "text-foreground transition-colors hover:bg-muted",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">{t("analysis")}</span>
              <span className="sm:hidden">{t("analysisShort")}</span>
            </button>
          )}
          {match.odds && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleEmailTestAlert}
                    disabled={emailSending}
                    aria-label={tEmail("testAlert")}
                    className={cn(
                      "flex items-center justify-center rounded-md border border-border/60 p-1.5",
                      "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-60"
                    )}
                  >
                    {emailSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{tEmail("testAlert")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button
            type="button"
            onClick={handleBetCta}
            className={cn(
              "flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white",
              "transition-colors hover:bg-emerald-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {t("bet")}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </footer>

      {/* Panneau détail — accordéon */}
      {open && (
        <div
          id={`match-${match.id}-details`}
          className="border-t border-border/60 bg-muted/10 px-4 py-4 sm:px-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              icon={<TrendingUp className="h-4 w-4" />}
              label={t("decompLabel")}
              value={t("decompValue", { model, eloA: playerA.elo, eloB: playerB.elo })}
              hint={t("decompHint")}
            />
            <DetailItem
              icon={<Target className="h-4 w-4" />}
              label={t("icLabel")}
              value={t("icValue", { lo: stats.ic[0], hi: stats.ic[1] })}
              hint={t("icHint", { prob: probA, amp: stats.ic[1] - stats.ic[0] })}
            />
            <DetailItem
              icon={<Scale className="h-4 w-4" />}
              label={t("eloGapLabel")}
              value={t("eloGapValue", { n: stats.eloGap })}
              hint={t("eloGapHint", { surface: stats.surface, h2h: stats.h2h, player: playerA.shortName })}
            />
            <DetailItem
              icon={<Calendar className="h-4 w-4" />}
              label={t("formLabel")}
              value={stats.form}
              hint={t("formHint", {
                pa: playerA.shortName,
                fa: playerA.form.join("-"),
                pb: playerB.shortName,
                fb: playerB.form.join("-"),
              })}
            />
          </div>

          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-semibold">{t("warning")} :</span>{" "}
            {t("warningText")}
          </div>
        </div>
      )}
    </article>
  );
}

// Live score bar shown between the players and the odds when isLive === true.
// Renders: "6-4, 3-2 · 30-15 · Sinner serving"
function LiveScoreBar({
  liveState,
  serverName,
}: {
  liveState: LiveMatchState;
  serverName: string;
}) {
  const t = useTranslations("match");
  const { scoreA, scoreB } = liveState;

  // Past sets joined with ", " — e.g. "6-4, 7-5"
  const setsStr = scoreA.sets
    .map((gA, i) => `${gA}-${scoreB.sets[i] ?? 0}`)
    .join(", ");

  // Current set games — e.g. "3-2"
  const gamesStr = `${scoreA.games}-${scoreB.games}`;

  // Combine sets + current games with ", " separator
  const scoreStr = setsStr ? `${setsStr}, ${gamesStr}` : gamesStr;

  // Current points — e.g. "30-15"
  const pointsStr = formatPoints(scoreA.points, scoreB.points);

  return (
    <div
      className={cn(
        "mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1",
        "rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2",
        "text-center text-xs font-medium text-rose-900 dark:text-rose-200",
      )}
      role="status"
      aria-live="polite"
      aria-label={t("servingAria", {
        score: scoreStr,
        points: pointsStr,
        server: serverName,
      })}
    >
      <span className="font-mono font-bold tabular-nums text-foreground">
        {scoreStr}
      </span>
      <span className="text-rose-400/60" aria-hidden>
        ·
      </span>
      <span className="font-mono tabular-nums">{pointsStr}</span>
      <span className="text-rose-400/60" aria-hidden>
        ·
      </span>
      <span className="flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
        </span>
        {t("serving", { name: serverName })}
      </span>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
