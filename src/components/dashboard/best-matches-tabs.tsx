"use client";

import { useMemo, useState, useCallback } from "react";
import { LayoutGrid, Table, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { useBasketballMatches } from "@/hooks/use-basketball-matches";
import { useCs2Matches } from "@/hooks/use-cs2-matches";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { estimateFootballEloGap } from "@/lib/elo-utils";
import { parisKickoff } from "@/lib/football-time";

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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MatchCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3" aria-busy="true">
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
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(false);
  // Filtres avancés — seuils ajustables par l'utilisateur
  const [minEloGap, setMinEloGap] = useState(150);
  const [minSps, setMinSps] = useState(55);
  const { tennisData, tennisLoading, tennisError } = useDashboardData();
  const { footData, footLoading, footError } = useDashboardData();
  // Basket / CS2 — données réelles via les routes API v1 (SWR, poll 60s)
  const {
    matches: basketData,
    isLoading: basketLoading,
    error: basketError,
  } = useBasketballMatches();
  const {
    matches: cs2Data,
    isLoading: cs2Loading,
    error: cs2Error,
  } = useCs2Matches();

  // ── Tennis : ΔElo ≥ minEloGap OU SPS ≥ minSps ──
  const tennisMatches = useMemo<MatchCard[]>(() => {
    const matches = tennisData?.matches ?? [];
    return matches
      .filter((m) => {
        const eloGap = Math.abs(m.playerA.elo - m.playerB.elo);
        const maxSps = Math.max(m.playerA.sps ?? 0, m.playerB.sps ?? 0);
        return eloGap >= minEloGap || maxSps >= minSps;
      })
      .map((m) => {
        // ΔSPS dynamique : |sps1 − sps2| si les 2 existent (et diffèrent),
        // sinon valeur unique si > 0, sinon rien (jamais "SPS 0").
        const a = m.playerA.sps ?? null;
        const b = m.playerB.sps ?? null;
        const delta = a != null && b != null ? Math.abs(a - b) : 0;
        let spsTxt = "";
        if (delta > 0) {
          spsTxt = `ΔSPS ${Math.round(delta)}`;
        } else {
          const single = Math.max(a ?? 0, b ?? 0);
          if (single > 0) spsTxt = `SPS ${single}`;
        }
        return {
          id: m.id,
          sport: "tennis" as const,
          matchName: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
          detail1: [`ΔElo ${Math.round(Math.abs(m.playerA.elo - m.playerB.elo))}`, spsTxt].filter(Boolean).join(" · "),
          detail2: m.tournament,
          scheduledAt: m.scheduledAt,
        };
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [tennisData?.matches, minEloGap, minSps]);

  // ── Football : ΔElo ≥ minEloGap ──
  const footballMatches = useMemo<MatchCard[]>(() => {
    const matches = footData?.matches ?? [];
    return matches
      .filter((m) => {
        const gap = estimateFootballEloGap(m);
        return gap >= minEloGap;
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
  }, [footData?.matches, minEloGap]);

  // ── Basketball (NBA + WNBA) : modèle ESPN (blend) + écart Elo ──
  const basketballMatches = useMemo<MatchCard[]>(() => {
    return (basketData ?? []).map((m) => {
      const parts: string[] = [];
      if (m.edgeElo != null) parts.push(`ΔElo ${m.edgeElo}`);
      if (m.pHome != null) parts.push(`${m.pHome}-${m.pAway}`);
      return {
        id: m.id,
        sport: "basketball" as const,
        matchName: `${m.home.abbr || m.home.name} vs ${m.away.abbr || m.away.name}`,
        detail1: parts.join(" · ") || "—",
        detail2: m.home.record ? `${m.league} · ${m.home.record}` : m.league,
        scheduledAt: m.scheduledAt,
      };
    });
  }, [basketData]);

  // ── CS2 : classement HLTV + tournoi ──
  const cs2Matches = useMemo<MatchCard[]>(() => {
    return (cs2Data ?? []).map((m) => ({
      id: m.id,
      sport: "cs2" as const,
      matchName: `${m.team1.name} vs ${m.team2.name}`,
      detail1:
        m.team1.rank != null || m.team2.rank != null
          ? `HLTV #${m.team1.rank ?? "?"} · #${m.team2.rank ?? "?"}`
          : `BO${m.bestOf ?? 3}${m.currentMap ? ` · ${m.currentMap}` : ""}`,
      detail2: m.tournament,
      scheduledAt: m.scheduledAt,
    }));
  }, [cs2Data]);

  const allTabs: {
    key: SportTab;
    label: string;
    matches: MatchCard[];
    loading: boolean;
    error?: string;
  }[] = [
    { key: "tennis", label: "🎾 Tennis", matches: tennisMatches, loading: tennisLoading, error: tennisError?.message },
    { key: "football", label: "⚽ Football", matches: footballMatches, loading: footLoading, error: footError?.message },
    {
      key: "basketball",
      label: "🏀 Basketball",
      matches: basketballMatches,
      loading: basketLoading,
      error: basketError?.message,
    },
    {
      key: "cs2",
      label: "🔫 CS2",
      matches: cs2Matches,
      loading: cs2Loading,
      error: cs2Error?.message,
    },
  ];
  // Affiche un sport s'il a des données, charge, ou est en erreur (pour
  // pouvoir montrer l'état d'erreur). Darts est un onglet désactivé séparé.
  const tabs = allTabs.filter((t) => t.matches.length > 0 || t.loading || !!t.error);

  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  // Tous les sports en erreur ou vide : etat vide au lieu d'un crash page blanche.
  if (!current) {
    return (
      <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          MEILLEURS MATCHS DU JOUR
        </h3>
        <p className="text-sm text-muted-foreground">Aucun match disponible pour le moment. Reessayez dans quelques instants.</p>
      </section>
    );
  }

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        ⭐ MEILLEURS MATCHS DU JOUR
      </h3>

      {/* Filter toggle + panel */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            showFilters
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filtres
          {(minEloGap !== 150 || minSps !== 55) && (
            <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500/30 px-1 text-xs font-bold text-emerald-300">
              !
            </span>
          )}
        </button>
        {(minEloGap !== 150 || minSps !== 55) && (
          <button
            type="button"
            onClick={() => { setMinEloGap(150); setMinSps(55); }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Réinitialiser
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">ΔElo minimum</label>
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">{minEloGap}</span>
            </div>
            <Slider
              value={[minEloGap]}
              onValueChange={([v]) => setMinEloGap(v)}
              min={0}
              max={300}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>0 (tout)</span>
              <span>150 (défaut)</span>
              <span>300 (strict)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">SPS minimum</label>
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">{minSps}</span>
            </div>
            <Slider
              value={[minSps]}
              onValueChange={([v]) => setMinSps(v)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>0 (tout)</span>
              <span>55 (défaut)</span>
              <span>100 (max)</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none flex-1">
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
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/30 px-1 text-xs font-bold text-emerald-300">
                {tab.matches.length}
              </span>
            )}
          </button>
        ))}
          {/* Darts — aucune route API pour l'instant : onglet désactivé "Bientôt"
              (présent mais non cliquable, pas de code mort) */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Bientôt disponible"
            className="shrink-0 cursor-not-allowed rounded-full bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground/60"
          >
            🎯 Darts
            <span className="ml-1.5 text-xs font-bold uppercase tracking-wider">
              Bientôt
            </span>
          </button>
        </div>

        {/* View toggle */}
        <div className="flex shrink-0 rounded-lg border border-border/60 bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-white/10 text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vue cartes"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "table"
                ? "bg-white/10 text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vue tableau"
          >
            <Table className="h-3.5 w-3.5" />
          </button>
        </div>
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
          {current.error
            ? `Impossible de charger les données ${current.label}`
            : current.key === "tennis" || current.key === "football"
              ? "Aucun match avec fort écart Elo aujourd'hui"
              : `Données ${current.label} bientôt disponibles`}
        </div>
      ) : viewMode === "grid" ? (
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
          {current.matches.map((match) => (
            <div
              key={`${match.sport}-${match.id}`}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-match-detail", {
                    detail: { sport: match.sport, matchId: match.id },
                  }),
                );
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card p-3",
                "transition-all hover:border-emerald-500/40 hover:bg-slate-800/40",
              )}
            >
              <span className="text-xl shrink-0">{SPORT_ICONS[match.sport]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold truncate block">{match.matchName}</span>
                <span className="text-xs text-muted-foreground">{match.detail1}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-xs text-muted-foreground">{match.detail2}</span>
                <span className="text-xs font-mono text-zinc-500">
                  {parisKickoff(match.scheduledAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vue tableau */
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Sport</th>
                <th className="px-3 py-2.5 font-medium">Rencontre</th>
                <th className="px-3 py-2.5 font-medium">ΔElo / SPS</th>
                <th className="px-3 py-2.5 font-medium text-right">Tournoi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {current.matches.map((match) => (
                <tr
                  key={`${match.sport}-${match.id}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: match.sport, matchId: match.id },
                      }),
                    );
                  }}
                  className="cursor-pointer transition-all hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {new Date(match.scheduledAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{SPORT_ICONS[match.sport]}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {match.matchName}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {match.detail1}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {match.detail2}
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

