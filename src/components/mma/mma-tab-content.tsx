"use client";

import { useState, useCallback, useEffect, useId, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Loader2,
  Swords,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MmaFilters } from "./mma-filters";
import { MmaFightCard, type MmaFight } from "./mma-fight-card";
import { MmaTopValueWidget } from "./mma-top-value-widget";
import { CagePattern } from "./cage-pattern";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { StrategyFilterDropdown } from "@/components/shared/strategy-filter-dropdown";
import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode, type StrategyFilter } from "@/lib/match-view";
import { useFavorites } from "@/hooks/use-favorites-adapter";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

type MmaEvent = {
  event_date: string;
  event_name: string;
  fights: MmaFight[];
};

type ApiResponse = {
  fights: MmaEvent[];
  source?: string;
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card" aria-busy="true" role="status">
      <div className="h-[2px] w-full bg-muted" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="h-3.5 w-20 rounded bg-muted" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-[60px] w-[60px] rounded-full bg-muted sm:h-[80px] sm:w-[80px]" />
            <div className="h-3 w-5 rounded bg-muted" />
            <div className="h-[60px] w-[60px] rounded-full bg-muted sm:h-[80px] sm:w-[80px]" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="h-3.5 w-20 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-4">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3 w-12 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <p className="mb-1 text-lg font-semibold text-foreground">
        Données MMA indisponibles
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        Les données sont temporairement indisponibles.
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
      >
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Swords className="mb-4 h-12 w-12 text-muted-foreground" />
      <p className="text-lg font-semibold text-foreground">
        Aucun combat à venir
      </p>
      <p className="text-sm text-muted-foreground">
        Revenez plus tard pour les prochains événements UFC/MMA.
      </p>
    </div>
  );
}

function EventSection({
  event,
  defaultOpen,
}: {
  event: MmaEvent;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sport-mma)]/10">
            <Calendar className="h-4 w-4 text-[var(--sport-mma)]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">
              {event.event_name}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {event.fights.length} combat{event.fights.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-5 pb-5">
              {event.fights.map((fight, i) => (
                <MmaFightCard key={`${fight.fighter_a}-${fight.fighter_b}`} fight={fight} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MmaTabContent() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightClass, setWeightClass] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("all");
  const tabsId = useId();
  const { favorites } = useFavorites();

  // Live / Pre-match : l'API MMA n'expose pas de statut live — onglet Live
  // visible à 0 (état vide dédié), combats côté Pre-match filtrables par heure.
  // Mode Live/Pre-match : store sidebar (source de vérité unique).
  const mode = useSportsSidebarStore((s) => s.modes.mma ?? "prematch");
  const setMode = useCallback(
    (m: MatchViewMode) => useSportsSidebarStore.getState().setMode("mma", m),
    [],
  );
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday } = parseTimeFilter(timeKey);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mma/fights");
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
  }, [fetchData]);

  // Aplatit les événements en combats datés (commence_time), tri par heure.
  const battles = useMemo(() => {
    const out: Array<{ fight: MmaFight; event: MmaEvent }> = [];
    for (const ev of data?.fights ?? []) {
      for (const fight of ev.fights) out.push({ fight, event: ev });
    }
    out.sort(
      (a, b) =>
        new Date(a.fight.commence_time).getTime() - new Date(b.fight.commence_time).getTime(),
    );
    return out;
  }, [data]);

  const { prematch } = useMemo(() => splitLivePrematch(battles, () => false), [battles]);

  // Filtres cumulés : catégorie de poids + stratégie + fenêtre horaire.
  const visibleBattles = useMemo(() => {
    let list = prematch;
    if (weightClass !== "All") {
      const norm = weightClass.toLowerCase().replace(/\s+/g, "_");
      list = list.filter(
        (b) => b.fight.weight_class?.toLowerCase().replace(/\s+/g, "_") === norm,
      );
    }
    // Filtre stratégie
    if (strategyFilter === "value") {
      list = list.filter((b) => b.fight.bet_a || b.fight.bet_b);
    } else if (strategyFilter === "favorites") {
      list = list.filter((b) => {
        const id = `mma:${b.fight.fighter_a}:${b.fight.fighter_b}:${b.fight.commence_time}`;
        return favorites.has(id);
      });
    }
    const scoped = timeToday ? filterByToday(list, (b) => b.fight.commence_time) : list;
    return filterByStartWindow(scoped, timeRange, (b) => b.fight.commence_time);
  }, [prematch, weightClass, strategyFilter, timeRange, timeToday, favorites]);

  // Regroupe par événement (ordre de rencontre conservé).
  const filtered = useMemo(() => {
    const map = new Map<string, MmaEvent>();
    for (const b of visibleBattles) {
      if (!map.has(b.event.event_name)) {
        map.set(b.event.event_name, { ...b.event, fights: [] });
      }
      map.get(b.event.event_name)!.fights.push(b.fight);
    }
    return [...map.values()];
  }, [visibleBattles]);

  if (loading && !data) {
    return (
      <div className="relative space-y-3 p-4">
        <CagePattern />
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="relative p-4">
        <CagePattern />
        <ErrorState onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="relative space-y-4 p-4">
      <CagePattern />

      {/* Sous-onglets Live | Pre-match */}
      <MatchViewTabs
        idBase={tabsId}
        active={mode}
        onChange={setMode}
        liveCount={0}
        prematchCount={prematch.length}
      />

      {mode === "live" ? (
        <div role="tabpanel" id={`${tabsId}-panel-live`} aria-labelledby={`${tabsId}-live`}>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Swords className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Le suivi live sera bientôt disponible
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Les combats en direct seront affichés ici.
            </p>
          </div>
        </div>
      ) : (
        <div role="tabpanel" id={`${tabsId}-panel-prematch`} aria-labelledby={`${tabsId}-prematch`}>
          <MmaFilters weightClass={weightClass} onWeightClassChange={setWeightClass} />

          <StrategyFilterDropdown
            sport="mma"
            value={strategyFilter}
            onChange={setStrategyFilter}
          />

          {/* Top Value Bets widget */}
          <MmaTopValueWidget fights={prematch.map((b) => b.fight)} className="mt-3" />

          {/* Filtre par heure de début (fenêtre glissante 1h → 24h) */}
          <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mt-3" />

          {filtered.length === 0 ? (
            timeRange === null && !timeToday ? (
              <EmptyState />
            ) : (
              <MatchEmptyState mode="prematch" />
            )
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((ev) => (
                <EventSection
                  key={ev.event_name}
                  event={ev}
                  defaultOpen={filtered.length === 1}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {data?.source && (
        <p className="text-center text-xs text-muted-foreground/60">
          {data.source.replace("odds-api+ml", "The Odds API + ML")}
        </p>
      )}
    </div>
  );
}
