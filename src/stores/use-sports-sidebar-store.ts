"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MatchViewMode, TimeFilterKey } from "@/lib/match-view";

/**
 * Store global du filtre latéral multi-sports (sidebar 1xBet).
 *
 * Source de vérité unique pour : recherche, fenêtre temporelle, état
 * déplié/replié de l'arborescence, ligues favorites, sélection ligue/sport et
 * mode Live/Pre-match par sport. La grille centrale (football-tab-content,
 * tennis-tab-content) le lit directement — un clic dans la sidebar met à jour
 * la grille sans refresh.
 *
 * Persistance : favoris, plis et modes survivent au rechargement
 * (localStorage). La sélection courante est aussi reflétée dans l'URL
 * (?sport=&league=&time=&q=&view=) via syncToUrl pour partage.
 */

interface SportsSidebarState {
  searchQuery: string;
  selectedTimeFilter: TimeFilterKey;
  expandedSports: Record<string, boolean>;
  expandedCountries: Record<string, boolean>;
  expandedLeagues: Record<string, boolean>;
  favoriteLeagueIds: string[];
  /** true dès que l'utilisateur a touché aux favoris (stoppe les défauts). */
  favoritesCustomized: boolean;
  selectedLeagueId: string | null;
  selectedSportId: string | null;
  modes: Record<string, MatchViewMode>;
  drawerOpen: boolean;
  /**
   * Sélection multi-matchs (clic sur un match dans la sidebar) : la grille
   * centrale n'affiche que ces matchs (ids compatibles arbre ↔ payload).
   */
  selectedMatchIds: string[];

  setSearchQuery: (query: string) => void;
  setTimeFilter: (filter: TimeFilterKey) => void;
  toggleSport: (sportId: string) => void;
  toggleCountry: (countryId: string) => void;
  toggleLeague: (leagueId: string) => void;
  toggleFavoriteLeague: (leagueId: string) => void;
  /** Sélection depuis la sidebar : bascule aussi le sport central. */
  selectLeague: (leagueId: string | null, sportId?: string) => void;
  selectSport: (sportId: string | null) => void;
  /** Sync onglet central → store (pas d'effet de bord inverse). */
  syncSportFromTab: (sportId: string) => void;
  setMode: (sportId: string, mode: MatchViewMode) => void;
  setDrawerOpen: (open: boolean) => void;
  clearFilters: () => void;
  /** Ajoute/retire un match de la sélection (multi-sélection sidebar). */
  toggleMatchSelection: (matchId: string) => void;
  /** Vide la sélection de matchs. */
  clearMatchSelection: () => void;
}

const DEFAULTS = {
  searchQuery: "",
  selectedTimeFilter: "all" as TimeFilterKey,
  selectedLeagueId: null as string | null,
  selectedSportId: null as string | null,
  drawerOpen: false,
  selectedMatchIds: [] as string[],
};

