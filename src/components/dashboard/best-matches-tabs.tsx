"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { Skeleton } from "@/components/ui/skeleton";
import type { FootballMatch } from "@/lib/football-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportTab = "tennis" | "football" | "basketball" | "cs2" | "darts";

type BestMatchesTabsProps = { className?: string; id?: string };

type MatchCard = {
  id: string;
  sport: SportTab;
  matchName: string;
  detail1: string;
  detail2: string;
  scheduledAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<SportTab, string> = {
  tennis: "🎾",
  football: "⚽",
  basketball: "🏀",
  cs2: "🔫",
  darts: "🎯",
};

/** Estime l'écart Elo football depuis les probabilités (inversion Elo). */
function estimateFootballEloGap(match: FootballMatch): number {
  const { homeProb, awayProb } = match.prediction;
  const favProb = Math.max(homeProb, awayProb);
  if (favProb <= 50 || favProb >= 100) return 0;
  return Math.round(-400 * Math.log10(100 / favProb - 1));
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MatchCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BestMatchesTabs({ className, id }: BestMatchesTabsProps) {
  const [activeTab, setActiveTab] = useState<SportTab>("tennis");
  const { data: tennisData, isLoading: tennisLoading } = usePrematchMatches();
  const { data: footData, isLoading: footLoading } = useFootballMatches();

  // ── Tennis : ΔElo ≥ 150 OU SPS ≥ 55 ──
  const tennisMatches = useMemo<MatchCard[]>(() => {
    const matches = tennisData?.matches ?? [];
    return matches
      .filter((m) => {
        const eloGap = Math.abs(m.playerA.elo - m.playerB.elo);
        const maxSps = Math.max(m.playerA.sps ?? 0, m.playerB.sps ?? 0);
        return eloGap >= 150 || maxSps >= 55;
      })
      .map((m) => ({
        id: m.id,
        sport: "tennis" as const,
        matchName: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
        detail1: `ΔElo ${Math.abs(m.playerA.elo - m.playerB.elo)} · SPS ${Math.max(m.playerA.sps ?? 0, m.playerB.sps ?? 0)}`,
        detail2: m.tournament,
        scheduledAt: m.scheduledAt,
      }))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [tennisData?.matches]);

  // ── Football : ΔElo ≥ 150 ──
  const footballMatches = useMemo<MatchCard[]>(() => {
    const matches = footData?.matches ?? [];
    return matches
      .filter((m) => {
        const gap = estimateFootballEloGap(m);
        return gap >= 150;
      })
      .map((m) => ({
        id: m.id,
        sport: "football" as const,
        matchName: `${m.home.shortName} vs ${m.away.shortName}`,
        detail1: `ΔElo ~${estimateFootballEloGap(m)} · ${m.prediction.homeProb}-${m.prediction.awayProb}`,
        detail2: `${m.league.name} · ${m.round}`,
        scheduledAt: m.scheduledAt,
      }))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [footData?.matches]);

  const tabs: { key: SportTab; label: string; matches: MatchCard[]; loading: boolean }[] = [
    { key: "tennis", label: "🎾 Tennis", matches: tennisMatches, loading: tennisLoading },
    { key: "football", label: "⚽ Football", matches: footballMatches, loading: footLoading },
    { key: "basketball", label: "🏀 Basketball", matches: [], loading: false },
    { key: "cs2", label: "🔫 CS2", matches: [], loading: false },
    { key: "darts", label: "🎯 Darts", matches: [], loading: false },
  ];

  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  return (
    <section id={id} className={cn("space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        ⭐ MEILLEURS MATCHS DU JOUR
      </h3>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.matches.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/30 px-1 text-[10px] font-bold text-emerald-300">
                {tab.matches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {current.loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : current.matches.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          {current.key === "tennis" || current.key === "football"
            ? "Aucun match avec fort écart Elo aujourd'hui"
            : `Données ${current.label} bientôt disponibles`}
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
          {current.matches.map((match) => (
            <div
              key={`${match.sport}-${match.id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3",
                "hover:border-emerald-500/40 transition-colors",
              )}
            >
              <span className="text-xl shrink-0">{SPORT_ICONS[match.sport]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold truncate block">{match.matchName}</span>
                <span className="text-[11px] text-muted-foreground">{match.detail1}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-[11px] text-muted-foreground">{match.detail2}</span>
                <span className="text-[11px] font-mono text-zinc-500">
                  {new Date(match.scheduledAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

