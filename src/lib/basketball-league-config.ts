/**
 * Configuration par ligue pour le basketball — catalogue élargi 1xbet (2026-09-23).
 * Calibrations NBA vs FIBA : pace baseline, 3PT line, rules, pourcentages de moyenne ligue.
 * Saisons dérivées de la date (fin du hardcode "2025-26" — fix audit).
 * hasFeed = source de matchs câblée (ESPN/euroleague_api) ; les autres ligues
 * du catalogue 1xbet sont affichées mais sans fetcher (état explicite, plus de
 * chip silencieusement vide sans signal).
 */

import type { BasketballLeagueId } from "./basketball-data";

export type LeagueConfig = {
  id: BasketballLeagueId;
  label: string;
  shortLabel: string;
  country: string;
  countryCode: string;
  season: string;
  espnKey: string; // clé ESPN API si disponible (nba, wnba, mens-college-basketball…)
  /** Groupe UI (chip row du sélecteur) */
  group: LeagueGroup;
  /** Feed de matchs réellement câblé dans BasketballTabContent */
  hasFeed: boolean;
  paceBaseline: number; // possessions par 48 min (normalisé NBA)
  threePointLine: number; // mètres
  quarterMinutes: number;
  foulLimit: number;
  usesFibaRules: boolean;
  hcaPoints: number; // home-court advantage en points
  sdMargin: number; // écart-type marge (pts)
  sdTotal: number; // écart-type total (pts)
  leagueAvgPf: number; // PF moyen ligue (pour normalisation pace)
};

/** Groupe de ligues pour l'UI (modèle 1xbet : géographie/compétition). */
export type LeagueGroup = "usa" | "euro" | "domestic" | "world" | "americas" | "asia";

/** Ordre des groupes dans le sélecteur. */
export const GROUP_ORDER: LeagueGroup[] = ["usa", "euro", "domestic", "world", "americas", "asia"];

/** Saison Europe/étendues : campagne août→juillet (ex: oct 2026 → "2026-27"). */
function euroSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Saison calendaires (WNBA, Asie, Amériques, tournois FIBA). */
function calendarSeason(): string {
  return String(new Date().getFullYear());
}

/** Saison NCAA : même campagne août→juillet. */
function ncaaSeason(): string {
  return euroSeason();
}

/** Défaut FIBA générique pour les ligues du catalogue sans calibrage dédié. */
function fibaLeague(
  id: BasketballLeagueId,
  label: string,
  shortLabel: string,
  country: string,
  countryCode: string,
  group: LeagueGroup,
  overrides: Partial<LeagueConfig> = {},
): LeagueConfig {
  return {
    id,
    label,
    shortLabel,
    country,
    countryCode,
    season: euroSeason(),
    espnKey: "",
    group,
    hasFeed: false,
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.5,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 82.0,
    ...overrides,
  };
}

