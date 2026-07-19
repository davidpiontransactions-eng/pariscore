"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Trophy, RefreshCw, AlertCircle, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import { CyclingFilters } from "./cycling-filters";
import { CyclingStageCard, CyclingStageCardSkeleton } from "./cycling-stage-card";
import type { StageData, RiderFavourite } from "./cycling-stage-card";

// ── All 21 stages of Tour de France 2026 ──
const ALL_STAGES: StageData[] = [
  { stage:1, date:"2026-07-04", route:"Barcelona \u2192 Barcelona", km:19.6, type:"TTT", elev:280, country:"Spain" },
  { stage:2, date:"2026-07-05", route:"Tarragona \u2192 Barcelona", km:168.3, type:"Hills", elev:2100, country:"Spain" },
  { stage:3, date:"2026-07-06", route:"Barcelona \u2192 Andorra", km:182.0, type:"Mountain", elev:4200, country:"Andorra" },
  { stage:4, date:"2026-07-07", route:"Andorra \u2192 Lleida", km:175.0, type:"Hills", elev:2500, country:"Spain" },
  { stage:5, date:"2026-07-08", route:"Andorra \u2192 Andorra", km:159.0, type:"Mountain", elev:4100, country:"Andorra" },
  { stage:6, date:"2026-07-09", route:"Lleida \u2192 Perpignan", km:190.0, type:"Flat", elev:900, country:"France" },
  { stage:7, date:"2026-07-10", route:"Perpignan \u2192 Montpellier", km:165.0, type:"Flat", elev:600, country:"France" },
  { stage:8, date:"2026-07-11", route:"Montpellier \u2192 N\u00eemes", km:165.0, type:"Flat", elev:800, country:"France" },
  { stage:9, date:"2026-07-12", route:"N\u00eemes \u2192 Puy de D\u00f4me", km:184.5, type:"Mountain", elev:3800, country:"France" },
  { stage:10, date:"2026-07-14", route:"Clermont-Ferrand \u2192 Bordeaux", km:210.0, type:"Flat", elev:1200, country:"France" },
  { stage:11, date:"2026-07-15", route:"Bordeaux \u2192 Toulouse", km:185.0, type:"Flat", elev:700, country:"France" },
  { stage:12, date:"2026-07-16", route:"Toulouse \u2192 Plateau de Beille", km:168.0, type:"Mountain", elev:4000, country:"France" },
  { stage:13, date:"2026-07-17", route:"Pamiers \u2192 Superbagn\u00e8res", km:145.0, type:"Mountain", elev:3800, country:"France" },
  { stage:14, date:"2026-07-18", route:"Tarbes \u2192 Hautacam", km:152.0, type:"Mountain", elev:4500, country:"France" },
  { stage:15, date:"2026-07-19", route:"Pau \u2192 Pau (ITT)", km:32.0, type:"ITT", elev:380, country:"France" },
  { stage:16, date:"2026-07-21", route:"Agen \u2192 Limoges", km:195.0, type:"Hills", elev:1600, country:"France" },
  { stage:17, date:"2026-07-22", route:"Limoges \u2192 Al\u00e8s", km:188.0, type:"Hills", elev:2000, country:"France" },
  { stage:18, date:"2026-07-23", route:"Al\u00e8s \u2192 Valence", km:210.0, type:"Hills", elev:1800, country:"France" },
  { stage:19, date:"2026-07-24", route:"Valence \u2192 Col de la Madeleine", km:165.0, type:"Mountain", elev:4600, country:"France" },
  { stage:20, date:"2026-07-25", route:"Grenoble \u2192 Isola 2000", km:175.0, type:"Mountain", elev:4800, country:"France" },
  { stage:21, date:"2026-07-26", route:"Thoiry \u2192 Paris Champs-\u00c9lys\u00e9es", km:133.0, type:"Flat", elev:600, country:"France" },
];

// ── API response types ──
type CyclingApiResponse = {
  ok: boolean;
  stage: number;
  date: string;
  route: string;
  km: number;
  type: string;
  elev: number;
  country: string;
  season: number;
  race: string;
  source: string;
  riders?: Array<{
    code: string;
    name: string;
    team: string;
    win: number;
    podium: number;
    photo?: string;
    team_logo?: string;
  }>;
  favourites?: {
    ok: boolean;
    title?: string;
    description?: string;
    favourites?: Array<{
      tier: number;
      team: string;
      riders: Array<{ name: string; photo?: string }>;
    }>;
  };
  error?: string;
};

