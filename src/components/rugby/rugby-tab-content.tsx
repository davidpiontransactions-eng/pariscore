"use client";

/**
 * Onglet Rugby PariScore (Rugby4Cast).
 * - Sélecteur de compétition (les "featured" d'abord).
 * - Deux vues : Prédictions (cartes par journée) et Classement (Elo + Monte Carlo).
 * - Panneau détail au clic sur un match.
 * Données : API publique ESPN, moteur Elo + Poisson + marqueurs d'essai.
 */

import { useCallback, useId, useMemo, useState } from "react";
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
import { Card, SectionHeading, fmtDateLong } from "./rugby-ui";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

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
          <Card className="p-10 text-center text-sm text-slate-400">
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
                "rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums",
                c.upcomingCount > 0 ? "bg-teal-500/20 text-teal-300" : "bg-slate-700/40 text-slate-500"
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
  const { data, isLoading } = useRugbyPredictions(slug);
  const tabsId = useId();
  // keepPreviousData peut renvoyer les matchs de la compétition précédente
  // pendant le re-fetch : on n'affiche que les données de la compétition active.
  const matches = data?.competition?.slug === slug ? data.matches : [];

  // Live / Pre-match : statut ESPN "inprogress" vs "scheduled" (+ fenêtre
  // horaire de début sur le pre-match).
  // Mode Live/Pre-match : store sidebar (source de vérité unique).
  const mode = useSportsSidebarStore((s) => s.modes.rugby ?? "live");
  const setMode = useCallback(
    (m: MatchViewMode) => useSportsSidebarStore.getState().setMode("rugby", m),
    [],
  );
  // Fenêtre horaire : partagée avec la sidebar (store unique, modèle 1xBet).
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday } = parseTimeFilter(timeKey);

  const { live, prematch } = useMemo(
    () => splitLivePrematch(matches, (m) => m.match.status === "inprogress"),
    [matches],
  );

  const visiblePrematch = useMemo(() => {
    const scoped = timeToday ? filterByToday(prematch, (m) => m.match.date) : prematch;
    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.match.date);
    return [...inWindow].sort(
      (a, b) => new Date(a.match.date).getTime() - new Date(b.match.date).getTime(),
    );
  }, [prematch, timeRange, timeToday]);

  const displayMatches = mode === "live" ? live : visiblePrematch;

  const groups = useMemo(() => {
    const map = new Map<string, PredictedMatch[]>();
    for (const m of displayMatches) {
      // Regroupement par journée dans le fuseau de l'utilisateur (Paris),
      // cohérent avec fmtDateLong — pas en UTC.
      const key = new Date(m.match.date).toLocaleDateString("fr-CA", {
        timeZone: "Europe/Paris",
      });
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [displayMatches]);

  if (isLoading && !matches.length) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#12151f]" />
        ))}
      </div>
    );
  }

  if (!matches.length) {
    return (
      <Card className="p-10 text-center">
        <p className="text-3xl" aria-hidden>🏉</p>
        <p className="mt-3 font-semibold text-white">Pas de fixtures à venir</p>
        <p className="mt-1 text-sm text-slate-400">
          Le calendrier de cette compétition n&apos;est pas encore publié — revenez bientôt.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      {data?.degraded && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Données partielles : la source ESPN n&apos;a pas répondu entièrement. Les prédictions affichées proviennent du dernier cache valide.
        </p>
      )}

      {/* Sous-onglets Live | Pre-match (modèle 1xbet) */}
      <MatchViewTabs
        idBase={tabsId}
        active={mode}
        onChange={setMode}
        liveCount={live.length}
        prematchCount={prematch.length}
      />

      {/* Filtre par heure de début — uniquement sur le pre-match */}
      {mode === "prematch" && (
        <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mt-4" />
      )}

      {groups.length === 0 ? (
        <div role="tabpanel" id={`${tabsId}-panel-${mode}`} aria-labelledby={`${tabsId}-${mode}`}>
          <MatchEmptyState mode={mode} />
        </div>
      ) : (
        <div role="tabpanel" id={`${tabsId}-panel-${mode}`} aria-labelledby={`${tabsId}-${mode}`}>
          {groups.map(([day, rows]) => (
            <section key={day} className="first:mt-4">
              <h3 className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                <span className="h-px w-6 bg-teal-500/60" aria-hidden />
                {fmtDateLong(rows[0].match.date)}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {rows.map((r) => (
                  <RugbyMatchCard key={r.match.id} row={r} onOpen={onOpenMatch} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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
