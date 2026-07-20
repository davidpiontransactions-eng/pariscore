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
import { Calendar, Trophy, Target, Scale, TrendingUp, Activity } from "lucide-react";
import type { TennisMatch } from "@/lib/tennis-data";
import { OddsComparator } from "./odds-comparator";
import { useEloHistory } from "@/hooks/use-elo-history";
import { getDateLocaleTag } from "@/lib/i18n-locales";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MatchDetailDialog({ match, open, onOpenChange }: Props) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const dateLocale = getDateLocaleTag(locale);
  // Hooks must run unconditionally (before any early return)
  const { data: eloHistoryData, isLoading: eloLoading } = useEloHistory(match?.id ?? null);

  if (!match) return null;

  const { playerA, playerB, probA, probB, stats, allOdds, h2hHistory } = match;

  // Form data for charts (most recent last, oldest first for x-axis)
  const formData = playerA.form.map((res, i) => ({
    match: i + 1,
    [playerA.shortName]: res === "W" ? 1 : 0,
    [playerB.shortName]: playerB.form[i] === "W" ? 1 : 0,
  }));

  // Elo progression — fetched from /api/tennis/elo-history (real computed history)
  const eloProgression = (eloHistoryData && match
    ? eloHistoryData.a.history.map((point, i) => {
        const bPoint = eloHistoryData.b.history[i];
        return {
          date: point.date,
          label: new Date(point.date).toLocaleDateString(dateLocale, {
            month: "short",
            year: "2-digit",
          }),
          [match.playerA.shortName]: point.elo,
          ...(bPoint ? { [match.playerB.shortName]: bPoint.elo } : {}),
        };
      })
    : []) as Array<Record<string, string | number>>;

  // H2H stats by surface
  const h2hBySurface = (h2hHistory ?? []).reduce(
    (acc, h) => {
      if (!acc[h.surface]) acc[h.surface] = { a: 0, b: 0 };
      if (h.winnerId === playerA.id) acc[h.surface].a++;
      else acc[h.surface].b++;
      return acc;
    },
    {} as Record<string, { a: number; b: number }>
  );

  const h2hSurfaceData = Object.entries(h2hBySurface).map(([surface, counts]) => ({
    surface,
    [playerA.shortName]: counts.a,
    [playerB.shortName]: counts.b,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-emerald-600" />
            {playerA.name} vs {playerB.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle", { tournament: match.tournament, round: match.round })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="px-5 py-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">{t("tabs.overview")}</TabsTrigger>
                <TabsTrigger value="h2h" className="text-xs">{t("tabs.h2h")}</TabsTrigger>
                <TabsTrigger value="form" className="text-xs">{t("tabs.form")}</TabsTrigger>
                <TabsTrigger value="odds" className="text-xs">{t("tabs.odds")}</TabsTrigger>
              </TabsList>

              {/* Overview tab */}
              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailStat
                    icon={<TrendingUp className="h-4 w-4" />}
                    label={t("model")}
                    value={match.model}
                    hint={t("modelHint")}
                  />
                  <DetailStat
                    icon={<Target className="h-4 w-4" />}
                    label={t("centralProb")}
                    value={t("centralProbValue", { a: probA, b: probB })}
                    hint={t("centralProbHint", { a: playerA.shortName, b: playerB.shortName })}
                  />
                  <DetailStat
                    icon={<Scale className="h-4 w-4" />}
                    label={t("eloGap")}
                    value={t("eloGapValue", { n: stats.eloGap })}
                    hint={t("eloGapHint", { surface: stats.surface })}
                  />
                  <DetailStat
                    icon={<Activity className="h-4 w-4" />}
                    label={t("confidence")}
                    value={t("confidenceValue", { n: (stats.confidence * 100).toFixed(0) })}
                    hint={t("confidenceHint", { lo: stats.ic[0], hi: stats.ic[1] })}
                  />
                </div>

                {/* Probability ring comparison */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={playerA.photoUrl}
                      alt={playerA.name}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background"
                      style={{ "--tw-ring-color": playerA.color } as React.CSSProperties}
                    />
                    <span className="text-sm font-semibold">{playerA.shortName}</span>
                    <div className="w-full">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{t("probLabel")}</span>
                        <span className="font-mono font-bold text-foreground">{probA}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${probA}%`,
                            background: playerA.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={playerB.photoUrl}
                      alt={playerB.name}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background"
                      style={{ "--tw-ring-color": playerB.color } as React.CSSProperties}
                    />
                    <span className="text-sm font-semibold">{playerB.shortName}</span>
                    <div className="w-full">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{t("probLabel")}</span>
                        <span className="font-mono font-bold text-foreground">{probB}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${probB}%`,
                            background: playerB.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* IC visualization */}
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    {t("icTitle", { player: playerA.shortName })}
                  </div>
                  <div className="relative h-8 rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 rounded-full border-2 border-emerald-500/60 bg-emerald-500/20"
                      style={{
                        left: `${stats.ic[0]}%`,
                        right: `${100 - stats.ic[1]}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-emerald-600"
                      style={{ left: `${probA}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>0%</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t("icSummary", { lo: stats.ic[0], hi: stats.ic[1], med: probA })}
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </TabsContent>

              {/* H2H tab */}
              <TabsContent value="h2h" className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerA.color }}>
                      {stats.h2h.split("-")[0]}
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
                      {t("h2hMatches", { n: (h2hHistory ?? []).length })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: playerB.color }}>
                      {stats.h2h.split("-")[1]}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {playerB.shortName}
                    </div>
                  </div>
                </div>

                {/* H2H by surface chart */}
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

                {/* H2H history table */}
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
                                {new Date(h.date).toLocaleDateString(dateLocale, {
                                  year: "2-digit",
                                  month: "short",
                                })}
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

              {/* Form tab */}
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

                {/* Elo progression — real history from /api/tennis/elo-history */}
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

              {/* Odds tab */}
              <TabsContent value="odds" className="mt-4">
                {allOdds && allOdds.length > 0 ? (
                  <OddsComparator
                    odds={allOdds}
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

function DetailStat({
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
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-1 font-mono text-sm font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// (Elo history is now fetched from /api/tennis/elo-history via useEloHistory hook)
