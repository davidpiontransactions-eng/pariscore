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
  /** Filtre par pays sélectionné dans la sidebar (ex: "france", "england"). */
  selectedCountryId: string | null;
  modes: Record<string, MatchViewMode>;
  /**
   * Filtre de statut de l'arbre sidebar : Tout / Live / Avant-match.
   * Indépendant de `modes` (utilisé par les grilles centrales) — le toggle
   * 3 états écrit les deux pour rester compatible.
   */
  treeStatus: "all" | "live" | "prematch";
  drawerOpen: boolean;
  /**
   * Sélection multi-matchs (clic sur un match dans la sidebar) : la grille
   * centrale n'affiche que ces matchs (ids compatibles arbre ↔ payload).
   */
  selectedMatchIds: string[];
  /** Ensembles nommés de ligues favorites (nom → liste d'ids "sport:slug"). */
  namedLeagueSets: Record<string, string[]>;
  /** Ensemble nommé actuellement actif (null = aucun, affiche tous les favoris). */
  activeLeagueSet: string | null;
  /** Masquer les cotes 1X2 dans la sidebar (affiche "—" à la place). */
  hideOdds: boolean;
  /** IDs des équipes suivies (format "sport:slug" ou "sport:pays:nom"). */
  followedTeamIds: string[];
  /** true dès que l'utilisateur a modifié ses équipes suivies. */
  teamsCustomized: boolean;

  setSearchQuery: (query: string) => void;
  setTimeFilter: (filter: TimeFilterKey) => void;
  toggleSport: (sportId: string) => void;
  toggleCountry: (countryId: string) => void;
  toggleLeague: (leagueId: string) => void;
  toggleFavoriteLeague: (leagueId: string) => void;
  /** Sélection depuis la sidebar : bascule aussi le sport central. */
  selectLeague: (leagueId: string | null, sportId?: string) => void;
  selectSport: (sportId: string | null) => void;
  /** Sélectionne un pays → filtre la grille centrale sur ce pays. */
  selectCountry: (countryId: string | null, sportId?: string) => void;
  /** Sync onglet central → store (pas d'effet de bord inverse). */
  syncSportFromTab: (sportId: string) => void;
  setMode: (sportId: string, mode: MatchViewMode) => void;
  setTreeStatus: (status: "all" | "live" | "prematch") => void;
  setDrawerOpen: (open: boolean) => void;
  clearFilters: () => void;
  /** Ajoute/retire un match de la sélection (multi-sélection sidebar). */
  toggleMatchSelection: (matchId: string) => void;
  /** Vide la sélection de matchs. */
  clearMatchSelection: () => void;
  /** Sauvegarde les favoris courants sous un nom d'ensemble. */
  saveLeagueSet: (name: string) => void;
  /** Charge un ensemble nommé dans les favoris et l'active. */
  loadLeagueSet: (name: string) => void;
  /** Supprime un ensemble nommé. */
  deleteLeagueSet: (name: string) => void;
  /** Désactive l'ensemble actif, revient aux favoris normaux. */
  clearActiveLeagueSet: () => void;
  /** Afficher / masquer les cotes 1X2. */
  setHideOdds: (hide: boolean) => void;
  /** Ajoute/retire une équipe de la liste des suivies. */
  toggleFollowedTeam: (teamId: string) => void;
  /** Vérifie si une équipe est suivie. */
  isFollowedTeam: (teamId: string) => boolean;
}

const DEFAULTS = {
  searchQuery: "",
  selectedTimeFilter: "all" as TimeFilterKey,
  treeStatus: "all" as "all" | "live" | "prematch",
  selectedLeagueId: null as string | null,
  selectedSportId: null as string | null,
  selectedCountryId: null as string | null,
  drawerOpen: false,
  selectedMatchIds: [] as string[],
  activeLeagueSet: null as string | null,
  hideOdds: false,
  followedTeamIds: [] as string[],
  teamsCustomized: false,
};