// ── Data fetching hook ──
function useCyclingData() {
  const [data, setData] = useState<CyclingApiResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const fetchData = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/cycling");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json: CyclingApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, isLoading, isValidating, mutate: fetchData };
}

// ── Main tab content ──
export function CyclingTabContent() {
  const { data, error, isLoading, isValidating, mutate } = useCyclingData();
  const [stageType, setStageType] = useState("");

  // Build rider favourites from API riders data
  const topFavourites: RiderFavourite[] = useMemo(() => {
    if (!data?.riders) return [];
    return data.riders
      .map((r) => ({
        name: r.name,
        prob: +(r.win * 100).toFixed(1),
        team: r.team,
        photo: r.photo,
      }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 10);
  }, [data]);

  // Current stage data
  const currentStage: StageData | null = useMemo(() => {
    if (!data) return null;
    return {
      stage: data.stage,
      date: data.date,
      route: data.route,
      km: data.km,
      type: data.type,
      elev: data.elev,
      country: data.country,
    };
  }, [data]);

  // Filtered stages
  const filteredStages = useMemo(() => {
    if (!stageType) return ALL_STAGES;
    const key = stageType === "Hilly" ? "Hills" : stageType;
    return ALL_STAGES.filter((s) => s.type === key);
  }, [stageType]);
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
            <Bike className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{data?.race || "Tour de France"} 2026</h1>
            <p className="text-xs text-gray-400">
              {currentStage
                ? "Étape " + currentStage.stage + " · " + currentStage.date
                : "Cyclisme vertical"}
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", isValidating && "animate-spin")} />
          Actualiser
        </button>
      </div>
      {/* Error state */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Donn&eacute;es indisponibles</p>
            <p className="mt-0.5 text-xs">{error.message}</p>
          </div>
        </div>
      )}
      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <CyclingStageCardSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Filters */}
          <div className="mb-6">
            <CyclingFilters
              stageType={stageType}
              onStageTypeChange={setStageType}
            />
          </div>
          {/* Current stage detail */}
          {currentStage && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                &Eacute;tape en cours
              </h2>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                <div className="lg:col-span-2 xl:col-span-2">
                  <CyclingStageCard
                    stage={currentStage}
                    favourites={topFavourites.slice(0, 3)}
                    priority
                  />
                </div>
                {/* Favourites sidebar */}
                <div className="rounded-2xl border border-border/60 bg-[#1A1A2E] p-4 sm:p-5">
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                    Top 10 Favoris
                  </h3>
                  <div className="space-y-2">
                    {topFavourites.slice(0, 10).map((r, i) => (
                      <div
                        key={r.name}
                        className="flex items-center gap-2.5 text-xs"
                      >
                        <span className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold",
                          i < 3 ? "bg-amber-500/20 text-amber-400" : "bg-gray-700/40 text-gray-500",
                        )}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-white">{r.name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-700/50">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                              style={{ width: r.prob + "%" }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-[10px] font-bold tabular-nums text-amber-400">
                            {r.prob}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
          {/* All stages list */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {stageType ? (
                <>
                  &Eacute;tapes {stageType === "Hills" ? "Vallonées" : stageType === "Flat" ? "Plates" : stageType === "ITT" ? "CLM" : stageType === "TTT" ? "CLM/équipe" : stageType}
                  ({filteredStages.length})
                </>
              ) : (
                <>
                  Toutes les &eacute;tapes ({filteredStages.length})
                </>
              )}
            </h2>
            {filteredStages.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {filteredStages.map((s, i) => (
                  <CyclingStageCard
                    key={s.stage}
                    stage={s}
                    favourites={
                      s.stage === currentStage?.stage
                        ? topFavourites.slice(0, 3)
                        : []
                    }
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Aucune &eacute;tape trouv&eacute;e</p>
                <p className="text-xs text-muted-foreground">
                  Aucune &eacute;tape ne correspond au filtre &quot;{stageType}&quot;
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Bike className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Chargement...</p>
        </div>
      )}
    </div>
  );
}
