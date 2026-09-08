"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import type { TopLeague, TopMatch } from "@/lib/top-matches/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StrategyKey =
  | "bestTeam"
  | "over15"
  | "bttsYes"
  | "edge1x2Home"
  | "edge1x2Away"
  | "highConf";

type StrategyDef = {
  key: StrategyKey;
  label: string;
  description: string;
};

const STRATEGIES: StrategyDef[] = [
  { key: "bestTeam", label: "🏆 Meilleure Équipe", description: "Équipe avec le meilleur classement/forme" },
  { key: "over15", label: "⚽ Over 1.5", description: "Matchs avec probabilité > 50% pour Over 1.5 buts" },
  { key: "bttsYes", label: "🥅 BTTS Yes", description: "Les deux équipes marquent" },
  { key: "edge1x2Home", label: "📈 Edge 1X2 Home", description: "Avantage sur le favori à domicile" },
  { key: "edge1x2Away", label: "📉 Edge 1X2 Away", description: "Avantage sur l'extérieur" },
  { key: "highConf", label: "🎯 Haute Confiance", description: "Matchs avec confiance ≥ 80%" },
];

type StrategyMatch = {
  id: string;
  matchLabel: string;
  probPct: number | null;
  odds: { home?: number; draw?: number; away?: number } | null;
  ev: number | null;
  trend: number | null;
  pick: string;
  confLabel?: string;
  confLevel?: 1 | 2 | 3;
  league?: string;
  kickoff?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extrait les matchs d'un groupe TopLeague pour une stratégie donnée */
function extractStrategyMatches(groups: TopLeague[], strategy: StrategyKey): StrategyMatch[] {
  const results: StrategyMatch[] = [];

  for (const group of groups) {
    for (const m of group.matches) {
      const match = toStrategyMatch(m, strategy, group.league);
      if (match) results.push(match);
    }
  }

  // Trier par EV décroissant
  return results.sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0));
}

function toStrategyMatch(m: TopMatch, strategy: StrategyKey, league: string): StrategyMatch | null {
  const matchLabel = `${m.home.name} vs ${m.away.name}`;
  const pick = resolvePick(m, strategy);
  if (!pick) return null;

  const probPct = m.probPct ?? null;
  const odds = m.odds ? {
    home: m.odds.home != null ? parseFloat(m.odds.home) : (undefined as number | undefined),
    draw: m.odds.draw != null ? parseFloat(m.odds.draw) : (undefined as number | undefined),
    away: m.odds.away != null ? parseFloat(m.odds.away) : (undefined as number | undefined),
  } : null;
  const ev = m.ev ?? null;
  const trend = m.trend ?? null;

  return {
    id: m.id,
    matchLabel,
    probPct,
    odds,
    ev,
    trend,
    pick,
    confLabel: m.confLabel,
    confLevel: m.confLevel,
    league,
    kickoff: m.kickoff,
  };
}

/** Détermine le pick selon la stratégie */
function resolvePick(m: TopMatch, strategy: StrategyKey): string | null {
  switch (strategy) {
    case "bestTeam":
      if (m.home.rank != null && m.away.rank != null) {
        return m.home.rank < m.away.rank ? m.home.name : m.away.name;
      }
      return m.probPct != null ? (m.probPct > 50 ? m.home.name : m.away.name) : null;
    case "over15": {
      // Si on a un probPct > 50, c'est un signal Over
      if (m.probPct != null && m.probPct > 50) return "Over 1.5";
      // Fallback : si badge indique value
      if (m.badge?.label?.includes("Over")) return "Over 1.5";
      return null;
    }
    case "bttsYes": {
      if (m.metric?.label?.toLowerCase().includes("btts")) return "BTTS Yes";
      if (m.probPct != null && m.probPct > 55) return "BTTS Yes";
      return null;
    }
    case "edge1x2Home": {
      const homeOdds = m.odds?.home as number | undefined;
      if (homeOdds != null && m.probPct != null) {
        const evHome = (m.probPct / 100) * homeOdds - 1;
        return evHome > 0 ? `Home (${m.home.name})` : null;
      }
      return null;
    }
    case "edge1x2Away": {
      const awayOdds = m.odds?.away as number | undefined;
      if (awayOdds != null && m.probPct != null) {
        const evAway = ((100 - m.probPct) / 100) * awayOdds - 1;
        return evAway > 0 ? `Away (${m.away.name})` : null;
      }
      return null;
    }
    case "highConf":
      if (m.confLevel != null && m.confLevel >= 3) return "Confiance élevée";
      if (m.probPct != null && m.probPct >= 80) return "Forte probabilité";
      return null;
    default:
      return null;
  }
}

