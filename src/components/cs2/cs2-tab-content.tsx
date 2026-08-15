"use client";

import { useState, useCallback, useEffect, useId, useMemo } from "react";
import {
  Crosshair,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { Cs2Match } from "@/lib/cs2/types";
import { HLTVMatchSchedule } from "./HLTVMatchSchedule";
import { HLTVMatchSheetModal } from "./HLTVMatchSheetModal";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

type ApiResponse = {
  matches: Cs2Match[];
  source?: string;
  cache?: string;
};

// ── Data fetching ──
function useCs2Data() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cs2/matches");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Polling adaptatif : 15 s si un match est en cours (score/maps live),
    // 120 s sinon. Le service BSD expose un TTL serveur de 30 s.
    const interval = setInterval(fetchData, data?.matches?.some((m) => m.is_live) ? 15_000 : 120_000);
    return () => clearInterval(interval);
  }, [fetchData, data]);

  return { data, loading, error, mutate: fetchData };
}

// ── Skeleton ──
function Cs2CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-1 h-3 w-8 rounded bg-white/10" />
          <div className="h-5 w-8 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-2 text-right">
            <div className="ml-auto h-4 w-28 rounded bg-white/10" />
            <div className="ml-auto h-3 w-16 rounded bg-white/10" />
          </div>
          <div className="h-12 w-12 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

// ── Error State ──
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <p className="mb-1 text-lg font-semibold text-white">Données CS2 indisponibles</p>
      <p className="mb-6 text-sm text-zinc-400">L&apos;API des matchs CS2 ne répond pas pour le moment.</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
      >
        <RefreshCw className="h-4 w-4" /> Réessayer
      </button>
    </div>
  );
}

// ── Main Component ──
export function Cs2TabContent() {
  const { data, loading, error, mutate } = useCs2Data();
  const [selected, setSelected] = useState<Cs2Match | null>(null);
  const [open, setOpen] = useState(false);
  const matches = data?.matches ?? [];
  const tabsId = useId();

  // Live / Pre-match : is_live fourni par le serveur BSD. Pre-match exclut
  // les matchs terminés, filtrable par heure de début (scheduled).
  // Mode Live/Pre-match : store sidebar (source de vérité unique).
  const mode = useSportsSidebarStore((s) => s.modes.cs2 ?? "live");
  const setMode = useCallback(
    (m: MatchViewMode) => useSportsSidebarStore.getState().setMode("cs2", m),
    [],
  );
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday } = parseTimeFilter(timeKey);

  const { live, prematch } = useMemo(
    () => splitLivePrematch(matches, (m) => m.is_live === true),
    [matches],
  );

  const prematchUpcoming = useMemo(
    () => prematch.filter((m) => (m.status ?? "scheduled") !== "finished"),
    [prematch],
  );

  const visiblePrematch = useMemo(() => {
    const scoped = timeToday ? filterByToday(prematchUpcoming, (m) => m.scheduled) : prematchUpcoming;
    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.scheduled);
    return [...inWindow].sort(
      (a, b) => new Date(a.scheduled ?? 0).getTime() - new Date(b.scheduled ?? 0).getTime(),
    );
  }, [prematchUpcoming, timeRange, timeToday]);

  // La liste rendue dépend de l'onglet actif.
  const visibleMatches = mode === "live" ? live : visiblePrematch;

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <Cs2CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl p-4">
        <ErrorState onRetry={mutate} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
            <Crosshair className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CS2</h1>
            <p className="text-xs text-zinc-400">
              {matches.length > 0
                ? `${matches.length} match${matches.length > 1 ? "s" : ""} à venir`
                : "Counter-Strike 2"}
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Actualiser
        </button>
      </div>

      {/* Sous-onglets Live | Pre-match */}
      <MatchViewTabs
        idBase={tabsId}
        active={mode}
        onChange={setMode}
        liveCount={live.length}
        prematchCount={prematchUpcoming.length}
        className="mb-4"
      />

      {/* Filtre par heure de début — uniquement sur le pre-match */}
      {mode === "prematch" && (
        <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mb-4" />
      )}

      {/* Matches */}
      {visibleMatches.length === 0 ? (
        <div
          role="tabpanel"
          id={`${tabsId}-panel-${mode}`}
          aria-labelledby={`${tabsId}-${mode}`}
        >
          <MatchEmptyState mode={mode} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${tabsId}-panel-${mode}`}
          aria-labelledby={`${tabsId}-${mode}`}
        >
          <HLTVMatchSchedule
            matches={visibleMatches}
            onSelectMatch={(m) => {
              setSelected(m);
              setOpen(true);
            }}
          />

          {/* Fiche de match */}
          <HLTVMatchSheetModal match={selected} open={open} onOpenChange={setOpen} />
        </div>
      )}
      {data?.source && (
        <p className="mt-4 text-center text-xs text-zinc-600">
          Source: {data.source} · Cache: {data.cache ?? "unknown"}
        </p>
      )}
    </div>
  );
}