const DEFAULT_NAMED_SETS: Record<string, string[]> = {
  "Top 5": [
    "football:premier-league",
    "football:la-liga",
    "football:bundesliga",
    "football:serie-a",
    "football:ligue-1",
  ],
  "Grand Slams": [
    "tennis:australian-open",
    "tennis:roland-garros",
    "tennis:wimbledon",
    "tennis:us-open",
  ],
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
      namedLeagueSets: { ...DEFAULT_NAMED_SETS },
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
          // Changer de sport annule aussi le filtre pays.
          selectedCountryId: null,
        })),

      selectCountry: (countryId, sportId) =>
        set((s) => {
          const isDeselect = countryId === null || s.selectedCountryId === countryId;
          return {
            selectedCountryId: isDeselect ? null : countryId,
            // Sélectionner un pays annule le filtre ligue (une ligue est plus spécifique).
            selectedLeagueId: isDeselect ? s.selectedLeagueId : null,
            selectedSportId: !isDeselect && sportId ? sportId : s.selectedSportId,
          };
        }),

      syncSportFromTab: (sportId) => {
        if (get().selectedSportId !== sportId) {
          set({ selectedSportId: sportId });
        }
      },

      setMode: (sportId, mode) =>
        set((s) => ({ modes: { ...s.modes, [sportId]: mode } })),

      setTreeStatus: (treeStatus) => set({ treeStatus }),

      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

      clearFilters: () => set({ ...DEFAULTS, selectedCountryId: null }),

      toggleMatchSelection: (matchId) =>
        set((s) => ({
          selectedMatchIds: s.selectedMatchIds.includes(matchId)
            ? s.selectedMatchIds.filter((id) => id !== matchId)
            : [...s.selectedMatchIds, matchId],
        })),

      clearMatchSelection: () => set({ selectedMatchIds: [] }),

      saveLeagueSet: (name) =>
        set((s) => ({
          namedLeagueSets: { ...s.namedLeagueSets, [name]: [...s.favoriteLeagueIds] },
        })),

      loadLeagueSet: (name) =>
        set((s) => {
          const ids = s.namedLeagueSets[name];
          if (!ids) return s;
          return { favoriteLeagueIds: [...ids], activeLeagueSet: name };
        }),

      deleteLeagueSet: (name) =>
        set((s) => {
          const { [name]: _, ...rest } = s.namedLeagueSets;
          return {
            namedLeagueSets: rest,
            activeLeagueSet: s.activeLeagueSet === name ? null : s.activeLeagueSet,
          };
        }),

      clearActiveLeagueSet: () => set({ activeLeagueSet: null }),

      setHideOdds: (hideOdds) => set({ hideOdds }),

      toggleFollowedTeam: (teamId) =>
        set((s) => ({
          teamsCustomized: true,
          followedTeamIds: s.followedTeamIds.includes(teamId)
            ? s.followedTeamIds.filter((id) => id !== teamId)
            : [...s.followedTeamIds, teamId],
        })),

      isFollowedTeam: (teamId) => get().followedTeamIds.includes(teamId),
    }),
    {
      name: "pariscore.sportsSidebar",
      partialize: (s) => ({
        favoriteLeagueIds: s.favoriteLeagueIds,
        favoritesCustomized: s.favoritesCustomized,
        namedLeagueSets: s.namedLeagueSets,
        activeLeagueSet: s.activeLeagueSet,
        expandedSports: s.expandedSports,
        expandedCountries: s.expandedCountries,
        expandedLeagues: s.expandedLeagues,
        modes: s.modes,
        treeStatus: s.treeStatus,
        selectedTimeFilter: s.selectedTimeFilter,
        hideOdds: s.hideOdds,
        followedTeamIds: s.followedTeamIds,
        teamsCustomized: s.teamsCustomized,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sync URL (?sport=&league=&time=&q=&view=) — history.replaceState uniquement,
// pas de refonte du routing Next (cf. décision use-tab-view.ts).
// ---------------------------------------------------------------------------

const TIME_PARAM_KEYS: TimeFilterKey[] = ["1h", "2h", "4h", "6h", "12h", "24h", "today", "tomorrow"];

/** Lit les query params au montage et hydrate le store (1x). */
export function hydrateStoreFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const patch: Partial<SportsSidebarState> = {};

  const league = params.get("league");
  const sport = params.get("sport");
  const country = params.get("country");
  const time = params.get("time");
  const q = params.get("q");
  const view = params.get("view");

  if (league) {
    patch.selectedLeagueId = league;
    patch.selectedSportId = sport ?? league.split(":")[0] ?? null;
  } else if (sport) {
    patch.selectedSportId = sport;
  }
  if (country) patch.selectedCountryId = country;
  if (time && (time === "all" || TIME_PARAM_KEYS.includes(time as TimeFilterKey))) {
    patch.selectedTimeFilter = time as TimeFilterKey;
  }
  if (q) patch.searchQuery = q;
  if (view === "live" || view === "prematch") {
    patch.treeStatus = view;
    const target = patch.selectedSportId ?? "football";
    patch.modes = { ...useSportsSidebarStore.getState().modes, [target]: view };
  } else if (view === "all") {
    patch.treeStatus = "all";
  }
  const ids = params.get("ids");
  if (ids) {
    patch.selectedMatchIds = ids.split(",").filter(Boolean);
  }
  if (Object.keys(patch).length > 0) useSportsSidebarStore.setState(patch);
}

/** Reflète l'état pertinent dans l'URL (remplacement, sans navigation). */
export function syncStoreToUrl(state: {
  selectedLeagueId: string | null;
  selectedSportId: string | null;
  selectedCountryId: string | null;
  selectedTimeFilter: TimeFilterKey;
  searchQuery: string;
  modes: Record<string, MatchViewMode>;
  treeStatus: "all" | "live" | "prematch";
  selectedMatchIds: string[];
}): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const params = new URLSearchParams();
  if (state.selectedSportId) params.set("sport", state.selectedSportId);
  if (state.selectedLeagueId) params.set("league", state.selectedLeagueId);
  if (state.selectedCountryId) params.set("country", state.selectedCountryId);
  if (state.selectedTimeFilter !== "all") params.set("time", state.selectedTimeFilter);
  if (state.searchQuery.trim().length >= 2) params.set("q", state.searchQuery.trim());
  if (state.treeStatus !== "all") params.set("view", state.treeStatus);
  if (state.selectedMatchIds.length > 0) params.set("ids", state.selectedMatchIds.join(","));
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}

/** Passe la clé temporelle du store au format heures des helpers existants. */
export { parseTimeFilter as selectTimeFilterHours } from "@/lib/match-view";