export const LEAGUE_CONFIGS: Record<BasketballLeagueId, LeagueConfig> = {
  // ── USA ──────────────────────────────────────────────
  nba: {
    id: "nba",
    label: "NBA",
    shortLabel: "NBA",
    country: "USA",
    countryCode: "US",
    season: euroSeason(),
    espnKey: "nba",
    group: "usa",
    hasFeed: true,
    paceBaseline: 107.4,
    threePointLine: 7.24,
    quarterMinutes: 12,
    foulLimit: 6,
    usesFibaRules: false,
    hcaPoints: 3.2,
    sdMargin: 12.0,
    sdTotal: 18.0,
    leagueAvgPf: 114.5,
  },
  wnba: {
    id: "wnba",
    label: "WNBA",
    shortLabel: "WNBA",
    country: "USA",
    countryCode: "US",
    season: calendarSeason(),
    espnKey: "wnba",
    group: "usa",
    hasFeed: true,
    paceBaseline: 98.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.0,
    sdMargin: 11.0,
    sdTotal: 16.0,
    leagueAvgPf: 84.0,
  },
  ncaa: fibaLeague("ncaa", "NCAA Men's", "NCAA", "USA", "US", "usa", {
    season: ncaaSeason(),
    espnKey: "mens-college-basketball",
    usesFibaRules: false,
    quarterMinutes: 20, // mi-temps de 20 min (règles NCAA)
    foulLimit: 5,
    hcaPoints: 4.5, // HCA college plus marqué (salle pleine, fouls house)
    paceBaseline: 70.0,
    leagueAvgPf: 75.0,
    sdMargin: 11.0,
    sdTotal: 16.0,
  }),

  // ── Euro / coupes clubs ──────────────────────────────
  euroleague: {
    id: "euroleague",
    label: "EuroLeague",
    shortLabel: "EUL",
    country: "Pan-européen",
    countryCode: "EU",
    season: euroSeason(),
    espnKey: "euroleague",
    group: "euro",
    hasFeed: true,
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 4.0,
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 80.0,
  },
  eurocup: {
    id: "eurocup",
    label: "EuroCup",
    shortLabel: "EUC",
    country: "Pan-européen",
    countryCode: "EU",
    season: euroSeason(),
    espnKey: "eurocup",
    group: "euro",
    hasFeed: true,
    paceBaseline: 82.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.8,
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 79.0,
  },
  bcl: fibaLeague("bcl", "Basketball Champions League", "BCL", "Pan-européen", "EU", "euro", {
    hcaPoints: 3.5,
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 79.5,
  }),

  // ── Mondial ──────────────────────────────────────────
  fiba: {
    id: "fiba",
    label: "FIBA Women's WC",
    shortLabel: "FIBA",
    country: "International",
    countryCode: "INT",
    season: calendarSeason(),
    espnKey: "fiba",
    group: "world",
    hasFeed: false,
    paceBaseline: 72.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 2.5,
    sdMargin: 12.5,
    sdTotal: 17.0,
    leagueAvgPf: 78.0,
  },
  olympics: fibaLeague("olympics", "Jeux Olympiques", "OLY", "International", "INT", "world", {
    season: calendarSeason(),
    hcaPoints: 2.0, // tournoi neutre
    sdMargin: 12.5,
    sdTotal: 17.0,
    leagueAvgPf: 80.0,
  }),
  bal: fibaLeague("bal", "Basketball Africa League", "BAL", "Afrique", "INT", "world", {
    season: calendarSeason(),
    leagueAvgPf: 78.0,
  }),

  // ── Domestiques Europe ───────────────────────────────
  lnb: fibaLeague("lnb", "Betclic Élite", "LNB", "France", "FR", "domestic", {
    espnKey: "lnb",
    leagueAvgPf: 82.0,
  }),
  acb: fibaLeague("acb", "Liga ACB", "ACB", "Espagne", "ES", "domestic", { espnKey: "acb" }),
  lba: fibaLeague("lba", "LBA", "LBA", "Italie", "IT", "domestic", {
    espnKey: "lba",
    leagueAvgPf: 81.0,
  }),
  bsl: fibaLeague("bsl", "BSL", "BSL", "Turquie", "TR", "domestic", {
    espnKey: "bsl",
    hcaPoints: 4.0,
    sdMargin: 10.5,
    sdTotal: 15.0,
  }),
  bbl: fibaLeague("bbl", "BBL", "BBL", "Allemagne", "DE", "domestic", {
    espnKey: "bbl",
    leagueAvgPf: 81.0,
  }),
  aba: fibaLeague("aba", "ABA League", "ABA", "Ex-Yougoslavie", "BA", "domestic", {
    espnKey: "aba",
    hcaPoints: 3.8,
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 80.0,
  }),
  greek: fibaLeague("greek", "Greek Basket League", "GBL", "Grèce", "GR", "domestic", {
    espnKey: "greek",
    hcaPoints: 4.0,
    leagueAvgPf: 79.0,
  }),
  lkl: fibaLeague("lkl", "LKL", "LKL", "Lituanie", "LT", "domestic", { leagueAvgPf: 80.0 }),
  plk: fibaLeague("plk", "PLK", "PLK", "Pologne", "PL", "domestic"),
  lpb: fibaLeague("lpb", "LPB", "LPB", "Portugal", "PT", "domestic"),
  isr: fibaLeague("isr", "Winner League", "WLN", "Israël", "IL", "domestic", { hcaPoints: 4.5 }),
  hun: fibaLeague("hun", "NB I", "NBI", "Hongrie", "HU", "domestic"),
  swe: fibaLeague("swe", "Basketligan", "SWE", "Suède", "SE", "domestic", {
    leagueAvgPf: 84.0,
  }),
  den: fibaLeague("den", "Basketligaen", "DEN", "Danemark", "DK", "domestic", {
    leagueAvgPf: 84.0,
  }),

  // ── Amériques ────────────────────────────────────────
  cebl: fibaLeague("cebl", "CEBL", "CEBL", "Canada", "CA", "americas", {
    season: calendarSeason(),
    paceBaseline: 86.0,
    leagueAvgPf: 90.0,
  }),
  nbb: fibaLeague("nbb", "NBB", "NBB", "Brésil", "BR", "americas", {
    season: calendarSeason(),
    leagueAvgPf: 80.0,
  }),
  arg: fibaLeague("arg", "Liga Nacional", "LIGA", "Argentine", "AR", "americas", {
    season: calendarSeason(),
  }),

  // ── Asie-Pacifique ───────────────────────────────────
  nbl: fibaLeague("nbl", "NBL", "NBL", "Australie", "AU", "asia", {
    espnKey: "nbl",
    season: calendarSeason(),
    leagueAvgPf: 87.0,
  }),
  cba: fibaLeague("cba", "CBA", "CBA", "Chine", "CN", "asia", {
    season: calendarSeason(),
    leagueAvgPf: 100.0,
    paceBaseline: 88.0,
  }),
  kbl: fibaLeague("kbl", "KBL", "KBL", "Corée du Sud", "KR", "asia", {
    season: calendarSeason(),
    leagueAvgPf: 82.0,
  }),
  jbl: fibaLeague("jbl", "B.League", "JBL", "Japon", "JP", "asia", {
    season: calendarSeason(),
    leagueAvgPf: 81.0,
  }),
  pba: fibaLeague("pba", "PBA", "PBA", "Philippines", "PH", "asia", {
    season: calendarSeason(),
    leagueAvgPf: 95.0,
    paceBaseline: 86.0,
  }),
};

/** Retourne la config d'une ligue. */
export function getLeagueConfig(league: BasketballLeagueId): LeagueConfig {
  return LEAGUE_CONFIGS[league];
}

/** Liste des ligues disponibles. */
export function getAllLeagueIds(): BasketballLeagueId[] {
  return Object.keys(LEAGUE_CONFIGS) as BasketballLeagueId[];
}

/** Ligues NBA/WNBA (ESPN gratuit). */
export const ESPN_LEAGUES: BasketballLeagueId[] = ["nba", "wnba"];

/** Ligues EuroLeague/EuroCup (euroleague_api gratuit). */
export const EUROLEAGUE_LEAGUES: BasketballLeagueId[] = ["euroleague", "eurocup"];

/** Ligues domestiques (API-Sports payant). */
export const DOMESTIC_LEAGUES: BasketballLeagueId[] = getLeaguesByGroup("domestic");

export function getLeagueGroup(league: BasketballLeagueId): LeagueGroup {
  return LEAGUE_CONFIGS[league].group;
}

export function getLeaguesByGroup(group: LeagueGroup): BasketballLeagueId[] {
  return getAllLeagueIds().filter((l) => LEAGUE_CONFIGS[l].group === group);
}
