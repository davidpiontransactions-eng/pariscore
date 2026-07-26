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
import { Calendar, Trophy, Scale, Activity, Target, Check, X, Zap, Swords, Loader2 } from "lucide-react";
import type { TennisMatch } from "@/lib/tennis-data";
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
import { useBrowserTimeZone, formatInTimeZone } from "@/lib/tennis-format";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FormDot({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold",
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
  const va = valueA ?? 0;
  const vb = valueB ?? 0;
  const pct = va + vb > 0 ? (va / (va + vb)) * 100 : 50;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 p-3">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold" style={{ color: pct >= 50 ? undefined : undefined }}>
          {va}{unit ?? ""}
        </span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="rounded-l-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
          />
        </div>
        <span className="text-base font-bold">
          {vb}{unit ?? ""}
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
  const { match: bsdMatch, odds: bsdOdds, h2h: bsdH2h, isLoading: bsdLoading } = useBSDMatchDetail(match?.id ?? null);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[min(90vw,56rem)] overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <TournamentBadge category={match.tournamentCategory} />
            <SurfaceBadge surface={stats.surface} />
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
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
              <span>#{playerA.rank} Elo {playerA.elo.toFixed(0)}</span>
              <span className="text-muted-foreground/50">/</span>
              <span>#{playerB.rank} Elo {playerB.elo.toFixed(0)}</span>
            </div>
          </div>

          <DialogDescription className="text-[11px] text-muted-foreground/70">
            {match.modelUpdatedAt && (
              <>Mis à jour : {formatInTimeZone(match.modelUpdatedAt, locale, "full", browserTz)}</>
            )}
          </DialogDescription>
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
                </div>

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
                    <span className="text-[10px] text-muted-foreground">
                      #{p.rank} · Elo {p.elo?.toFixed(0) ?? "N/A"}
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
              </TabsContent>

              {/* Onglet Stats — données détaillées BSD V2 */}
              <TabsContent value="stats" className="mt-4 space-y-3">
                {bsdLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm">Chargement des stats…</span>
                  </div>
                ) : serveStats.length > 0 ? (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        Statistiques de service
                      </span>
                      {b?.sets_detail && b.sets_detail.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
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
                ) : (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Swords className="mr-2 h-4 w-4" />
                    Stats non disponibles (match à venir)
                  </div>
                )}
              </TabsContent>

              <TabsContent value="h2h" className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerA.color }}>
                      {h2hWinsA}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {playerA.shortName}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {t("h2hDirect")}
                    </div>
                    <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                      {t("h2hMatches", { n: h2hData?.total_matches ?? (h2hHistory ?? []).length })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerB.color }}>
                      {h2hWinsB}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {playerB.shortName}
                    </div>
                  </div>
                </div>

                {h2hData && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 text-center">
                      <div className="text-[10px] text-muted-foreground">Surface préférée {playerA.shortName}</div>
                      <div className="text-sm font-bold" style={{ color: playerA.color }}>
                        {Object.entries(h2hData.by_surface)
                          .sort(([, a], [, b]) => (b.player1_wins / b.total) - (a.player1_wins / a.total))
                          .map(([s]) => s)[0] ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 text-center">
                      <div className="text-[10px] text-muted-foreground">Surface préférée {playerB.shortName}</div>
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
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {h.surface}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-muted-foreground">{h.score}</span>
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
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
                    <div className="text-[10px] text-muted-foreground">
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
