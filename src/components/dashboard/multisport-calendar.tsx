"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSportsTree } from "@/hooks/use-sports-tree";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { Skeleton } from "@/components/ui/skeleton";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import type { SportNode, TreeMatchSummary } from "@/types/sports-sidebar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportFilter = "all" | "football" | "tennis" | "basketball" | "baseball" | "cycling" | "cs2" | "mma" | "f1" | "rugby";

type CalendarMatch = {
  id: string;
  sport: string;
  sportIcon: string;
  homeName: string;
  awayName: string;
  scheduledAt: string;
  isLive: boolean;
  leagueName: string;
  countryName: string;
  edgePct?: number;
  odds?: { home: number; draw?: number; away: number };
};

const SPORT_TABS: { key: SportFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "football", label: "Football" },
  { key: "tennis", label: "Tennis" },
  { key: "basketball", label: "Basketball" },
  { key: "baseball", label: "Baseball" },
  { key: "cycling", label: "Cyclisme" },
  { key: "cs2", label: "CS2" },
  { key: "mma", label: "MMA" },
  { key: "rugby", label: "Rugby" },
];

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  tennis: "🎾",
  basketball: "🏀",
  baseball: "⚾",
  cycling: "🚴",
  cs2: "🔫",
  mma: "🥊",
  f1: "🏎️",
  rugby: "🏉",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "??:??";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(d);
  } catch {
    return "??:??";
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Extraire tous les matchs d'un SportNode pour aujourd'hui. */
function extractTodayMatches(sport: SportNode): CalendarMatch[] {
  const today = todayStr();
  const matches: CalendarMatch[] = [];

  for (const country of sport.countries) {
    for (const league of country.leagues) {
      for (const m of (league.matches ?? []) as TreeMatchSummary[]) {
        if (m.scheduledAt && m.scheduledAt.slice(0, 10) === today) {
          matches.push({
            id: m.id,
            sport: sport.id,
            sportIcon: SPORT_ICONS[sport.id] ?? "🏆",
            homeName: m.homeName,
            awayName: m.awayName,
            scheduledAt: m.scheduledAt,
            isLive: m.isLive ?? false,
            leagueName: league.name,
            countryName: country.name,
            edgePct: m.edgePct ?? undefined,
            odds: m.odds,
          });
        }
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultisportCalendar({ className }: { className?: string }) {
  const { data: treeData, isValidating } = useSportsTree();
  const { liveStates } = useLiveMatches();

  // Sync with sidebar/headerbar store
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const headerMode = useSportsSidebarStore((s) => s.headerMode ?? "prematch");
  const selectSport = useSportsSidebarStore((s) => s.selectSport);

  const allMatches = useMemo<CalendarMatch[]>(() => {
    if (!treeData) return [];
    const matches: CalendarMatch[] = [];
    for (const sport of treeData) {
      matches.push(...extractTodayMatches(sport));
    }
    return matches.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }, [treeData]);

  const filtered = useMemo(() => {
    let result = allMatches;
    // Filtre sport depuis la sidebar
    if (selectedSportId) {
      result = result.filter((m) => m.sport === selectedSportId);
    }
    // Filtre live/prematch depuis mode-toggle header
    if (headerMode === "live") {
      result = result.filter((m) => liveStates[m.id]?.isLive ?? m.isLive);
    } else if (headerMode === "prematch") {
      result = result.filter((m) => !(liveStates[m.id]?.isLive ?? m.isLive));
    }
    return result;
  }, [allMatches, selectedSportId, headerMode, liveStates]);

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of allMatches) {
      counts[m.sport] = (counts[m.sport] ?? 0) + 1;
    }
    return counts;
  }, [allMatches]);

  if (isValidating && allMatches.length === 0) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Calendrier du jour
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Calendrier du jour ({allMatches.length})
        </h3>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {SPORT_TABS.map((tab) => {
            const count = tab.key === "all" ? allMatches.length : (sportCounts[tab.key] ?? 0);
            if (tab.key !== "all" && count === 0) return null;
            const isActive = tab.key === "all" ? !selectedSportId : selectedSportId === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectSport(tab.key === "all" ? null : tab.key)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun match{" "}
          {headerMode === "live" ? "en direct" : "&agrave; venir"}{" "}
          {selectedSportId ? `en ${selectedSportId}` : "aujourd'hui"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Sport</th>
                <th className="px-3 py-2.5 font-medium">Rencontre</th>
                <th className="px-3 py-2.5 font-medium">Compétition</th>
                <th className="px-3 py-2.5 font-medium text-right">Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((m) => {
                const isLive = liveStates[m.id]?.isLive ?? m.isLive;
                return (
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
                      isLive && "bg-rose-500/5 hover:bg-rose-500/10",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap text-slate-400">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-rose-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                          <span className="text-[11px] font-bold uppercase text-rose-500">LIVE</span>
                        </span>
                      ) : (
                        formatHour(m.scheduledAt)
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-lg">{m.sportIcon}</td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <div className="font-medium text-slate-100 hover:text-emerald-400 transition-colors">
                        {m.homeName} vs {m.awayName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {m.leagueName}
                      {m.countryName !== "International" && (
                        <span className="ml-1 text-slate-500">· {m.countryName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {m.edgePct != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold font-mono tabular-nums",
                            m.edgePct > 0
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400",
                          )}
                        >
                          {m.edgePct > 0 ? "+" : ""}{m.edgePct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
