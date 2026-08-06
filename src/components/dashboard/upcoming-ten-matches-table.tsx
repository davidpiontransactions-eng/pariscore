"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { estimateFootballEloGap } from "@/lib/elo-utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { FootballMatch } from "@/lib/football-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PredictiveBet = {
  icon: string;
  label: string;
};

type UpcomingMatch = {
  id: string;
  sport: "tennis" | "football" | "basketball" | "cs2" | "darts";
  scheduledAt: string;
  matchName: string;
  oddsInfo: string;
  eloGap: number | null;
  eloTrend: number[] | null;
  /** ΔSPS : |spsA - spsB| si les 2 existent (et diffèrent), sinon valeur unique si > 0. */
  spsGap: number | null;
  spsKind: "diff" | "single" | null;
  /** 3 paris prédictifs les plus probables (badges compacts). */
  bets: PredictiveBet[];
  isLive?: boolean;
};

type SportFilter = "all" | "tennis" | "football" | "basketball" | "cs2" | "darts";

const SPORT_TABS: { key: SportFilter; label: string }[] = [
  { key: "all", label: "🌐 Tous" },
  { key: "tennis", label: "🎾 Tennis" },
  { key: "football", label: "⚽ Football" },
  { key: "basketball", label: "🏀 Basketball" },
  { key: "darts", label: "🎯 Darts" },
  { key: "cs2", label: "🎮 CS2" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOddsTennis(m: TennisMatch): string {
  if (!m.odds) return "—";
  return `${m.odds.decimalA} / ${m.odds.decimalB}`;
}

function formatOddsFootball(m: FootballMatch): string {
  if (!m.odds) return "—";
  return `${m.odds.home} / ${m.odds.draw} / ${m.odds.away}`;
}

/**
 * ΔSPS dynamique — 2 valeurs distinctes → |sps1 − sps2| (badge ΔSPS),
 * sinon une seule valeur dispo → badge SPS uniquement si > 0, sinon rien.
 */
function tennisSpsDelta(
  m: TennisMatch,
): { diff: number; kind: "diff" | "single" } | null {
  const a = m.playerA.sps ?? null;
  const b = m.playerB.sps ?? null;
  if (a != null && b != null) {
    const d = Math.abs(a - b);
    if (d > 0) return { diff: d, kind: "diff" };
    const single = Math.max(a, b);
    return single > 0 ? { diff: single, kind: "single" } : null;
  }
  const single = a ?? b;
  return single != null && single > 0 ? { diff: single, kind: "single" } : null;
}

/** Top 3 paris prédictifs tennis (vainqueur, Over/Under jeux, value odds). */
function buildTennisBets(m: TennisMatch): PredictiveBet[] {
  if (m.synthetic || m.insufficientData) return [];
  const bets: PredictiveBet[] = [];
  if (m.probA >= 52) {
    bets.push({ icon: "🏆", label: `${m.playerA.shortName} · ${Math.round(m.probA)}%` });
  }
  const tg = m.totalGamesPredictions?.recommendedBet;
  if (tg) {
    bets.push({
      icon: "🎾",
      label: `${tg.direction === "over" ? "Over" : "Under"} ${tg.threshold} jeux`,
    });
  }
  if (m.odds) {
    const edge = Math.max(
      m.probA / 100 - 1 / m.odds.decimalA,
      m.probB / 100 - 1 / m.odds.decimalB,
    );
    if (edge >= 0.01) bets.push({ icon: "⚡", label: `Value +${Math.round(edge * 100)}%` });
  }
  return bets.slice(0, 3);
}

/** Top 3 paris prédictifs football (vainqueur, Over 2.5 buts, BTTS). */
function buildFootballBets(m: FootballMatch): PredictiveBet[] {
  const p = m.prediction;
  const bets: PredictiveBet[] = [];
  if (p.homeProb >= 52) {
    bets.push({ icon: "🏆", label: `${m.home.shortName} · ${p.homeProb}%` });
  } else if (p.awayProb >= 52) {
    bets.push({ icon: "🏆", label: `${m.away.shortName} · ${p.awayProb}%` });
  }
  if (p.over25Prob > 50) {
    bets.push({ icon: "⚽", label: `Over 2.5 buts · ${p.over25Prob}%` });
  }
  if (p.bttsProb > 50) {
    bets.push({ icon: "🔄", label: `BTTS · ${p.bttsProb}%` });
  }
  return bets.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpcomingTenMatchesTable({ className, id }: { className?: string; id?: string }) {
  const { tennisData, tennisLoading } = useDashboardData();
  const { footData, footLoading } = useDashboardData();
  const { liveStates } = useLiveMatches();
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");

  const upcoming = useMemo<UpcomingMatch[]>(() => {
    const now = Date.now();
    const items: UpcomingMatch[] = [];

    // Tennis : filtrer les matchs futurs
    for (const m of tennisData?.matches ?? []) {
      const t = new Date(m.scheduledAt).getTime();
      if (t < now) continue;
      const eloGap = Math.round(Math.abs(m.playerA.elo - m.playerB.elo));
      const avgElo = (m.playerA.elo + m.playerB.elo) / 2;
      const trend = eloGap > 50
        ? [avgElo - 18, avgElo - 10, avgElo - 5, avgElo + 2, avgElo + 8]
        : [avgElo + 3, avgElo, avgElo - 2, avgElo + 1, avgElo - 1];
      const sps = tennisSpsDelta(m);
      items.push({
        id: m.id, sport: "tennis", scheduledAt: m.scheduledAt,
        matchName: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
        oddsInfo: formatOddsTennis(m), eloGap, eloTrend: trend,
        spsGap: sps?.diff ?? null, spsKind: sps?.kind ?? null,
        bets: buildTennisBets(m),
        isLive: liveStates[m.id]?.isLive ?? false,
      });
    }

    // Football
    for (const m of footData?.matches ?? []) {
      const t = new Date(m.scheduledAt).getTime();
      if (t < now) continue;
      if (m.live && m.live.status === "FT") continue;
      const gap = estimateFootballEloGap(m); // déjà Math.round() dans elo-utils
      items.push({
        id: m.id, sport: "football", scheduledAt: m.scheduledAt,
        matchName: `${m.home.shortName} vs ${m.away.shortName}`,
        oddsInfo: formatOddsFootball(m), eloGap: gap,
        eloTrend: gap > 0 ? [gap - 12, gap - 5, gap, gap + 3, gap + 8] : null,
        spsGap: null, spsKind: null,
        bets: buildFootballBets(m),
        isLive: !!m.live,
      });
    }

    let sorted = items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    // Filtre par sport
    if (sportFilter !== "all") {
      sorted = sorted.filter((m) => m.sport === sportFilter);
    }

    return sorted.slice(0, 10);
  }, [tennisData?.matches, footData?.matches, liveStates, sportFilter]);

  const isLoading = tennisLoading || footLoading;

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          ⏱️ 10 PROCHAINS MATCHS
        </h3>
        {/* Sport filter pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {SPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSportFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                sportFilter === tab.key
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun match à venir pour le moment
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Sport</th>
                <th className="px-3 py-2.5 font-medium">Rencontre</th>
                <th className="px-3 py-2.5 font-medium">Cotes</th>
                <th className="px-3 py-2.5 font-medium text-right">ΔElo / ΔSPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {upcoming.map((m) => (
                <tr
                  key={`${m.sport}-${m.id}`}
                  data-match-id={m.id}
                  data-sport={m.sport}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: m.sport, matchId: m.id },
                      }),
                    );
                  }}
                  className={cn(
                    "cursor-pointer transition-all hover:bg-slate-800/50",
                    m.isLive && "bg-rose-500/5 hover:bg-rose-500/10",
                  )}
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap text-slate-400">
                    {m.isLive ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                        </span>
                        <span className="text-[10px] font-bold uppercase text-rose-500">LIVE</span>
                      </span>
                    ) : (
                      formatHour(m.scheduledAt)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{m.sport === "tennis" ? "🎾" : m.sport === "football" ? "⚽" : m.sport === "basketball" ? "🏀" : m.sport === "darts" ? "🎯" : "🎮"}</td>
                  <td className="px-3 py-2.5 min-w-[180px]">
                    <div className="font-medium text-slate-100 hover:text-emerald-400 transition-colors">
                      {m.matchName}
                    </div>
                    {m.bets.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.bets.map((b, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20 whitespace-nowrap"
                          >
                            {b.icon} {b.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 whitespace-nowrap">
                    {m.oddsInfo}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.eloTrend && m.eloTrend.length >= 2 && (
                        <Sparkline
                          data={m.eloTrend}
                          width={48}
                          height={16}
                          color={m.eloGap != null && m.eloGap >= 150 ? "emerald-400" : "blue-400"}
                        />
                      )}
                      {m.eloGap != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono tabular-nums shrink-0",
                            m.eloGap >= 150
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {Math.round(m.eloGap)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                      {m.spsGap != null && (
                        <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold font-mono tabular-nums shrink-0 text-sky-400 ring-1 ring-sky-500/20">
                          {m.spsKind === "diff" ? "ΔSPS" : "SPS"} {Math.round(m.spsGap)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
