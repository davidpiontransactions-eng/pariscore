"use client";

/**
 * Onglet Rugby PariScore (Rugby4Cast).
 * - Sélecteur de compétition (les "featured" d'abord).
 * - Deux vues : Prédictions (cartes par journée) et Classement (Elo + Monte Carlo).
 * - Panneau détail au clic sur un match.
 * Données : API publique ESPN, moteur Elo + Poisson + marqueurs d'essai.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useRugbyCompetitions,
  useRugbyPredictions,
  useRugbyStandings,
} from "@/lib/hooks/use-rugby";
import type { Competition, PredictedMatch } from "@/lib/rugby/types";
import { RugbyMarketsView } from "./RugbyMarketsView";
import { RugbyMatchCard } from "./RugbyMatchCard";
import { RugbyMatchDetailModal } from "./RugbyMatchDetailModal";
import { RugbyMethodology } from "./RugbyMethodology";
import { RugbyStandingsTable } from "./RugbyStandingsTable";
import { RugbyCalendarTable, type RugbyCalMatch } from "./rugby-calendar-table";
import { useRugbyCalendar } from "@/hooks/use-rugby-calendar";
import { Card, SectionHeading, fmtDateLong } from "./rugby-ui";
import { getFlashscorePayload } from "@/lib/rugby/provider";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { RugbyTopStrategiesWidget } from "./rugby-top-strategies-widget";
import { useRugbyTopStrategies } from "@/hooks/use-rugby-top-strategies";
import { buildRugbyTopTags, rugbyTopTagsForMatch } from "@/lib/top10-rugby-calendar-link";
import type { RugbyStrategyKey } from "@/lib/rugby-strategy-top";

type View = "predictions" | "standings" | "markets";

export function RugbyTabContent() {
  const { data: compsData, isLoading: compsLoading } = useRugbyCompetitions();
  const competitions = compsData?.competitions ?? [];

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [view, setView] = useState<View>("predictions");
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null);

  // Sélection par défaut : première compétition "featured" ayant des fixtures.
  const activeSlug = selectedSlug ?? competitions.find((c) => c.featured && c.upcomingCount > 0)?.slug ?? competitions[0]?.slug ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-5">
      {/* En-tête */}
      <div className="pt-6">
        <SectionHeading
          kicker="Rugby4Cast"
          title="Prédictions rugby — les deux codes, les deux hémisphères"
          sub="Ratings Elo dynamiques, modèle de score Poisson, marché over/under, handicap et marqueurs d'essai. Du Top 14 au Super Rugby, du Six Nations à la NRL."
        />
      </div>

      {/* Sélecteur de compétition */}
      <CompetitionSelector
        competitions={competitions}
        loading={compsLoading}
        activeSlug={activeSlug}
        onSelect={setSelectedSlug}
      />

      {/* Bascule de vue */}
      <div className="mt-5 flex items-center gap-2">
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Contenu */}
      <div className="mt-5">
        {activeSlug ? (
          view === "predictions" ? (
            <PredictionsView slug={activeSlug} onOpenMatch={setDetailMatchId} />
          ) : view === "markets" ? (
            <RugbyMarketsView slug={activeSlug} />
          ) : (
            <StandingsView slug={activeSlug} />
          )
        ) : (
          <Card className="p-10 text-center text-sm text-white/60">
            {compsLoading ? "Chargement des compétitions…" : "Aucune compétition disponible."}
          </Card>
        )}
      </div>

      {/* Méthodologie du modèle */}
      <RugbyMethodology />

      {/* Panneau détail */}
      <RugbyMatchDetailModal slug={activeSlug} matchId={detailMatchId} onClose={() => setDetailMatchId(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de compétition                                             */
/* ------------------------------------------------------------------ */

function CompetitionSelector({
  competitions,
  loading,
  activeSlug,
  onSelect,
}: {
  competitions: Competition[];
  loading: boolean;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  if (loading && !competitions.length) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-xl bg-[#12151f]" />
        ))}
      </div>
    );
  }
  const sorted = [...competitions].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => onSelect(c.slug)}
            className={cn(
              "group flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all",
              active
                ? "border-teal-500/60 bg-teal-500/15 text-teal-200 shadow-md shadow-teal-500/10"
                : "border-white/8 bg-[#12151f] text-slate-300 hover:border-teal-500/30 hover:bg-[#151a26]"
            )}
            aria-pressed={active}
          >
            <span className="truncate">{c.name}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums",
                c.upcomingCount > 0 ? "bg-teal-500/20 text-teal-300" : "bg-slate-700/40 text-slate-400"
              )}
            >
              {c.upcomingCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bascule Prédictions / Classement                                     */
/* ------------------------------------------------------------------ */

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { id: View; label: string }[] = [
    { id: "predictions", label: "Prédictions" },
    { id: "markets", label: "Marchés" },
    { id: "standings", label: "Classement & titres" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-white/8 bg-[#12151f] p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-xs font-bold transition-colors",
            view === o.id ? "bg-teal-500 text-teal-950" : "text-slate-300 hover:bg-white/5"
          )}
          aria-pressed={view === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue Prédictions                                                      */
/* ------------------------------------------------------------------ */

function PredictionsView({ slug, onOpenMatch }: { slug: string; onOpenMatch: (id: string) => void }) {
  const { matches: allMatches, loading: calendarLoading } = useRugbyCalendar();

// Intégrer les données Flashscore comme fallback si les données ESPN sont anciennes
const [flashscoreMatches, setFlashscoreMatches] = useState<RugbyCalMatch[]>([]);
const [flashscoreLoaded, setFlashscoreLoaded] = useState(false);

useEffect(() => {
  // Charger Flashscore uniquement si ESPN est vieux (>6h) OU s'il n'y a pas de matchs
  const checkAndLoadFlashscore = async () => {
    try {
      const res = await fetch('/api/rugby/flashscore?slug=top-14');
      if (!res.ok) return;
      const flashData = await res.json();
      if (flashData && flashData.matches && flashData.matches.length > 0) {
        const formatted = flashData.matches.map((m: Record<string, unknown>) => ({
          id: (m.matchId || m.id) as string,
          scheduledAt: (m.scheduledAt || '') as string,
          home: { name: (m.home || 'Inconnu') as string, logo: m.logo as string },
          away: { name: (m.away || 'Inconnu') as string, logo: m.logo as string },
          status: (m.status || 'scheduled') as string,
          homeScore: m.homeScore as number | null,
          awayScore: m.awayScore as number | null,
          minute: m.minute as number | null,
          competition: (m.competition || 'top-14') as string,
          competitionName: (m.competitionName || 'Top 14') as string,
          probPct: m.probPct as number | null,
          confLabel: m.confLabel as string | null,
          verdict: m.verdict as string | null,
          expectedHomeScore: m.expectedHomeScore as number | null,
          expectedAwayScore: m.expectedAwayScore as number | null,
          expectedMargin: m.expectedMargin as number | null,
          mostLikelyScore: m.mostLikelyScore as string | null,
        }));
        setFlashscoreMatches(formatted);
        setFlashscoreLoaded(true);
      }
    } catch (err) {
      console.error('[rugby] Flashscore fallback failed:', err);
    }
  };

  const hasMatches = allMatches?.length > 0;

  if (!hasMatches) {
    checkAndLoadFlashscore();
  }
}, [allMatches, calendarLoading]);

// Utiliser les matches Flashscore comme complément ou remplacement
const effectiveMatches = flashscoreMatches.length > 0 ? flashscoreMatches : allMatches;
  const tabsId = useId();

  // Filtrer par compétition sélectionnée (utilise effectiveMatches pour le fallback Flashscore)
  const matches = useMemo(
    () => effectiveMatches.filter((m) => m.competition === slug),
    [effectiveMatches, slug]
  );

  // Live / Pre-match
  const mode = useSportsSidebarStore((s) => s.modes.rugby ?? "live");
  const setMode = useCallback(
    (m: MatchViewMode) => useSportsSidebarStore.getState().setMode("rugby", m),
    [],
  );
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday } = parseTimeFilter(timeKey);

  const { live, prematch } = useMemo(
    () => splitLivePrematch(matches, (m) => m.status === "inprogress"),
    [matches],
  );

  const visiblePrematch = useMemo(() => {
    const scoped = timeToday ? filterByToday(prematch, (m) => m.scheduledAt) : prematch;
    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.scheduledAt);
    return [...inWindow].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }, [prematch, timeRange, timeToday]);

  const displayMatches = mode === "live" ? live : visiblePrematch;

  // Top10 stratégies — fetch pour toutes les stratégies (pour pills calendrier)
  const { matches: topHomeWin } = useRugbyTopStrategies("homeWin", 10);
  const { matches: topAwayWin } = useRugbyTopStrategies("awayWin", 10);
  const { matches: topOver415 } = useRugbyTopStrategies("over415", 10);
  const { matches: topUnder515 } = useRugbyTopStrategies("under515", 10);
  const { matches: topHandicapHome } = useRugbyTopStrategies("handicapHome", 10);
  const { matches: topHandicapAway } = useRugbyTopStrategies("handicapAway", 10);
  const { matches: topBttsYes } = useRugbyTopStrategies("bttsYes", 10);
  const { matches: topMarginBand } = useRugbyTopStrategies("marginBand", 10);
  const { matches: topBestAttack } = useRugbyTopStrategies("bestAttack", 10);
  const { matches: topBestDefense } = useRugbyTopStrategies("bestDefense", 10);

  const topIdx = useMemo(() => buildRugbyTopTags({
    homeWin: topHomeWin,
    awayWin: topAwayWin,
    over415: topOver415,
    under515: topUnder515,
    handicapHome: topHandicapHome,
    handicapAway: topHandicapAway,
    bttsYes: topBttsYes,
    marginBand: topMarginBand,
    bestAttack: topBestAttack,
    bestDefense: topBestDefense,
  }), [topHomeWin, topAwayWin, topOver415, topUnder515, topHandicapHome, topHandicapAway, topBttsYes, topMarginBand, topBestAttack, topBestDefense]);

  const topTagsFor = useCallback(
    (id: string) => {
      const m = displayMatches.find((c) => c.id === id);
      return m ? rugbyTopTagsForMatch(topIdx, m) : [];
    },
    [displayMatches, topIdx],
  );

  if (calendarLoading && !matches.length) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl"
            style={{ height: 120, backgroundColor: "#f5f5f5" }}
          />
        ))}
      </div>
    );
  }

  if (!matches.length) {
    return <RugbyTopStrategiesWidget />;
  }

  return (
    <div className="space-y-5">
      {/* Sous-onglets Live | Pre-match */}
      <MatchViewTabs
        idBase={tabsId}
        active={mode}
        onChange={setMode}
        liveCount={live.length}
        prematchCount={prematch.length}
      />

      {/* Filtre par heure — uniquement sur le pre-match */}
      {mode === "prematch" && (
        <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mt-4" />
      )}

      {/* Calendrier style FotMob */}
      <div role="tabpanel" id={`${tabsId}-panel-${mode}`} aria-labelledby={`${tabsId}-${mode}`}>
        <RugbyCalendarTable
          matches={displayMatches}
          loading={calendarLoading}
          onMatchClick={onOpenMatch}
          topTagsFor={topTagsFor}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue Classement                                                       */
/* ------------------------------------------------------------------ */

function StandingsView({ slug }: { slug: string }) {
  const { data, isLoading } = useRugbyStandings(slug);

  if (isLoading && !data) {
    return <div className="h-96 animate-pulse rounded-2xl bg-[#12151f]" />;
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.degraded && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Données partielles : dernier cache valide affiché.
        </p>
      )}
      <RugbyStandingsTable standings={data.standings} simulatedRuns={data.simulatedRuns} />
    </div>
  );
}