export const useSportsSidebarStore = create<SportsSidebarState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      expandedSports: {},
      expandedCountries: {},
      expandedLeagues: {},
      favoriteLeagueIds: [],
      favoritesCustomized: false,
      modes: {},

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setTimeFilter: (selectedTimeFilter) => set({ selectedTimeFilter }),

      toggleSport: (sportId) =>
        set((s) => ({
          expandedSports: { ...s.expandedSports, [sportId]: !s.expandedSports[sportId] },
        })),

      toggleCountry: (countryId) =>
        set((s) => ({
          expandedCountries: { ...s.expandedCountries, [countryId]: !s.expandedCountries[countryId] },
        })),

      toggleLeague: (leagueId) =>
        set((s) => ({
          expandedLeagues: { ...s.expandedLeagues, [leagueId]: !s.expandedLeagues[leagueId] },
        })),

      toggleFavoriteLeague: (leagueId) =>
        set((s) => ({
          favoritesCustomized: true,
          favoriteLeagueIds: s.favoriteLeagueIds.includes(leagueId)
            ? s.favoriteLeagueIds.filter((id) => id !== leagueId)
            : [...s.favoriteLeagueIds, leagueId],
        })),

      selectLeague: (leagueId, sportId) =>
        set((s) => {
          const isDeselect = leagueId === null || s.selectedLeagueId === leagueId;
          return {
            selectedLeagueId: isDeselect ? null : leagueId,
            selectedSportId: !isDeselect && sportId ? sportId : s.selectedSportId,
          };
        }),

      selectSport: (sportId) =>
        set((s) => ({
          selectedSportId: sportId,
          // Changer de sport via la sidebar annule le filtre ligue :
          // une ligue d'un autre sport n'a pas de sens sur la grille affichée.
          selectedLeagueId:
            s.selectedLeagueId && sportId && !s.selectedLeagueId.startsWith(`${sportId}:`)
              ? null
              : s.selectedLeagueId,
        })),

      syncSportFromTab: (sportId) => {
        if (get().selectedSportId !== sportId) {
          set({ selectedSportId: sportId });
        }
      },

      setMode: (sportId, mode) =>
        set((s) => ({ modes: { ...s.modes, [sportId]: mode } })),

      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

      clearFilters: () => set({ ...DEFAULTS }),

      toggleMatchSelection: (matchId) =>
        set((s) => ({
          selectedMatchIds: s.selectedMatchIds.includes(matchId)
            ? s.selectedMatchIds.filter((id) => id !== matchId)
            : [...s.selectedMatchIds, matchId],
        })),

      clearMatchSelection: () => set({ selectedMatchIds: [] }),
    }),
    {
      name: "pariscore.sportsSidebar",
      partialize: (s) => ({
        favoriteLeagueIds: s.favoriteLeagueIds,
        favoritesCustomized: s.favoritesCustomized,
        expandedSports: s.expandedSports,
        expandedCountries: s.expandedCountries,
        modes: s.modes,
        selectedTimeFilter: s.selectedTimeFilter,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sync URL (?sport=&league=&time=&q=&view=) — history.replaceState uniquement,
// pas de refonte du routing Next (cf. décision use-tab-view.ts).
// ---------------------------------------------------------------------------

const TIME_PARAM_KEYS: TimeFilterKey[] = ["1h", "2h", "4h", "6h", "12h", "24h", "today"];

/** Lit les query params au montage et hydrate le store (1x). */
export function hydrateStoreFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const patch: Partial<SportsSidebarState> = {};

  const league = params.get("league");
  const sport = params.get("sport");
  const time = params.get("time");
  const q = params.get("q");
  const view = params.get("view");

  if (league) {
    patch.selectedLeagueId = league;
    patch.selectedSportId = sport ?? league.split(":")[0] ?? null;
  } else if (sport) {
    patch.selectedSportId = sport;
  }
  if (time && (time === "all" || TIME_PARAM_KEYS.includes(time as TimeFilterKey))) {
    patch.selectedTimeFilter = time as TimeFilterKey;
  }
  if (q) patch.searchQuery = q;
  if (view === "live" || view === "prematch") {
    const target = patch.selectedSportId ?? "football";
    patch.modes = { ...useSportsSidebarStore.getState().modes, [target]: view };
  }
  if (Object.keys(patch).length > 0) useSportsSidebarStore.setState(patch);
}

/** Reflète l'état pertinent dans l'URL (remplacement, sans navigation). */
export function syncStoreToUrl(state: {
  selectedLeagueId: string | null;
  selectedSportId: string | null;
  selectedTimeFilter: TimeFilterKey;
  searchQuery: string;
  modes: Record<string, MatchViewMode>;
}): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const params = new URLSearchParams();
  if (state.selectedSportId) params.set("sport", state.selectedSportId);
  if (state.selectedLeagueId) params.set("league", state.selectedLeagueId);
  if (state.selectedTimeFilter !== "all") params.set("time", state.selectedTimeFilter);
  if (state.searchQuery.trim().length >= 2) params.set("q", state.searchQuery.trim());
  const sportForView = state.selectedLeagueId
    ? state.selectedLeagueId.split(":")[0]
    : state.selectedSportId;
  const view = sportForView ? state.modes[sportForView] : undefined;
  if (view) params.set("view", view);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}

/** Passe la clé temporelle du store au format heures des helpers existants. */
export { parseTimeFilter as selectTimeFilterHours } from "@/lib/match-view";
