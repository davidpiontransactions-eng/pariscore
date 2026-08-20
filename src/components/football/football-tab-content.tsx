"use client";

import { useState, useMemo, useId, useCallback, lazy, Suspense } from "react";
import { useTranslations } from "next-intl";
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  TicketPercent,
  Gauge,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/hooks/use-favorites";
import type { FootballMatch } from "@/lib/football-data";
import { FootballLeagueBar } from "./football-filters";
import { TopTeamsPresetsBar, type TopTeamPreset, applyPresetFilter } from "./top-teams-presets-bar";
import { useCornervalueStats } from "@/hooks/use-cornervalue-stats";
import { useTeamAttackDefenseStats } from "@/hooks/use-team-attack-defense-stats";
import { FootballMatchCardSkeleton } from "./football-match-card";
import { FootballLiveCard, FootballLiveCardSkeleton } from "./football-live-card";
import { FlashscoreFootballList } from "./flashscore-football-list";
import { FootballBankerWidget } from "./football-banker";
import { FootballRoundGroups } from "./football-round-groups";
import { AIFilterBuilderDialog } from "./AIFilterBuilderDialog";
import { BetSlipGeneratorDialog } from "./BetSlipGeneratorDialog";
import { ReliabilityScore } from "./ReliabilityScore";
import { StrategyImprovementPanel } from "./StrategyImprovementPanel";
import { useFootballAIFilters } from "@/hooks/use-football-ai-filters";
import { useFootballBacktest } from "@/hooks/use-football-backtest";
import { applyCompiledRules, type AIFilterPreset } from "@/lib/football-nl-filter";
import { bestMatchEdge } from "@/lib/football-correct-score";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import {
  filterByStartWindow,
  filterByToday,
  filterBySelection,
  filterLiveByWindow,
  parseTimeFilter,
  type MatchViewMode,
} from "@/lib/match-view";

// Dialog de détail (momentum) — lazy : ne charge pas le code tant qu'aucun match
// n'est ouvert. Miroir du pattern tennis (tennis-tab-content.tsx).
const FootballMatchDetailDialog = lazy(() =>
  import("./football-match-detail-dialog").then((m) => ({ default: m.FootballMatchDetailDialog })),
);

type FootFilter = "all" | "value" | "today" | "topConf" | "corners" | "btts";

