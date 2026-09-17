"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, X } from "lucide-react";

type GoalsMapPoint = {
  league: string;
  country: string;
  slug: string;
  goalsPerGame: number;
  drawRate: number;
  gamesPlayed: number;
};

type TimingStat = {
  league: string;
  country: string;
  slug: string;
  over05_1hPct: number;
  lateGoalsPct: number;
  gamesPlayed: number;
};

type CompetitivenessStat = {
  league: string;
  country: string;
  slug: string;
  homeWinPct: number;
  drawPct: number;
  gamesPlayed: number;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899"];

const METRICS = [
  { key: "goalsPerGame", label: "Buts / match", unit: "" },
  { key: "drawRate", label: "Taux de nul", unit: "%" },
  { key: "over05_1hPct", label: "But 1H %", unit: "%" },
  { key: "lateGoalsPct", label: "Buts 2H %", unit: "%" },
  { key: "homeWinPct", label: "Vict. dom.", unit: "%" },
  { key: "drawPct", label: "Nuls %", unit: "%" },
] as const;

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>([]);

  const { data: goalsData } = useSWR<{ points: GoalsMapPoint[] }>(
    "/api/v1/leagues-stats/goals-map",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const { data: timingData } = useSWR<{ stats: TimingStat[] }>(
    "/api/v1/leagues-stats/timing",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const { data: compData } = useSWR<{ stats: CompetitivenessStat[] }>(
    "/api/v1/leagues-stats/competitiveness",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const allLeagues = useMemo(() => {
    const goals = goalsData?.points ?? [];
    return goals.map((g) => ({
      slug: `${g.country}/${g.slug}`,
      name: g.league,
    }));
  }, [goalsData]);

  // Merge data per league
  const merged = useMemo(() => {
    const goals = goalsData?.points ?? [];
    const timing = timingData?.stats ?? [];
    const comp = compData?.stats ?? [];

    return selected.map((slug) => {
      const [country, leagueSlug] = slug.split("/");
      const g = goals.find((x) => x.country === country && x.slug === leagueSlug);
      const t = timing.find((x) => x.country === country && x.slug === leagueSlug);
      const c = comp.find((x) => x.country === country && x.slug === leagueSlug);

      return {
        slug,
        name: g?.league ?? t?.league ?? c?.league ?? slug,
        goalsPerGame: g?.goalsPerGame ?? null,
        drawRate: g?.drawRate ?? null,
        over05_1hPct: t?.over05_1hPct ?? null,
        lateGoalsPct: t?.lateGoalsPct ?? null,
        homeWinPct: c?.homeWinPct ?? null,
        drawPct: c?.drawPct ?? null,
        gamesPlayed: g?.gamesPlayed ?? t?.gamesPlayed ?? c?.gamesPlayed ?? 0,
      };
    });
  }, [selected, goalsData, timingData, compData]);

  // Compute max values for bar scaling
  const maxValues = useMemo(() => {
    const maxes: Record<string, number> = {};
    for (const m of METRICS) {
      const values = merged
        .map((l) => l[m.key as keyof typeof l])
        .filter((v): v is number => v !== null);
      maxes[m.key] = Math.max(...values, 1);
    }
    return maxes;
  }, [merged]);

  const toggle = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < 4
          ? [...prev, slug]
          : prev,
    );
  };

  if (!goalsData) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <BarChart3 className="h-5 w-5 text-emerald-500" />
          Comparaison de ligues
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Sélectionnez 2 à 4 ligues pour comparer leurs statistiques
        </p>
      </div>

      {/* Sélecteur de ligues */}
      <div className="mb-6 flex flex-wrap gap-2">
        {selected.map((slug, i) => {
          const league = allLeagues.find((l) => l.slug === slug);
          return (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
              style={{ borderColor: COLORS[i], color: COLORS[i] }}
            >
              {league?.name ?? slug}
              <button onClick={() => toggle(slug)} className="ml-1 hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {selected.length < 4 && (
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                if (e.target.value) toggle(e.target.value);
                e.target.value = "";
              }}
              value=""
            >
              <option value="">Choisir...</option>
              {allLeagues
                .filter((l) => !selected.includes(l.slug))
                .map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Comparaison */}
      {merged.length < 2 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Sélectionnez au moins 2 ligues pour les comparer.
        </div>
      ) : (
        <div className="space-y-4">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">{m.label}</p>
              <div className="space-y-2">
                {merged.map((league, i) => {
                  const val = league[m.key as keyof typeof league] as number | null;
                  const max = maxValues[m.key];
                  return (
                    <div key={league.slug} className="flex items-center gap-3">
                      <span className="w-32 truncate text-xs font-medium" style={{ color: COLORS[i] }}>
                        {league.name}
                      </span>
                      <div className="flex-1">
                        <div className="h-4 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: val !== null ? `${(val / max) * 100}%` : "0%",
                              background: COLORS[i],
                              opacity: 0.8,
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-14 text-right text-xs font-bold tabular-nums">
                        {val !== null ? `${val.toFixed(1)}${m.unit}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Lien retour */}
          <div className="pt-4 text-center">
            <Link href="/ligues" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              ← Retour aux championnats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
