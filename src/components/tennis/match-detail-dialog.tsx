"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Calendar, Trophy, Scale, Activity, Target, Check, X, Zap, Swords, Loader2, AlertTriangle } from "lucide-react";
import type { TennisMatch } from "@/lib/tennis-data";
import type { PlayerTournamentStats } from "@/lib/tournament-stats-engine";
import { OddsComparator } from "./odds-comparator";
import { LastMatchesList } from "./last-matches-list";
import { KpiCard } from "./kpi-card";
import { ConfidenceInterval } from "./confidence-interval";
import { CountryFlag } from "./country-flag";
import { SurfaceBadge } from "./surface-badge";
import { TournamentBadge } from "./tournament-badge";
import { PlayerVsBlock } from "./player-vs-block";
import { useEloHistory } from "@/hooks/use-elo-history";
import { useBSDMatchDetail } from "@/hooks/use-bsd-match-detail";
import { useLastMatchHighlights } from "@/hooks/use-last-match-highlights";
import { LastMatchHighlightsWidget } from "@/components/tennis/last-match-highlights-widget";
import { usePreviousRoundHighlights } from "@/hooks/use-previous-round-highlights";
import { PreviousRoundHighlightsWidget } from "@/components/tennis/previous-match-highlights-widget";
import { useBrowserTimeZone, formatInTimeZone } from "@/lib/tennis-format";
import { cn } from "@/lib/utils";
import { FrenchBroadcasterBadge } from "@/components/tennis/french-broadcaster-badge";
import { useTournamentStats } from "@/hooks/use-tournament-stats";
import { PressReviewPanel } from "@/components/tennis/press-review-panel";
import { EditorialInsight } from "@/components/ai/editorial-insight";

type Props = {
  match: TennisMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FormDot({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[11px] font-bold",
        result === "W"
          ? "bg-emerald-500/20 text-emerald-600"
          : "bg-rose-500/20 text-rose-600",
      )}
    >
      {result === "W" ? <Check className="h-2 w-2" /> : <X className="h-2 w-2" />}
    </span>
  );
}

function StatCell({ label, valueA, valueB, unit, higherIsBetter }: {
  label: string;
  valueA: number | null | undefined;
  valueB: number | null | undefined;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const hasA = valueA !== null && valueA !== undefined;
  const hasB = valueB !== null && valueB !== undefined;
  const va = hasA ? (valueA as number) : 0;
  const vb = hasB ? (valueB as number) : 0;
  const pct = hasA || hasB ? (va + vb > 0 ? (va / (va + vb)) * 100 : 50) : 0;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 p-3">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold" style={{ color: pct >= 50 ? undefined : undefined }}>
          {hasA ? va : "—"}{hasA ? unit ?? "" : ""}
        </span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="rounded-l-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
          />
        </div>
        <span className="text-base font-bold">
          {hasB ? vb : "—"}{hasB ? unit ?? "" : ""}
        </span>
      </div>
    </div>
  );
}

