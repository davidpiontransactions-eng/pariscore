"use client";

import { useEffect, useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProbabilityBar } from "./probability-bar";
import { FormDots } from "./form-dots";
import { PlayerStatline } from "./player-statline";
import { StatsIndicatorsGrid } from "./stats-indicators-grid";
import { PlayerBlock } from "./player-block";
import { QuickAddRing } from "./quick-add-ring";
import { BestOddBadge } from "./best-odd-badge";
import { LiveStatsPanel } from "./live-stats-panel";
import { MomentumDR } from "./momentum-dr";
import { WinProbabilityChart } from "./win-probability-chart";
import { PointTimeline } from "./point-timeline";
import { LiveScoreAnnouncer } from "./live-score-announcer";
import { MatchCardHeader, LiveScoreSubHeader } from "./match-card-header";
import { MatchCardFooter } from "./match-card-footer";
import { MatchCardDetail } from "./match-card-detail";


import { type TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useFavorites } from "@/hooks/use-favorites";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useEloSparkline } from "@/hooks/use-elo-sparkline";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useToast } from "@/hooks/use-toast";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { useMomentumDR } from "@/hooks/use-momentum-dr";
import { Badge } from "@/components/ui/badge";

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

// NOTE: formatPoints() was removed in Phase 4 — its only caller (LiveScoreBar)
// was deleted because SetScoreline + CurrentGameScore + ServerIndicator in the
// header now cover the same info more cleanly. The shared implementation
// lives in src/lib/tennis-format.ts (used by current-game-score.tsx).

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
  const tSlip = useTranslations("betSlip");
  const tTennis = useTranslations("tennis");
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
  const { playerA, playerB, stats, modelUpdatedAt } = match;

  // Synthetic live-only cards (no prematch ID): all predictive values are
  // placeholders. We hide the fake predictive UI and show a disclaimer badge
  // instead, to avoid the perceived deception flagged by the security audit.
  const isSynthetic = match.synthetic === true;

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

  // Momentum hook for PointTimeline — also used by MomentumDR (each instance
  // keeps its own ref-buffer but diffs the same liveState, so they stay in
  // sync). We extract pointHistory + current set/game for the PointTimeline
  // component below.
  const momentum = useMomentumDR(isLive ? liveState : undefined);
  const currentSetNum = (liveState?.currentSet ?? 0) + 1;
  const currentGameNum =
    liveState ? (liveState.scoreA.games + liveState.scoreB.games) + 1 : 1;

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
      <MatchCardHeader
        match={match}
        isLive={isLive}
        liveState={liveState}
        isFav={fav}
        onToggleFavorite={() => {
          toggle(match.id);
          track("favorite_toggled", {
            match_id: match.id,
            player_a: playerA.name,
            player_b: playerB.name,
            added: !fav,
          });
        }}
      />

      {/* Phase 4.D hotfix : sous-header live dédié pleine largeur pour
          éviter le débordement du header (le cluster score + badge LIVE
          + favori ne tenait pas dans la colonne droite). */}
      {isLive && liveState && (
        <LiveScoreSubHeader match={match} liveState={liveState} />
      )}

      {/* Corps : carte duelle A + VS + B
          Phase 4.D hotfix layout : grid-cols-3 strict (au lieu de 1fr_auto_1fr
          qui s'effondrait sur grand nom de joueur). Chaque colonne est
          min-w-0 (autorise le shrink) pour que truncate fonctionne dans
          les noms longs (ex: "Frederico Ferreira Silva"). */}
      <div className={cn("px-4 sm:px-6", terminalMode ? "py-4" : "py-6 sm:py-8")}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
          <div className="min-w-0 overflow-hidden">
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
            {!isSynthetic && (
              <div className="mt-1.5">
                <FormDots
                  form={playerA.form}
                  color={playerA.color}
                  size="sm"
                  ariaLabel={`Forme récente ${playerA.name}`}
                />
              </div>
            )}
            {bestOddA && (
              <BestOddBadge
                decimal={bestOddA.decimalA}
                bookmaker={bestOddA.bookmaker}
                className="mt-2"
              />
            )}
            {isSynthetic ? (
              <Badge
                variant="outline"
                className="mt-3 max-w-full gap-1 whitespace-normal break-words text-center border-amber-500/40 text-amber-600 dark:text-amber-400"
                title={tTennis("syntheticBadge")}
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {tTennis("syntheticBadge")}
              </Badge>
            ) : (
              <QuickAddRing
                prob={probA}
                color={playerA.color}
                winLabel={t("win")}
                terminalMode={terminalMode}
                onQuickAdd={() => handleQuickAdd("A")}
                quickAddLabel={tSlip("quickAdd", { player: playerA.name })}
              />
            )}
          </PlayerBlock>
          </div>

          <div className="flex items-center justify-center self-center px-1">
            <div
              className={cn(
                "flex items-center justify-center rounded-full",
                "border border-border/60 bg-muted/40 backdrop-blur-sm",
                "text-xs font-bold tracking-wider text-muted-foreground",
                terminalMode ? "h-8 w-8 shrink-0" : "h-11 w-11 shrink-0"
              )}
            >
              {t("vs")}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
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
            {!isSynthetic && (
              <div className="mt-1.5">
                <FormDots
                  form={playerB.form}
                  color={playerB.color}
                  size="sm"
                  ariaLabel={`Forme récente ${playerB.name}`}
                />
              </div>
            )}
            {bestOddB && (
              <BestOddBadge
                decimal={bestOddB.decimalB}
                bookmaker={bestOddB.bookmaker}
                className="mt-2"
              />
            )}
            {isSynthetic ? (
              <Badge
                variant="outline"
                className="mt-3 max-w-full gap-1 whitespace-normal break-words text-center border-amber-500/40 text-amber-600 dark:text-amber-400"
                title={tTennis("syntheticBadge")}
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {tTennis("syntheticBadge")}
              </Badge>
            ) : (
              <QuickAddRing
                prob={probB}
                color={playerB.color}
                winLabel={t("win")}
                terminalMode={terminalMode}
                onQuickAdd={() => handleQuickAdd("B")}
                quickAddLabel={tSlip("quickAdd", { player: playerB.name })}
              />
            )}
          </PlayerBlock>
          </div>
        </div>

        {/* Terminal mode: ProbabilityBar with IC bracket + decomposition —
            always visible for power users, replacing the per-player rings
            with a single dense horizontal bar that exposes the IC 95%
            bracket and the Elo / Forme / H2H weight decomposition inline.
            Skipped for synthetic cards: the IC bracket and weights would
            be placeholders. */}
        {terminalMode && !isSynthetic && (
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

        {/* Win probability curve (live) — area chart of liveProbA over time.
            Phase 3 component integrated here in Phase 4. */}
        {isLive && liveState && (
          <div className="mt-4">
            <WinProbabilityChart
              probA={liveState.liveProbA}
              probB={liveState.liveProbB}
              player1Name={playerA.name}
              player2Name={playerB.name}
              player1Color={playerA.color}
              player2Color={playerB.color}
            />
          </div>
        )}

        {/* Point timeline (live) — dots for each point of the current game.
            Uses momentum.pointHistory filtered by current set/game. */}
        {isLive && liveState && (
          <div className="mt-4">
            <PointTimeline
              history={momentum.pointHistory}
              currentSet={currentSetNum}
              currentGame={currentGameNum}
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
          so we hide the collapse affordance entirely. Skipped entirely for
          synthetic cards: Surface / Écart Elo / IC 95% are placeholders. */}
      {chipsCollapsedByDefault && !terminalMode && !isSynthetic && (
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

      {chipsExpanded && !isSynthetic && (
        <div className="px-4 pb-4 sm:px-6">
          <StatsIndicatorsGrid
            stats={stats}
            surface={stats.surface}
          />
        </div>
      )}

      <MatchCardFooter
        match={match}
        statsA={statsA}
        statsB={statsB}
        isLive={isLive}
        liveState={liveState}
        disconnected={disconnected}
        open={open}
        emailSending={emailSending}
        modelUpdatedAt={modelUpdatedAt}
        onToggleDetail={handleToggleDetail}
        onOpenDetail={onOpenDetail}
        onEmailTestAlert={handleEmailTestAlert}
        onBetCta={handleBetCta}
      />

      {open && (
        <MatchCardDetail
          match={match}
          stats={stats}
          playerA={playerA}
          playerB={playerB}
        />
      )}

      {/* Live score announcer — sr-only LiveRegion for screen readers.
          Announces game/set wins, score changes, break points (WCAG 4.1.3). */}
      {isLive && liveState && (
        <LiveScoreAnnouncer
          liveState={liveState}
          player1Name={playerA.name}
          player2Name={playerB.name}
        />
      )}
    </article>
  );
}

