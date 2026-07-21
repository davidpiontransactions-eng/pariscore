"use client";

// MatchCardBroadcast — carte style TV broadcast (R7 refonte, 2026-07-21).
//
// Refonte complète de la carte match : remplace l'ancien empilement
// Header + SubHeader + duel par un hero riche style chaîne sportive :
//   - Image de fond (dégradé surface + logo tournoi watermark)
//   - Overlay top : tournoi · round · date · LIVE · favori
//   - Grid 3 colonnes : Joueur A | Score central | Joueur B
//   - Métriques colonne 4 lignes sous chaque joueur
//     (#rank · Elo · SPS#rank · Forme)
//   - Section détails repliable (Collapsible) avec toutes les sections
//     analytiques (momentum, proba, stats live, etc.)
//
// Résout le bug visuel du score "dédoublé" (Header + SubHeader empilés
// donnaient l'impression d'un doublon) en centralisant le score au milieu
// du hero.

import { useState, useEffect } from "react";
import { Calendar, Clock, Star, Trophy, ChevronDown, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { PlayerProfileHeader } from "./player-profile-header";
import { FormDots } from "./form-dots";
import { BestOddBadge } from "./best-odd-badge";
import { SetScoreline } from "./set-scoreline";
import { CurrentGameScore } from "./current-game-score";
import { ServerIndicator } from "./server-indicator";
import { QuickAddRing } from "./quick-add-ring";
import { ProbabilityBar } from "./probability-bar";
import { MomentumDR } from "./momentum-dr";
import { WinProbabilityChart } from "./win-probability-chart";
import { PointTimeline } from "./point-timeline";
import { LiveStatsPanel } from "./live-stats-panel";
import { StatsIndicatorsGrid } from "./stats-indicators-grid";
import { MatchCardDetail } from "./match-card-detail";
import { LiveScoreAnnouncer } from "./live-score-announcer";
import { fmtSPS } from "@/lib/tennis-stats/sps-utils";
import { resolveTournamentTheme } from "@/lib/tournament-theme";
import { useFormattedMatchTime } from "@/lib/tennis-format";
import { useMomentumDR } from "@/hooks/use-momentum-dr";
import { cn } from "@/lib/utils";

import { type TennisMatch, type Player } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import type { PlayerStats } from "@/lib/tennis-stats/types";
import { useFavorites } from "@/hooks/use-favorites";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useToast } from "@/hooks/use-toast";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { useAnalytics } from "@/components/analytics-provider";

