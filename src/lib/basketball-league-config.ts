/**
 * Configuration par ligue pour le basketball.
 * Calibrations NBA vs FIBA : pace baseline, 3PT line, rules, pourcentages de moyenne ligue.
 * Source : AGENTS.md session Basketball Engineering Loop + research académique.
 */

import type { BasketballLeagueId } from "./basketball-data";

export type LeagueConfig = {
  id: BasketballLeagueId;
  label: string;
  shortLabel: string;
  country: string;
  countryCode: string;
  season: string;
  espnKey: string; // clé ESPN API (nba, wnba, euroleague)
  paceBaseline: number; // possessions par 48 min (normalisé NBA)
  threePointLine: number; // mètres
  quarterMinutes: number;
  foulLimit: number;
  usesFibaRules: boolean;
  hcaPoints: number; // home-court advantage en points (littérature : NBA 2.5-3.5, EuroLeague 3-5)
  sdMargin: number; // écart-type marge (pts)
  sdTotal: number; // écart-type total (pts)
  leagueAvgPf: number; // PF moyen ligue (pour normalisation pace)
};

export const LEAGUE_CONFIGS: Record<BasketballLeagueId, LeagueConfig> = {
  nba: {
    id: "nba",
    label: "NBA",
    shortLabel: "NBA",
    country: "USA",
    countryCode: "US",
    season: "2025-26",
    espnKey: "nba",
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
    season: "2026",
    espnKey: "wnba",
    paceBaseline: 98.0,
    threePointLine: 6.75, // FIBA distance (WNBA utilise la ligne FIBA)
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.0,
    sdMargin: 11.0,
    sdTotal: 16.0,
    leagueAvgPf: 84.0,
  },
  euroleague: {
    id: "euroleague",
    label: "EuroLeague",
    shortLabel: "EUL",
    country: "Pan-européen",
    countryCode: "EU",
    season: "2025-26",
    espnKey: "euroleague",
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 4.0, // HCA plus élevé en Europe (crowd, travel)
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
    season: "2025-26",
    espnKey: "eurocup",
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
  lnb: {
    id: "lnb",
    label: "Betclic Élite",
    shortLabel: "LNB",
    country: "France",
    countryCode: "FR",
    season: "2025-26",
    espnKey: "lnb", // API-Sports ou scraping
    paceBaseline: 84.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.5,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 82.0,
  },
  acb: {
    id: "acb",
    label: "Liga ACB",
    shortLabel: "ACB",
    country: "Espagne",
    countryCode: "ES",
    season: "2025-26",
    espnKey: "acb",
    paceBaseline: 85.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.5,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 83.0,
  },
  lba: {
    id: "lba",
    label: "LBA",
    shortLabel: "LBA",
    country: "Italie",
    countryCode: "IT",
    season: "2025-26",
    espnKey: "lba",
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.5,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 81.0,
  },
  bsl: {
    id: "bsl",
    label: "BSL",
    shortLabel: "BSL",
    country: "Turquie",
    countryCode: "TR",
    season: "2025-26",
    espnKey: "bsl",
    paceBaseline: 84.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 4.0, // HCA élevé en Turquie (foules agressives)
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 82.0,
  },
  bbl: {
    id: "bbl",
    label: "BBL",
    shortLabel: "BBL",
    country: "Allemagne",
    countryCode: "DE",
    season: "2025-26",
    espnKey: "bbl",
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.5,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 81.0,
  },
  aba: {
    id: "aba",
    label: "ABA League",
    shortLabel: "ABA",
    country: "Ex-Yougoslavie",
    countryCode: "BA",
    season: "2025-26",
    espnKey: "aba",
    paceBaseline: 83.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 3.8,
    sdMargin: 10.5,
    sdTotal: 15.0,
    leagueAvgPf: 80.0,
  },
  greek: {
    id: "greek",
    label: "Greek Basket League",
    shortLabel: "GBL",
    country: "Grèce",
    countryCode: "GR",
    season: "2025-26",
    espnKey: "greek",
    paceBaseline: 82.0,
    threePointLine: 6.75,
    quarterMinutes: 10,
    foulLimit: 5,
    usesFibaRules: true,
    hcaPoints: 4.0,
    sdMargin: 10.0,
    sdTotal: 14.5,
    leagueAvgPf: 79.0,
  },
};

/** Normalise le pace d'une ligue FIBA vers l'échelle NBA (107.4 baseline). */
export function normalizePace(rawPace: number, league: BasketballLeagueId): number {
  const cfg = LEAGUE_CONFIGS[league];
  if (!cfg || cfg.paceBaseline === 0) return rawPace;
  return rawPace * (107.4 / cfg.paceBaseline);
}

/** Calcule le spread attendu en points depuis le rating diff (calibré par ligue). */
export function ratingDiffToSpread(ratingDiff: number, league: BasketballLeagueId): number {
  const cfg = LEAGUE_CONFIGS[league];
  // NBA: ~28 pts spread par 400 Elo. FIBA: ajusté pour pace plus bas.
  const ptsPerElo = league === "nba" ? 28 : 24; // FIBA: fewer possessions → slightly less spread per Elo
  return (ratingDiff * ptsPerElo) / 400;
}

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
export const DOMESTIC_LEAGUES: BasketballLeagueId[] = ["lnb", "acb", "lba", "bsl", "bbl", "aba", "greek"];

/** Groupe de ligues pour l'UI. */
export type LeagueGroup = "nba" | "euro" | "domestic";

export function getLeagueGroup(league: BasketballLeagueId): LeagueGroup {
  if (league === "nba" || league === "wnba") return "nba";
  if (league === "euroleague" || league === "eurocup") return "euro";
  return "domestic";
}

export function getLeaguesByGroup(group: LeagueGroup): BasketballLeagueId[] {
  return getAllLeagueIds().filter((l) => getLeagueGroup(l) === group);
}
