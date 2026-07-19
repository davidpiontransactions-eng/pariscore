"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Gauge, AlertCircle, RefreshCw, Trophy, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { F1DriverCard, type F1Driver } from "./f1-driver-card";

type F1Race = {
  round: number;
  name: string;
  date: string;
  circuit?: string;
  country?: string;
};

type F1ApiResponse = {
  ok: boolean;
  season?: number;
  round?: number;
  race?: F1Race;
  races?: F1Race[];
  drivers?: F1Driver[];
  bets?: Array<Record<string, unknown>>;
  model?: string;
  calibrated?: boolean;
  note?: string;
  sims?: number;
  updatedAt?: string;
};

function useF1Data() {
  const [data, setData] = useState<F1ApiResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/f1");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json: F1ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, isLoading, mutate: fetchData };
}

function SkeletonDriver() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-3 w-24 rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="h-20 w-20 rounded-full bg-white/10" />
      </div>
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full rounded bg-white/10" />
        ))}
      </div>
    </div>
  );
}

export function F1TabContent() {
  const { data, error, isLoading, mutate } = useF1Data();
  const [teamFilter, setTeamFilter] = useState("");

  const teams = useMemo(() => {
    if (!data?.drivers) return [];
    return [...new Set(data.drivers.map((d) => d.team))].sort();
  }, [data]);

  const filteredDrivers = useMemo(() => {
    if (!data?.drivers) return [];
    let list = [...data.drivers];
    if (teamFilter) list = list.filter((d) => d.team === teamFilter);
    return list.sort((a, b) => (b.win ?? 0) - (a.win ?? 0));
  }, [data, teamFilter]);

  const nextRace = data?.race;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
            <Gauge className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Formula 1 {data?.season || ""}</h1>
            <p className="text-xs text-gray-400">
              {nextRace ? `${nextRace.name} · ${nextRace.date}` : data?.model || "Hiérarchie ROL"}
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Actualiser
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Données F1 indisponibles</p>
            <p className="mt-0.5 text-xs">{error.message}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonDriver key={i} />)}
        </div>
      ) : data ? (
        <>
          {/* Next race highlight */}
          {nextRace && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Prochain GP
              </h2>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-red-500/5 to-transparent p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-red-400" />
                  <div>
                    <p className="font-semibold text-white">{nextRace.name}</p>
                    <p className="text-xs text-zinc-400">
                      {nextRace.country ? `${nextRace.country} · ` : ""}
                      Round {nextRace.round} · {nextRace.date}
                      {nextRace.circuit ? ` · ${nextRace.circuit}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Note */}
          {data.note && (
            <p className="mb-4 text-[11px] italic text-zinc-600">{data.note}</p>
          )}

          {/* Team filter */}
          {teams.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setTeamFilter("")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  !teamFilter
                    ? "bg-red-500/20 text-red-300"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10"
                )}
              >
                Toutes
              </button>
              {teams.map((t) => (
                <button
                  key={t}
                  onClick={() => setTeamFilter(t)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    teamFilter === t
                      ? "bg-red-500/20 text-red-300"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Drivers grid */}
          {filteredDrivers.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Pilotes ({filteredDrivers.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {filteredDrivers.map((d, i) => (
                  <F1DriverCard key={d.code} driver={d} index={i} />
                ))}
              </div>
            </section>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
              <Trophy className="h-8 w-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-400">Aucun pilote</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