// Normalisation identique à match-card.tsx pour la lookup stats enrichies.
function normForLookup(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const EM_DASH = "—";

type Props = {
  match: TennisMatch;
  defaultOpen?: boolean;
  chipsCollapsedByDefault?: boolean;
  liveState?: LiveMatchState;
  disconnected?: boolean;
  onOpenDetail?: () => void;
  onBetClick?: () => void;
  priority?: boolean;
};

export function MatchCardBroadcast({
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
  const [open, setOpen] = useState(defaultOpen || terminalMode);
  const [chipsExpanded, setChipsExpanded] = useState(!chipsCollapsedByDefault || terminalMode);
  const { track } = useAnalytics();
  const { isFavorite, toggle } = useFavorites();
  const { addToSlip, isFull } = useBetSlip();
  const { toast } = useToast();
  const fav = isFavorite(match.id);

  const { playerA, playerB, stats } = match;
  const isSynthetic = match.synthetic === true;
  const isLive = liveState?.isLive === true;
  const probA = isLive ? Math.round(liveState!.liveProbA) : match.probA;
  const probB = isLive ? Math.round(liveState!.liveProbB) : match.probB;

  // Thème tournoi (image fond + couleurs surface + logo).
  const theme = resolveTournamentTheme(match.tournament, stats.surface);

  // Stats enrichies (Elo/SPS/rangs) depuis la DB.
  const playerStatsNames = `${playerA.name},${playerB.name}`;
  const { data: playerStatsMap } = usePlayerStats(playerStatsNames, stats.surface);
  const statsA = playerStatsMap?.[normForLookup(playerA.name)];
  const statsB = playerStatsMap?.[normForLookup(playerB.name)];

  // Best odds (R7 review : conservés pour réintégration BestOddBadge).
  const bestOddA = match.allOdds?.length
    ? match.allOdds.reduce((max, o) => (o.decimalA > max.decimalA ? o : max))
    : null;
  const bestOddB = match.allOdds?.length
    ? match.allOdds.reduce((max, o) => (o.decimalB > max.decimalB ? o : max))
    : null;

  // Momentum hook (pour PointTimeline).
  const momentum = useMomentumDR(isLive ? liveState : undefined);
  const currentSetNum = (liveState?.currentSet ?? 0) + 1;
  const currentGameNum = liveState
    ? liveState.scoreA.games + liveState.scoreB.games + 1
    : 1;

  // Heure formatée en TZ navigateur (R5 hotfix).
  const formattedDateTime = useFormattedMatchTime(match.scheduledAt, "fr", "full");

  // Track view once per mount.
  useEffect(() => {
    track("match_card_view", {
      match_id: match.id,
      tournament: match.tournament,
      player_a: playerA.name,
      player_b: playerB.name,
      prob_a: probA,
      prob_b: probB,
      card_variant: "broadcast",
    });
  }, [match.id]);

  // Quick-add au bet slip (réutilisé de l'ancienne carte).
  const handleQuickAdd = (player: "A" | "B") => {
    const isA = player === "A";
    const playerName = isA ? playerA.name : playerB.name;
    const probClamped = Math.min(99, Math.max(1, isA ? probA : probB));
    const odd = match.odds
      ? isA
        ? match.odds.decimalA
        : match.odds.decimalB
      : 1 / (probClamped / 100);
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
        source: "broadcast_quick_add",
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

  const serverName =
    liveState?.server === "A" ? playerA.name : playerB.name;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 text-card-foreground",
        "shadow-md transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/40",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
      )}
    >
      {/* ════════════════════════════════════════════════════════════════
          HERO BROADCAST — image fond + overlay + grid 3 colonnes
          ════════════════════════════════════════════════════════════════ */}
      <div
        className="relative"
        style={{
          background: theme.background,
          minHeight: isLive ? 320 : 280,
        }}
      >
        {/* Logo tournoi en watermark (si tournoi reconnu) */}
        {theme.logoUrl && (
          <img
            src={theme.logoUrl}
            alt=""
            aria-hidden
            loading={priority ? "eager" : "lazy"}
            className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 transform opacity-10 sm:block"
            style={{ maxWidth: 180, maxHeight: 180, objectFit: "contain" }}
          />
        )}

        {/* Scrim sombre pour contraste du texte blanc */}
        <div className="absolute inset-0 bg-black/40" aria-hidden />

        {/* Overlay TOP : tournoi · round · date · LIVE · favori */}
        <div className="relative flex items-start justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white/90">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{match.tournament}</span>
              <span className="text-white/40">·</span>
              <span className="shrink-0 text-white/70">{match.round}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/60">
              <Calendar className="h-3 w-3" />
              <span>{formattedDateTime}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {t("live")}
              </span>
            )}
            {!isLive && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                <Clock className="h-3.5 w-3.5" />
              </div>
            )}
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
              className="rounded-md p-1 transition-colors hover:bg-white/10"
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  fav ? "fill-amber-400 text-amber-400" : "text-white/70 hover:text-white"
                )}
              />
            </button>
          </div>
        </div>

        {/* GRID 3 COLONNES : Joueur A | Score central | Joueur B */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 sm:gap-4 sm:px-6">
          {/* ─── Joueur A (gauche) ─── */}
          <BroadcastPlayerColumn
            player={playerA}
            stats={statsA}
            surface={stats.surface}
            align="left"
            priority={priority}
            isSynthetic={isSynthetic}
            isLive={isLive}
            prob={probA}
            winLabel={t("win")}
            onQuickAdd={() => handleQuickAdd("A")}
            quickAddLabel={tSlip("quickAdd", { player: playerA.name })}
            bestOdd={bestOddA ? { decimal: bestOddA.decimalA, bookmaker: bestOddA.bookmaker } : null}
            tTennis={tTennis}
          />

          {/* ─── Score central (LIVE) ou VS (prematch) ─── */}
          <div className="flex flex-col items-center gap-1 px-2">
            {isLive && liveState ? (
              <>
                <SetScoreline
                  scoreA={liveState.scoreA}
                  scoreB={liveState.scoreB}
                  className="text-lg font-bold text-white sm:text-2xl"
                />
                <CurrentGameScore
                  pointsA={liveState.scoreA.points}
                  pointsB={liveState.scoreB.points}
                  className="text-sm font-semibold text-white/90"
                />
                <ServerIndicator
                  server={liveState.server}
                  serverName={serverName}
                  className="text-[10px] text-white/60"
                />
              </>
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm",
                  terminalMode ? "h-9 w-9" : "h-12 w-12"
                )}
              >
                <span className="text-xs font-bold tracking-wider text-white/80">
                  {t("vs")}
                </span>
              </div>
            )}
          </div>

          {/* ─── Joueur B (droite, symétrique) ─── */}
          <BroadcastPlayerColumn
            player={playerB}
            stats={statsB}
            surface={stats.surface}
            align="right"
            priority={priority}
            isSynthetic={isSynthetic}
            isLive={isLive}
            prob={probB}
            winLabel={t("win")}
            onQuickAdd={() => handleQuickAdd("B")}
            quickAddLabel={tSlip("quickAdd", { player: playerB.name })}
            bestOdd={bestOddB ? { decimal: bestOddB.decimalB, bookmaker: bestOddB.bookmaker } : null}
            tTennis={tTennis}
          />
        </div>

        {/* Badge synthétique (si match live sans prematch) */}
        {isSynthetic && (
          <div className="relative px-4 pb-2 sm:px-6">
            <Badge
              variant="outline"
              className="gap-1 border-amber-400/40 bg-amber-500/10 text-amber-300"
              title={tTennis("syntheticBadge")}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {tTennis("syntheticBadge")}
            </Badge>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          ZONE LIVE ANALYTIQUE — TOUJOURS VISIBLE (hors Collapsible)
          R7.1 hotfix : ces composants étaient enfermés dans le Collapsible
          fermé par défaut → MomentumDR et WinProbabilityChart invisibles
          en live. Sortis pour correspondre au comportement de l'ancienne
          carte (match-card.tsx) où ils étaient dans le corps.
          ════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4 bg-card px-4 py-4 sm:px-6">
        {/* Win Predictor — ProbabilityBar horizontale.
            R7.1 : visible en live même pour synthetic (les probas sont
            réelles depuis BSD), et en prematch pour les matchs riches. */}
        {(isLive || !isSynthetic) && (
          <ProbabilityBar
            probA={probA}
            probB={probB}
            ic={!isSynthetic ? stats.ic : undefined}
            colorA={playerA.color}
            colorB={playerB.color}
            shortNameA={playerA.shortName}
            shortNameB={playerB.shortName}
            weights={terminalMode && !isSynthetic ? { elo: 0.62, form: 0.24, h2h: 0.14 } : undefined}
            showDecomposition={terminalMode && !isSynthetic}
          />
        )}

        {/* Cotes bookmaker + bouton "+N autres bookmakers" */}
        {match.odds && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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

        {/* Sections LIVE analytiques — MomentumDR + WinProbabilityChart +
            PointTimeline TOUJOURS VISIBLES en live (R7.1 hotfix). */}
        {isLive && liveState && (
          <>
            <MomentumDR
              liveState={liveState}
              player1Name={playerA.name}
              player2Name={playerB.name}
              player1Color={playerA.color}
              player2Color={playerB.color}
            />
            <WinProbabilityChart
              probA={liveState.liveProbA}
              probB={liveState.liveProbB}
              player1Name={playerA.name}
              player2Name={playerB.name}
              player1Color={playerA.color}
              player2Color={playerB.color}
            />
            <PointTimeline
              history={momentum.pointHistory}
              currentSet={currentSetNum}
              currentGame={currentGameNum}
              player1Name={playerA.name}
              player2Name={playerB.name}
              player1Color={playerA.color}
              player2Color={playerB.color}
            />
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION DÉTAILS REPLIABLE — stats secondaires + LiveStatsPanel
          ════════════════════════════════════════════════════════════════ */}
      <div className="bg-card">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`match-details-${match.id}`}
              onClick={() => {
                if (!open) {
                  track("detail_open", {
                    match_id: match.id,
                    player_a: playerA.name,
                    player_b: playerB.name,
                    card_variant: "broadcast",
                  });
                }
              }}
              className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 sm:px-6"
            >
              <span className="uppercase tracking-wider">
                {open ? t("hideStats") : t("seeStats")}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent id={`match-details-${match.id}`}>
            <div className="space-y-4 px-4 py-4 sm:px-6">
              {/* LiveStatsPanel (tableau stats détaillées) — dans repliable
                  car verbeux, pas essentiel au scan live. */}
              {isLive && liveState && (
                <LiveStatsPanel
                  matchId={match.id}
                  player1Name={playerA.name}
                  player2Name={playerB.name}
                />
              )}

              {/* Stats chips (fusion collapsable) */}
              {!isSynthetic && chipsExpanded && (
                <StatsIndicatorsGrid stats={stats} surface={stats.surface} />
              )}

              {/* Détail modèle (décomposition) */}
              {open && !isSynthetic && (
                <MatchCardDetail match={match} stats={stats} playerA={playerA} playerB={playerB} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Footer : modèle + CTAs + indicateur offline (date déjà dans l'overlay top) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground sm:px-6">
          <span className="font-mono">
            {match.model}
            {disconnected && (
              <span
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400"
                title={tTennis("offline")}
              >
                ● {tTennis("offline")}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {onBetClick && (
              <button
                type="button"
                onClick={() => {
                  track("bet_cta_click", {
                    match_id: match.id,
                    player_a: playerA.name,
                    player_b: playerB.name,
                    prob_a: probA,
                    bookmaker: match.odds?.bookmaker ?? "unknown",
                    decimal_a: match.odds?.decimalA,
                    decimal_b: match.odds?.decimalB,
                  });
                  onBetClick();
                }}
                className="font-semibold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
              >
                {t("placeBet")}
              </button>
            )}
            {onOpenDetail && (
              <button
                type="button"
                onClick={onOpenDetail}
                className="font-semibold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
              >
                {t("deepAnalysis")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live score announcer (sr-only, a11y) */}
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

// ════════════════════════════════════════════════════════════════════════
// Sous-composant : colonne joueur (avatar + nom + métriques colonne 4 lignes)
// ════════════════════════════════════════════════════════════════════════

function BroadcastPlayerColumn({
  player,
  stats,
  surface,
  align,
  priority,
  isSynthetic,
  isLive,
  prob,
  winLabel,
  onQuickAdd,
  quickAddLabel,
  bestOdd,
  tTennis,
}: {
  player: Player;
  stats?: PlayerStats | null;
  surface: string;
  align: "left" | "right";
  priority?: boolean;
  isSynthetic: boolean;
  isLive: boolean;
  prob: number;
  winLabel: string;
  onQuickAdd: () => void;
  quickAddLabel: string;
  bestOdd: { decimal: number; bookmaker: string } | null;
  tTennis: (key: string) => string;
}) {
  // Résolution métriques (depuis player-statline.tsx, format vertical)
  const elo = Math.round(stats?.elo ?? player.elo);
  const rank = stats?.atpRank ?? stats?.wtaRank ?? null;
  const circuitLabel = stats?.atpRank != null ? "ATP" : stats?.wtaRank != null ? "WTA" : null;
  const sps = stats?.sps ?? null;
  const spsRank = stats?.spsRank ?? null;

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3">
      {/* Avatar + anneau couleur */}
      <PlayerProfileHeader
        name={player.name}
        photoUrl={player.photoUrl}
        color={player.color}
        size="md"
        priority={priority}
      />

      {/* Nom du joueur (gros) */}
      <h3
        className="max-w-full truncate text-sm font-bold leading-tight text-white sm:text-base"
        title={player.name}
      >
        {player.name}
      </h3>

      {/* Colonne métriques 4 lignes (R7 review : white/60 minimum pour AA strict) */}
      <div className="flex flex-col items-center gap-0.5 font-mono text-[11px] tabular-nums">
        {/* Ligne 1 : classement */}
        <span className="text-white/80">
          {rank != null ? `#${rank} ${circuitLabel ?? ""}` : `#${EM_DASH}`}
        </span>
        {/* Ligne 2 : Elo */}
        <span className="text-white/80">Elo {elo}</span>
        {/* Ligne 3 : SPS + rang */}
        {sps != null ? (
          <span className="text-white/80">
            SPS {fmtSPS(sps)}
            {spsRank != null && spsRank > 0 && (
              <span className="text-white/60"> #{spsRank}</span>
            )}
          </span>
        ) : (
          <span className="text-white/60">SPS {EM_DASH}</span>
        )}
        {/* Ligne 4 : Forme (dots) */}
        {!isSynthetic && (
          <FormDots
            form={player.form}
            color={player.color}
            size="sm"
            ariaLabel={`${player.name}`}
          />
        )}
      </div>

      {/* Best odd (R7 review : réintégré) */}
      {bestOdd && (
        <BestOddBadge
          decimal={bestOdd.decimal}
          bookmaker={bestOdd.bookmaker}
          className="mt-1"
        />
      )}

      {/* QuickAddRing en prematch ou live (anneau proba) */}
      {!isSynthetic || isLive ? (
        <QuickAddRing
          prob={prob}
          color={player.color}
          winLabel={winLabel}
          terminalMode={false}
          onQuickAdd={onQuickAdd}
          quickAddLabel={quickAddLabel}
          className="mt-1"
        />
      ) : null}
    </div>
  );
}