export function FootballTabContent() {
  const t = useTranslations("common");
  const { data, error, isLoading, isValidating, mutate } = useFootballMatches();
  const { favorites, toggle: toggleFavorite } = useFavorites();

  // Ligue / fenêtre horaire / mode Live-Pre-match : source de vérité unique =
  // store sidebar (filtre latéral multi-sports, modèle 1xBet). La grille se
  // met à jour en temps réel sur clic dans la sidebar ou ici (mêmes contrôleurs).
  // Les ids ligue du store sont préfixés « football: » (portée multi-sports) :
  // on ne garde que la part football ; une sélection d'un autre sport → null.
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const selectedLeague = useMemo(() => {
    if (selectedLeagueId && selectedLeagueId.startsWith("football:")) {
      return selectedLeagueId.slice("football:".length);
    }
    return null;
  }, [selectedLeagueId]);
  const setSelectedLeague = useCallback(
    (id: string | null) =>
      useSportsSidebarStore
        .getState()
        .selectLeague(id === null ? null : `football:${id}`, "football"),
    [],
  );
  const [filter, setFilter] = useState<FootFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [presetFilter, setPresetFilter] = useState<TopTeamPreset | null>(null);
  const tabsId = useId();

  // Live / Pre-match (modèle 1xbet) + filtre par heure de début.
  const mode = useSportsSidebarStore((s) => s.modes.football ?? "live");
  const setMode = useCallback(
    (m: MatchViewMode) => useSportsSidebarStore.getState().setMode("football", m),
    [],
  );
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday } = parseTimeFilter(timeKey);

  // Suite AI Pricing — filtres NL, combiné, backtest/fiabilité.
  const { presets: aiPresets, addPreset: addAIPreset, removePreset: removeAIPreset } = useFootballAIFilters();
  const [aiFilterDialogOpen, setAIFilterDialogOpen] = useState(false);
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [activeAIFilterId, setActiveAIFilterId] = useState<string | null>(null);
  const [sortByEdge, setSortByEdge] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const activeAIFilter = aiPresets.find((p) => p.id === activeAIFilterId) ?? null;

  // Cornervalue data — charge selon la ligue selectionnee
  const { data: cvData } = useCornervalueStats(selectedLeague);

  // Attaque/Defense stats — charge selon la ligue selectionnee
  const { data: adData } = useTeamAttackDefenseStats(selectedLeague);

  // Détail match (dialog momentum) — state lifté, une seule instance rendue.
  const [detailMatch, setDetailMatch] = useState<FootballMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const openDetail = (match: FootballMatch) => {
    setDetailMatch(match);
    setDetailOpen(true);
  };

  const matches: FootballMatch[] = data?.matches ?? [];
  const backtestState = useFootballBacktest(matches);

  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  const liveMatches = useMemo(() => {
    let list = matches.filter((m) => m.live && (m.live.status === "LIVE" || m.live.status === "HT"));
    if (selectedLeague) list = list.filter((m) => m.league.id === selectedLeague);
    if (timeRange !== null) list = filterLiveByWindow(list, timeRange, (m) => m.scheduledAt);
    else if (timeToday) list = filterByToday(list, (m) => m.scheduledAt);
    return filterBySelection(list, selectedMatchIds, (m) => m.id);
  }, [matches, selectedLeague, timeRange, timeToday, selectedMatchIds]);

  const prematchMatches = useMemo(() => {
    let list = matches.filter((m) => !m.live || m.live.status === "FT" || m.live.status === "PEN");
    if (selectedLeague) list = list.filter((m) => m.league.id === selectedLeague);
    // Appliquer le preset Top Teams AVANT les sous-filtres existants
    if (presetFilter) {
      list = applyPresetFilter(list, presetFilter, cvData, adData).filtered;
    }
    if (filter === "today") {
      const today = new Date().toDateString();
      list = list.filter((m) => new Date(m.scheduledAt).toDateString() === today);
    }
    if (filter === "value") {
      list = list.filter((m) => {
        const diff = Math.abs(m.prediction.homeProb - (m.odds ? 1 / m.odds.home * 100 : 50));
        return diff > 5;
      });
    }
    if (filter === "topConf") {
      list = list.filter((m) => {
        const p = m.prediction;
        return (
          (p.doubleChance && p.doubleChance.prob >= 75) ||
          (p.over15Prob !== undefined && p.over15Prob >= 75) ||
          (p.under35Prob !== undefined && p.under35Prob >= 75) ||
          (p.bttsProb >= 75) ||
          (p.bestCornerOver && p.bestCornerOver.overProb >= 75)
        );
      });
    }
    if (filter === "corners") {
      list = list.filter((m) => m.prediction.bestCornerOver && m.prediction.bestCornerOver.overProb >= 60);
    }
    if (filter === "btts") {
      list = list.filter((m) => m.prediction.bttsProb >= 55);
    }
    // Filtre IA compilé (langage naturel) — appliqué après les sous-filtres.
    if (activeAIFilter) {
      list = applyCompiledRules(list, activeAIFilter.rules);
    }
    // Filtre par heure de début (fenêtre glissante 1h → 24h ou jour calendaire).
    if (timeRange !== null) {
      list = filterByStartWindow(list, timeRange, (m) => m.scheduledAt);
    } else if (timeToday) {
      list = filterByToday(list, (m) => m.scheduledAt);
    }
    // Sélection sidebar : ne montrer que les matchs choisis. Vide = pas de filtre.
    list = filterBySelection(list, selectedMatchIds, (m) => m.id);
    // Tri : par edge/value (décroissant) ou par date (croissant).
    if (sortByEdge) {
      return [...list].sort((a, b) => (bestMatchEdge(b) ?? -Infinity) - (bestMatchEdge(a) ?? -Infinity));
    }
    return list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [matches, selectedLeague, presetFilter, cvData, adData, filter, activeAIFilter, sortByEdge, timeRange, timeToday, selectedMatchIds]);

  const FILTERS: { key: FootFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "today", label: "Aujourd'hui" },
    { key: "value", label: "Value Bets" },
    { key: "topConf", label: "Fortes Confiances" },
    { key: "corners", label: "Spe Corners" },
    { key: "btts", label: "BTTS" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* View mode toggle + refresh */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1">
          <button
            onClick={() => setViewMode("cards")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "cards"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cartes
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Liste
          </button>
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

      {/* Barre d'outils AI Pricing — filtres NL, tri edge, combiné, fiabilité */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAIFilterDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Filtre IA
        </button>

        {aiPresets.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setActiveAIFilterId(activeAIFilterId === p.id ? null : p.id)}
              title={p.description}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeAIFilterId === p.id
                  ? "border-violet-500 bg-violet-500/15 text-violet-300"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
            <button
              type="button"
              onClick={() => {
                removeAIPreset(p.id);
                if (activeAIFilterId === p.id) setActiveAIFilterId(null);
              }}
              className="rounded-full p-0.5 text-muted-foreground hover:text-rose-400"
              aria-label={`Supprimer le filtre ${p.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setSortByEdge((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sortByEdge
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          Trier par Edge
        </button>

        <button
          type="button"
          onClick={() => setBetSlipOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TicketPercent className="h-3.5 w-3.5" aria-hidden />
          Combiné
        </button>

        <button
          type="button"
          onClick={() => setShowBacktest((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            showBacktest
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Fiabilité
        </button>
      </div>

      {/* Panneaux AI Pricing (conditionnels) */}
      {showBacktest && <ReliabilityScore state={backtestState} className="mb-6" />}
      {activeAIFilter && (
        <StrategyImprovementPanel
          matches={prematchMatches}
          preset={activeAIFilter}
          onSaveVariation={(p) => addAIPreset(p)}
          className="mb-6"
        />
      )}

      {/* Sous-onglets Live | Pre-match (modèle 1xbet) */}
      <MatchViewTabs
        idBase={tabsId}
        active={mode}
        onChange={setMode}
        liveCount={liveMatches.length}
        prematchCount={prematchMatches.length}
        className="mb-4"
      />

      {viewMode === "list" ? (
        <div role="tabpanel" id={`${tabsId}-panel-${mode}`} aria-labelledby={`${tabsId}-${mode}`}>
          {mode === "prematch" && (
            <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mb-4" />
          )}
          <FlashscoreFootballList
            matches={mode === "live" ? liveMatches : prematchMatches}
            favoriteIds={favorites}
            onToggleFavorite={toggleFavorite}
            onOpenDetail={openDetail}
            isLoading={isLoading}
            error={error?.message ?? null}
            onRetry={() => mutate()}
          />
        </div>
      ) : (
        <>
          {/* Error (global — visible sur les deux sous-onglets) */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{t("errorTitle")}</p>
                <p className="mt-0.5 text-xs">{t("errorBody")}</p>
              </div>
            </div>
          )}

          {mode === "live" ? (
            /* ── Sous-onglet Live ─────────────────────────────────────── */
            <section
              className="mb-8"
              role="tabpanel"
              id={`${tabsId}-panel-live`}
              aria-labelledby={`${tabsId}-live`}
            >
              {isLoading ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1].map((i) => (
                      <FootballLiveCardSkeleton key={`live-sk-${i}`} />
                    ))}
                  </div>
                </>
              ) : liveMatches.length > 0 ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      EN DIRECT ({liveMatches.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {liveMatches.map((m) => (
                      <FootballLiveCard key={m.id} match={m} onOpenDetail={openDetail} />
                    ))}
                  </div>
                </>
              ) : (
                <MatchEmptyState mode="live" />
              )}
            </section>
          ) : (
            /* ── Sous-onglet Pre-match ────────────────────────────────── */
            <div
              role="tabpanel"
              id={`${tabsId}-panel-prematch`}
              aria-labelledby={`${tabsId}-prematch`}
            >
              {/* Banker du week-end — pick éditorial + top 3 (respecte la ligue/no filtres) */}
              {!isLoading && prematchMatches.length > 0 && (
                <FootballBankerWidget matches={prematchMatches} onOpenDetail={openDetail} />
              )}

              {/* League filters */}
              {!isLoading && prematchMatches.length > 0 && (
                <div className="mb-4">
                  <FootballLeagueBar
                    matches={prematchMatches}
                    selectedLeague={selectedLeague}
                    onSelectLeague={setSelectedLeague}
                  />
                </div>
              )}

          {/* Top Teams presets */}
          <div className="mb-4">
            <TopTeamsPresetsBar
              matches={prematchMatches}
              activePreset={presetFilter}
              onPresetChange={setPresetFilter}
              cvData={cvData}
              adData={adData}
            />
          </div>

          {/* Sub-filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === f.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtre par heure de début (fenêtre glissante 1h → 24h / aujourd'hui) */}
          <TimeRangeFilter value={timeKey} onChange={setTimeKey} className="mb-4" />

          {/* Match grid (pre-match uniquement) */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <FootballMatchCardSkeleton key={i} />
              ))}
            </div>
          ) : prematchMatches.length > 0 ? (
            <FootballRoundGroups matches={prematchMatches} onOpenDetail={openDetail} />
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Aucun match trouvé</p>
              <p className="text-xs text-muted-foreground">
                {filter === "today"
                  ? "Aucun match programmé aujourd'hui pour cette ligue"
                  : timeRange !== null
                    ? "Aucun match ne commence dans cette fenêtre horaire"
                    : "Aucun match ne correspond aux filtres sélectionnés"}
              </p>
            </div>
          )}
            </div>
          )}
        </>
      )}

      {/* Dialog momentum — une seule instance, lazy-loadée */}
      <Suspense fallback={null}>
        <FootballMatchDetailDialog match={detailMatch} open={detailOpen} onOpenChange={setDetailOpen} />
      </Suspense>

      {/* Dialogs suite AI Pricing */}
      <AIFilterBuilderDialog
        open={aiFilterDialogOpen}
        onOpenChange={setAIFilterDialogOpen}
        onSave={(preset: AIFilterPreset) => {
          addAIPreset(preset);
          setActiveAIFilterId(preset.id);
        }}
      />
      <BetSlipGeneratorDialog open={betSlipOpen} onOpenChange={setBetSlipOpen} matches={prematchMatches} />
    </div>
  );
}