export function MatchDetailDialog({ match, open, onOpenChange }: Props) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const browserTz = useBrowserTimeZone();
  const { data: eloHistoryData, isLoading: eloLoading } = useEloHistory(match?.id ?? null);
  const {
    match: bsdMatch,
    odds: bsdOdds,
    h2h: bsdH2h,
    prediction: bsdPrediction,
    pointByPoint: bsdPointByPoint,
    isLoading: bsdLoading,
  } = useBSDMatchDetail(match?.id ?? null);
  const { data: tournamentStats, isLoading: tournamentStatsLoading } = useTournamentStats(match?.id ?? null);
  const { data: lmHighlights, isLoading: lmHighlightsLoading } = useLastMatchHighlights(
    match ? match.playerA.name : null,
    match ? match.playerB.name : null,
    match ? match.tournament : null,
  );
  const { data: prevRound, isLoading: prevRoundLoading } = usePreviousRoundHighlights(
    match?.id ?? null,
    match ? { id: match.playerA.id, name: match.playerA.name } : null,
    match ? { id: match.playerB.id, name: match.playerB.name } : null,
    match?.tournament ?? null,
    match?.stats.surface ?? null,
  );

  if (!match) return null;

  const { playerA, playerB, probA, probB, stats, allOdds, h2hHistory } = match;

  const h2hData = bsdH2h?.h2h ?? null;
  const h2hDisplay = h2hData
    ? { winsA: h2hData.player1_wins, winsB: h2hData.player2_wins, total: h2hData.total_matches }
    : { winsA: Number(stats.h2h.split("-")[0] ?? 0), winsB: Number(stats.h2h.split("-")[1] ?? 0), total: (h2hHistory ?? []).length };

  const h2hWinsA = h2hDisplay.winsA;
  const h2hWinsB = h2hDisplay.winsB;

  const formData = playerA.form.map((res, i) => ({
    match: i + 1,
    [playerA.shortName]: res === "W" ? 1 : 0,
    [playerB.shortName]: playerB.form[i] === "W" ? 1 : 0,
  }));

  const eloProgression = (eloHistoryData && match
    ? eloHistoryData.a.history.map((point, i) => {
        const bPoint = eloHistoryData.b.history[i];
        return {
          date: point.date,
          label: formatInTimeZone(point.date, locale, "month_year", browserTz),
          [match.playerA.shortName]: point.elo,
          ...(bPoint ? { [match.playerB.shortName]: bPoint.elo } : {}),
        };
      })
    : []) as Array<Record<string, string | number>>;

  const h2hSurfaceData = h2hData
    ? Object.entries(h2hData.by_surface).map(([surface, data]) => ({
        surface,
        [playerA.shortName]: data.player1_wins,
        [playerB.shortName]: data.total - data.player1_wins,
      }))
    : Object.entries(
        (h2hHistory ?? []).reduce(
          (acc, h) => {
            if (!acc[h.surface]) acc[h.surface] = { a: 0, b: 0 };
            if (h.winnerId === playerA.id) acc[h.surface].a++;
            else acc[h.surface].b++;
            return acc;
          },
          {} as Record<string, { a: number; b: number }>
        )
      ).map(([surface, wins]) => ({
        surface,
        [playerA.shortName]: wins.a,
        [playerB.shortName]: wins.b,
      }));

  // BSD odds enrichissent le panneau odds avec les bookmakers réels
  const enrichedOdds = bsdOdds && bsdOdds.bookmakers.length > 0
    ? bsdOdds.bookmakers.map((bm) => ({
        bookmaker: bm.bookmaker,
        decimalA: bm.odds_player1,
        decimalB: bm.odds_player2,
        impliedProbA: Math.round((1 / bm.odds_player1) / (1 / bm.odds_player1 + 1 / bm.odds_player2) * 100),
        impliedProbB: Math.round((1 / bm.odds_player2) / (1 / bm.odds_player1 + 1 / bm.odds_player2) * 100),
        margin: Math.round(((1 / bm.odds_player1 + 1 / bm.odds_player2) - 1) * 1000) / 1000,
      }))
    : allOdds;

  // Stats détaillées BSD
  const b = bsdMatch;
  const serveStats = b ? [
    { label: "Aces", valueA: b.p1_aces, valueB: b.p2_aces },
    { label: "Doubles fautes", valueA: b.p1_double_faults, valueB: b.p2_double_faults, higherIsBetter: false },
    { label: "1er service %", valueA: b.p1_first_serve_pct, valueB: b.p2_first_serve_pct, unit: "%" },
    { label: "1er service gagné %", valueA: b.p1_first_serve_won_pct, valueB: b.p2_first_serve_won_pct, unit: "%" },
    { label: "2e service gagné %", valueA: b.p1_second_serve_won_pct, valueB: b.p2_second_serve_won_pct, unit: "%" },
    { label: "Break pts sauvés %", valueA: b.p1_break_points_saved_pct, valueB: b.p2_break_points_saved_pct, unit: "%" },
  ] : [];

  // Stats moyennes PAR TOURNOI (édition en cours + fallback saison sur dur)
  const aNumericId = parseInt(playerA.id.replace(/^bsd-/, ""), 10);
  const bNumericId = parseInt(playerB.id.replace(/^bsd-/, ""), 10);
  const tsPlayers = tournamentStats?.players ?? [];
  const tsA = tsPlayers.find((p) => p.playerId === aNumericId) ?? tsPlayers[0] ?? null;
  const tsB = tsPlayers.find((p) => p.playerId === bNumericId) ?? tsPlayers[1] ?? null;
  const hasTournamentStats = !!tournamentStats && !!tsA && !!tsB &&
    (tsA.matchesPlayed > 0 || tsB.matchesPlayed > 0);
  // Stats du match en cours — affichées uniquement si au moins une valeur réelle
  // (évite l'écran de zéros bouchonnés pour les matchs à venir).
  const liveMatchHasStats = serveStats.some((s) => s.valueA !== null || s.valueB !== null);
  const nameColorOf = (ts: PlayerTournamentStats): { name: string; color: string } => {
    if (ts.playerId === aNumericId) return { name: playerA.shortName, color: playerA.color };
    if (ts.playerId === bNumericId) return { name: playerB.shortName, color: playerB.color };
    return tsPlayers.indexOf(ts) === 0
      ? { name: playerA.shortName, color: playerA.color }
      : { name: playerB.shortName, color: playerB.color };
  };

  const tournamentServeRows = hasTournamentStats && tsA && tsB
    ? [
        { label: "Aces", valueA: tsA.acesPerMatch, valueB: tsB.acesPerMatch },
        { label: "Doubles fautes", valueA: tsA.doubleFaultsPerMatch, valueB: tsB.doubleFaultsPerMatch, higherIsBetter: false },
        { label: "1er service %", valueA: tsA.firstServePct, valueB: tsB.firstServePct, unit: "%" },
        { label: "1er service gagné %", valueA: tsA.firstServeWonPct, valueB: tsB.firstServeWonPct, unit: "%" },
        { label: "2e service gagné %", valueA: tsA.secondServeWonPct, valueB: tsB.secondServeWonPct, unit: "%" },
        { label: "Break pts sauvés %", valueA: tsA.breakPointsSavedPct, valueB: tsB.breakPointsSavedPct, unit: "%" },
      ]
    : [];

  const matchStatsSection = liveMatchHasStats ? (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-muted-foreground">
          Statistiques de service · ce match
        </span>
        {b?.sets_detail && b.sets_detail.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Sets : {b.sets_detail.map((s) => `${s.p1}-${s.p2}`).join(", ")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {serveStats.map((s) => (
          <StatCell
            key={s.label}
            label={s.label}
            valueA={s.valueA}
            valueB={s.valueB}
            unit={s.unit}
            higherIsBetter={s.higherIsBetter}
          />
        ))}
      </div>
    </>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[min(90vw,56rem)] overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <TournamentBadge category={match.tournamentCategory} />
            <SurfaceBadge surface={stats.surface} />
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              {t("title")}
            </span>
          </div>

          <DialogTitle className="mt-2 flex items-center justify-between gap-2 text-base">
            <div className="flex flex-1 items-center gap-2">
              <CountryFlag countryCode={playerA.country} size="lg" />
              <span className="truncate font-bold">{playerA.shortName}</span>
            </div>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">VS</span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <span className="truncate font-bold">{playerB.shortName}</span>
              <CountryFlag countryCode={playerB.country} size="lg" />
            </div>
          </DialogTitle>

          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Trophy className="h-3 w-3" />
              <span>{match.tournament}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{match.round}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {match.synthetic || match.insufficientData ? (
                <span className="italic">Données ELO indisponibles</span>
              ) : (
                <>
                  <span>#{playerA.rank} Elo {playerA.elo.toFixed(0)}</span>
                  <span className="text-muted-foreground/50">/</span>
                  <span>#{playerB.rank} Elo {playerB.elo.toFixed(0)}</span>
                </>
              )}
            </div>
          </div>

          <DialogDescription className="text-[11px] text-muted-foreground/70">
            {match.modelUpdatedAt && (
              <>Mis à jour : {formatInTimeZone(match.modelUpdatedAt, locale, "full", browserTz)}</>
            )}
          </DialogDescription>

          <div className="mt-2 flex justify-center">
            <FrenchBroadcasterBadge tournament={match.tournament} />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="px-5 py-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="text-xs">{t("tabs.overview")}</TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
                <TabsTrigger value="h2h" className="text-xs">{t("tabs.h2h")}</TabsTrigger>
                <TabsTrigger value="form" className="text-xs">{t("tabs.form")}</TabsTrigger>
                <TabsTrigger value="odds" className="text-xs">{t("tabs.odds")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                  {match.synthetic || match.insufficientData ? (
                    <KpiCard
                      icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                      label={t("centralProb")}
                      value={<span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Indisponible</span>}
                      description={<span>Données prédictives non disponibles pour ce match en direct</span>}
                    />
                  ) : (
                    <>
                      <KpiCard
                        icon={<Activity className="h-4 w-4" />}
                        label={t("centralProb")}
                        value={
                          <div className="flex items-baseline gap-2">
                            <span style={{ color: playerA.color }}>{probA.toFixed(2)}%</span>
                            <span className="text-sm font-semibold text-muted-foreground">/</span>
                            <span style={{ color: playerB.color }}>{probB.toFixed(2)}%</span>
                          </div>
                        }
                        description={
                          <span>
                            {t("centralProbHint", { a: playerA.shortName, b: playerB.shortName })}
                          </span>
                        }
                        trend={probA > probB ? "up" : "down"}
                      />
                      <KpiCard
                        icon={<Scale className="h-4 w-4" />}
                        label={t("eloGap")}
                        value={
                          <span className={stats.eloGap >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {stats.eloGap > 0 ? "+" : ""}{stats.eloGap.toFixed(2)}
                          </span>
                        }
                        description={t("eloGapHint", { surface: stats.surface })}
                      />
                      <KpiCard
                        icon={<Target className="h-4 w-4" />}
                        label={t("confidence")}
                        value={`${(stats.confidence * 100).toFixed(2)}%`}
                        description={t("confidenceHint", { lo: stats.ic[0].toFixed(2), hi: stats.ic[1].toFixed(2) })}
                        badge={`IC 95%`}
                      />
                    </>
                  )}
                </div>

                {/* Signal externe : prédiction du modèle BSD (probabilités en %),
                    comparée au modèle maison (probA/probB) — divergence = opportunité. */}
                {bsdPrediction && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <Target className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      Modèle BSD
                    </span>
                    <span className="text-sm font-bold" style={{ color: playerA.color }}>
                      {bsdPrediction.prob_player1_wins.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-sm font-bold" style={{ color: playerB.color }}>
                      {bsdPrediction.prob_player2_wins.toFixed(1)}%
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      conf. {bsdPrediction.confidence.toFixed(0)}%
                    </span>
                    {Math.abs(probA - bsdPrediction.prob_player1_wins) >= 5 && (
                      <span
                        className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                        title="Écart ≥ 5 pts entre le modèle maison et le modèle BSD"
                      >
                        Divergence
                      </span>
                    )}
                  </div>
                )}

                <PlayerVsBlock
                  playerA={{
                    name: playerA.name,
                    shortName: playerA.shortName,
                    color: playerA.color,
                    photoUrl: playerA.photoUrl,
                    country: playerA.country,
                    rank: playerA.rank,
                    elo: playerA.elo,
                  }}
                  playerB={{
                    name: playerB.name,
                    shortName: playerB.shortName,
                    color: playerB.color,
                    photoUrl: playerB.photoUrl,
                    country: playerB.country,
                    rank: playerB.rank,
                    elo: playerB.elo,
                  }}
                  probA={probA}
                  probB={probB}
                  playerSlot={(p) => (
                    <span className="text-[11px] text-muted-foreground">
                      {match.synthetic || match.insufficientData
                        ? "Données indisponibles"
                        : `#${p.rank} · Elo ${p.elo?.toFixed(0) ?? "N/A"}`
                      }
                    </span>
                  )}
                />

                <ConfidenceInterval
                  icon={<Target className="h-4 w-4" />}
                  playerA={{
                    shortName: playerA.shortName,
                    value: probA,
                    ciLow: stats.ic[0],
                    ciHigh: stats.ic[1],
                    color: playerA.color,
                  }}
                  playerB={{
                    shortName: playerB.shortName,
                    value: probB,
                    ciLow: 100 - stats.ic[1],
                    ciHigh: 100 - stats.ic[0],
                    color: playerB.color,
                  }}
                  label={t("icTitle")}
                  interpretation={t("icInterpretation", {
                    player: playerA.shortName,
                    lo: stats.ic[0],
                    hi: stats.ic[1],
                    level: 95,
                  })}
                  variant="v2"
                />

                {/* Avertissement données insuffisantes (cartes synthétiques live) */}
                {(match.synthetic || match.insufficientData) && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-semibold">{t("insufficientDataTitle") ?? "Données insuffisantes"}</p>
                      <p className="mt-0.5 text-amber-600/80 dark:text-amber-400/80">
                        {t("insufficientDataHint") ?? "Ce match est en direct et ne dispose pas encore des données prédictives complètes (ELO, probabilités, intervalles de confiance). Les valeurs affichées sont des placeholders."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Revue de presse — 3+ prédictions de la presse spécialisée */}
                <PressReviewPanel
                  matchId={match.id}
                  playerA={playerA.name}
                  playerB={playerB.name}
                  tournament={match.tournament}
                  surface={stats.surface}
                />

                {/* Analyse éditoriale — résumé expert d'un média de référence */}
                <EditorialInsight
                  sport="tennis"
                  matchId={match.id}
                  playerA={playerA.name}
                  playerB={playerB.name}
                  variant="full"
                />

                {/* Highlights du dernier match joué (H2H > joueurs > tournoi) */}
                <LastMatchHighlightsWidget
                  h2h={lmHighlights?.h2h ?? null}
                  players={[
                    { playerName: playerA.name, highlight: lmHighlights?.playerA ?? null },
                    { playerName: playerB.name, highlight: lmHighlights?.playerB ?? null },
                  ]}
                  tournamentHighlight={lmHighlights?.tournament ?? null}
                  isLoading={lmHighlightsLoading}
                />

                {/* Highlights du tour précédent — dernier match réellement joué par chaque joueur */}
                <PreviousRoundHighlightsWidget
                  players={prevRound?.players ?? []}
                  tourPreviousLabel={t("highlightsPrevious.tourPrevious")}
                  lastMatchLabel={t("highlightsPrevious.lastMatch")}
                  opponentTemplate={t("highlightsPrevious.opponent")}
                  loadingLabel={t("highlightsPrevious.loading")}
                  openYoutubeLabel={t("highlightsPrevious.openYoutube")}
                  isLoading={prevRoundLoading}
                />
              </TabsContent>

              {/* Onglet Stats — moyennes par tournoi (éditions en cours + fallback saison) */}
              <TabsContent value="stats" className="mt-4 space-y-3">
                {tournamentStatsLoading || bsdLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm">Chargement des stats…</span>
                  </div>
                ) : hasTournamentStats ? (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("statsTournamentTitle", {
                            tournament: tournamentStats?.tournamentName ?? match.tournament,
                          })}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {tsA && (
                          <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold" style={{ color: nameColorOf(tsA).color }}>
                                {nameColorOf(tsA).name}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  tsA.source === "tournament"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {tsA.source === "tournament"
                                  ? t("statsTournamentSource")
                                  : t("statsSeasonHardSource", { year: tournamentStats?.season ?? new Date().getFullYear() })}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t("statsMatches", { n: tsA.matchesPlayed })}
                            </div>
                          </div>
                        )}
                        {tsB && (
                          <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold" style={{ color: nameColorOf(tsB).color }}>
                                {nameColorOf(tsB).name}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  tsB.source === "tournament"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {tsB.source === "tournament"
                                  ? t("statsTournamentSource")
                                  : t("statsSeasonHardSource", { year: tournamentStats?.season ?? new Date().getFullYear() })}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t("statsMatches", { n: tsB.matchesPlayed })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {tournamentServeRows.map((s) => (
                          <StatCell
                            key={s.label}
                            label={s.label}
                            valueA={s.valueA}
                            valueB={s.valueB}
                            unit={s.unit}
                            higherIsBetter={s.higherIsBetter}
                          />
                        ))}
                      </div>
                    </div>

                    {matchStatsSection}
                  </>
                ) : matchStatsSection ? (
                  matchStatsSection
                ) : (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Swords className="mr-2 h-4 w-4" />
                    Stats non disponibles (match à venir)
                  </div>
                )}

                {/* Détail des points BSD (matchs terminés/en cours) */}
                {bsdPointByPoint && bsdPointByPoint.sets.length > 0 && (
                  <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        Détail des points (BSD)
                      </span>
                      {bsdPointByPoint.sets[0].duration_seconds > 0 && (
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {Math.round(bsdPointByPoint.sets[0].duration_seconds / 60)} min au 1er set
                        </span>
                      )}
                    </div>
                    {bsdPointByPoint.sets.map((set) => (
                      <div key={set.set} className="mb-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Set {set.set}
                          {set.duration_seconds > 0
                            ? ` · ${Math.round(set.duration_seconds / 60)} min`
                            : ""}
                        </div>
                        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                          {set.games.map((g, i) => (
                            <div
                              key={i}
                              className="rounded border border-border/40 bg-background/40 px-2 py-1"
                            >
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="font-semibold">Jeu {g.game}</span>
                                <span className="text-muted-foreground">
                                  · {g.server === "player1" ? playerA.shortName : playerB.shortName}
                                </span>
                                {g.break && (
                                  <span className="rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-500">
                                    Break
                                  </span>
                                )}
                                <span className="ml-auto font-semibold">
                                  {g.player1_games}-{g.player2_games}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-0.5">
                                {g.points.map((p, j) => (
                                  <span
                                    key={j}
                                    className="rounded bg-muted px-1 text-[11px] text-muted-foreground"
                                  >
                                    {p.player1_score}-{p.player2_score}
                                    {p.winner === "player1"
                                      ? " ·A"
                                      : p.winner === "player2"
                                        ? " ·B"
                                        : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="h2h" className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerA.color }}>
                      {h2hWinsA}
                    </div>
                    <div className="text-[11px] uppercase text-muted-foreground">
                      {playerA.shortName}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {t("h2hDirect")}
                    </div>
                    <div className="mt-1 text-[11px] uppercase text-muted-foreground">
                      {t("h2hMatches", { n: h2hData?.total_matches ?? (h2hHistory ?? []).length })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerB.color }}>
                      {h2hWinsB}
                    </div>
                    <div className="text-[11px] uppercase text-muted-foreground">
                      {playerB.shortName}
                    </div>
                  </div>
                </div>

                {h2hData && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 text-center">
                      <div className="text-[11px] text-muted-foreground">Surface préférée {playerA.shortName}</div>
                      <div className="text-sm font-bold" style={{ color: playerA.color }}>
                        {Object.entries(h2hData.by_surface)
                          .sort(([, a], [, b]) => (b.player1_wins / b.total) - (a.player1_wins / a.total))
                          .map(([s]) => s)[0] ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 text-center">
                      <div className="text-[11px] text-muted-foreground">Surface préférée {playerB.shortName}</div>
                      <div className="text-sm font-bold" style={{ color: playerB.color }}>
                        {Object.entries(h2hData.by_surface)
                          .sort(([, a], [, b]) => ((a.total - a.player1_wins) / a.total) - ((b.total - b.player1_wins) / b.total))
                          .map(([s]) => s)[0] ?? "—"}
                      </div>
                    </div>
                  </div>
                )}

                {h2hSurfaceData.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">
                      {t("h2hBySurface")}
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={h2hSurfaceData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                          <XAxis type="number" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                          <YAxis
                            type="category"
                            dataKey="surface"
                            tick={{ fontSize: 11 }}
                            stroke="currentColor"
                            opacity={0.7}
                            width={90}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey={playerA.shortName} fill={playerA.color} radius={[0, 4, 4, 0]} />
                          <Bar dataKey={playerB.shortName} fill={playerB.color} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {h2hHistory && h2hHistory.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("h2hHistory")}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {h2hHistory.slice().reverse().map((h, i) => {
                        const winnerIsA = h.winnerId === playerA.id;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center justify-between gap-3 border-t border-border/40 px-3 py-2 text-xs",
                              "hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-muted-foreground">
                                {formatInTimeZone(h.date, locale, "month_year", browserTz)}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="font-medium">{h.tournament}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-[11px] uppercase text-muted-foreground">
                                {h.surface}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-muted-foreground">{h.score}</span>
                              <span
                                className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase"
                                style={{
                                  background: winnerIsA ? `${playerA.color}20` : `${playerB.color}20`,
                                  color: winnerIsA ? playerA.color : playerB.color,
                                }}
                              >
                                {winnerIsA ? playerA.shortName : playerB.shortName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="form" className="mt-4 space-y-3">
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">
                    {t("recentForm")}
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="match" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                          tickFormatter={(v) => (v === 1 ? t("formWin").charAt(0) : v === 0 ? t("formLoss").charAt(0) : "")}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(v: number) => (v === 1 ? t("formWin") : t("formLoss"))}
                          labelFormatter={(l) => t("formMatchLabel", { n: l })}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey={playerA.shortName} fill={playerA.color} radius={[4, 4, 0, 0]}>
                          {formData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry[playerA.shortName] === 1 ? playerA.color : `${playerA.color}30`}
                            />
                          ))}
                        </Bar>
                        <Bar dataKey={playerB.shortName} fill={playerB.color} radius={[4, 4, 0, 0]}>
                          {formData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry[playerB.shortName] === 1 ? playerB.color : `${playerB.color}30`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <LastMatchesList matches={[]} playerName={playerA.name} />

                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {t("eloProgression")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {eloLoading ? "…" : `${eloProgression.length} points`}
                    </div>
                  </div>
                  <div className="h-44">
                    {eloProgression.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {eloLoading ? "Chargement…" : "Historique indisponible"}
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eloProgression}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={["dataMin - 30", "dataMax + 30"]}
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <ReferenceLine y={2000} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="2 2" />
                        <Line
                          type="monotone"
                          dataKey={playerA.shortName}
                          stroke={playerA.color}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey={playerB.shortName}
                          stroke={playerB.color}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="odds" className="mt-4">
                {enrichedOdds && enrichedOdds.length > 0 ? (
                  <OddsComparator
                    odds={enrichedOdds}
                    playerAName={playerA.name}
                    playerBName={playerB.name}
                    modelProbA={probA}
                  />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t("noOdds")}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