/** Bande de couleur pour la probabilité */
function probColor(prob: number | null): string {
  if (prob == null) return "text-muted-foreground";
  if (prob >= 75) return "text-emerald-400";
  if (prob >= 60) return "text-amber-400";
  return "text-zinc-400";
}

/** Icône de tendance */
function TrendIcon({ trend }: { trend: number | null }) {
  if (trend == null) return <Minus className="size-3 text-muted-foreground/50" />;
  if (trend > 2) return <TrendingUp className="size-3 text-emerald-400" />;
  if (trend < -2) return <TrendingDown className="size-3 text-red-400" />;
  return <Minus className="size-3 text-zinc-500" />;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-2.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TopStrategiesPanelProps {
  className?: string;
}

export function TopStrategiesPanel({ className }: TopStrategiesPanelProps) {
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("edge1x2Home");
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);

  const sport = selectedSportId || "football";

  const { data, isLoading, error } = useSWR<{ groups: TopLeague[]; generated_at: string }>(
    `/api/v1/top-matches/all?sport=${sport}`,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
      onError: () => {},
    },
  );

  const strategyMatches = useMemo(() => {
    if (!data?.groups) return [];
    return extractStrategyMatches(data.groups, activeStrategy);
  }, [data?.groups, activeStrategy]);

  const strategyDef = STRATEGIES.find((s) => s.key === activeStrategy);

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Top Stratégies
        </h3>
        {data?.generated_at && (
          <span className="text-[10px] text-muted-foreground/60">
            Mis à jour {new Date(data.generated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <Tabs value={activeStrategy} onValueChange={(v) => setActiveStrategy(v as StrategyKey)}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-0.5 bg-muted/30 p-0.5">
          {STRATEGIES.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              className="text-[11px] px-2 py-1 whitespace-nowrap data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STRATEGIES.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-2">
            {isLoading ? (
              <TableSkeleton />
            ) : error ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Erreur de chargement
              </div>
            ) : strategyMatches.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Aucun match trouvé pour cette stratégie
              </div>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground/70 mb-2">{s.description}</p>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/40 bg-muted/30">
                        <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Match</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">Prob.</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">Cote</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">EV</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Pick</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {strategyMatches.slice(0, 15).map((m) => (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-slate-800/50 border-b border-border/20"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("open-match-detail", {
                                detail: { sport, matchId: m.id },
                              }),
                            );
                          }}
                        >
                          <TableCell className="font-medium text-xs text-slate-100 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate max-w-[200px]">{m.matchLabel}</span>
                              {m.league && (
                                <span className="text-[10px] text-muted-foreground/60 truncate">{m.league}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {m.probPct != null ? (
                              <span className={cn("text-xs font-mono font-semibold tabular-nums", probColor(m.probPct))}>
                                {m.probPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {m.odds?.home ? (
                              <span className="text-xs font-mono tabular-nums text-zinc-300">
                                {m.odds.home.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex items-center justify-end gap-1">
                              <TrendIcon trend={m.trend} />
                              {m.ev != null ? (
                                <span
                                  className={cn(
                                    "text-xs font-mono font-semibold tabular-nums",
                                    m.ev > 0 ? "text-emerald-400" : m.ev < 0 ? "text-red-400" : "text-zinc-500",
                                  )}
                                >
                                  {m.ev > 0 ? "+" : ""}{m.ev.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              className={cn(
                                "text-[10px] font-semibold",
                                m.confLevel === 3
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : m.confLevel === 2
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
                              )}
                            >
                              {m.pick}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1 text-right">
                  {strategyMatches.length} match{strategyMatches.length > 1 ? "s" : ""} • Top 15 affichés
                </p>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
