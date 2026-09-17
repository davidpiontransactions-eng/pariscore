/**
 * league-id-bridge.ts — Unifie les 4 systèmes d'identification de ligues :
 *   1. OddAlerts  : country/slug (URL param, ex. "england/premier-league")
 *   2. BSD        : numeric league_id (ex. 1)
 *   3. FBref      : soccerdata format (ex. "ENG-Premier League")
 *   4. Understat  : short slug (ex. "epl")
 *
 * Utilisé par l'API unifiée /full pour résoudre les données depuis
 * n'importe quel identifiant d'entrée.
 */

import { BSD_LEAGUE_IDS, LEAGUE_INFO } from "@/lib/league-mapping";

// ── Mapping OddAlerts country/slug → PariScore internal slug ──
// Sources : URL pages /ligues/{country}/{slug}, scrape-oddalerts.js
const ODDALERTS_TO_SLUG: Record<string, string> = {
  "england/premier-league": "epl",
  "england/championship": "championship",
  "england/league-one": "league_one",
  "england/league-two": "league_two",
  "england/national-league": "national_league",
  "spain/la-liga": "laliga",
  "spain/la-liga-2": "laliga2",
  "germany/bundesliga": "bundesliga",
  "germany/2-bundesliga": "bundesliga2",
  "italy/serie-a": "seriea",
  "italy/serie-b": "serieb",
  "france/ligue-1": "ligue1",
  "france/ligue-2": "ligue2",
  "portugal/primeira-liga": "primeira_liga",
  "netherlands/eredivisie": "eredivisie",
  "belgium/jupiler-pro-league": "jupiler",
  "turkey/super-lig": "super_lig",
  "scotland/premiership": "scot_prem",
  "greece/super-league": "superleague_greece",
  "switzerland/super-league": "super_league_swiss",
  "sweden/allsvenskan": "allsvenskan",
  "romania/liga-1": "liga_1_romania",
  "japan/j1-league": "j1_league",
  "south-korea/k-league-1": "k_league1",
  "argentina/primera-division": "argentina_primera",
  "colombia/primera-a": "colombia_primera",
  "denmark/superliga": "denmark_superliga",
  "norway/eliteserien": "norway_eliteserien",
  "saudi-arabia/saudi-pro-league": "saudi_pro_league",
  "usa/mls": "mls",
  "brazil/brasileirao-serie-a": "brasileirao_a",
  "mexico/liga-mx": "liga_mx",
  "australia/a-league-men": "australia_a_league",
  "austria/admiral-bundesliga": "austria_bundesliga",
  "russia/premier-league": "russian_premier",
  "japan/j2-league": "j2_league",
  "sweden/superettan": "superettan",
  "czech-republic/chance-liga": "first_league_cze",
  "scotland/championship": "scot_champ",
  "switzerland/challenge-league": "challenge_swiss",
  "chile/primera-division": "chile_primera",
  "ecuador/liga-pro": "ecuador_serie_a",
  "paraguay/division-1": "paraguay_primera",
};

// ── PariScore slug → FBref soccerdata format ──
// Scrape_extended_stats.py utilise ces slugs pour sd.FBref(league, season)
const SLUG_TO_FBREF: Record<string, string> = {
  epl: "ENG-Premier League",
  laliga: "ESP-La Liga",
  bundesliga: "GER-Bundesliga",
  seriea: "ITA-Serie A",
  ligue1: "FRA-Ligue 1",
  championship: "ENG-Championship",
};

// ── PariScore slug → Understat slug ──
// Scrape_understat.py utilise ces slugs pour getLeagueData/{slug}/{season}
const SLUG_TO_UNDERSTAT: Record<string, string> = {
  epl: "EPL",
  laliga: "La_liga",
  bundesliga: "Bundesliga",
  seriea: "Serie_A",
  ligue1: "Ligue_1",
};

export type LeagueIds = {
  /** PariScore internal slug (clé primaire, ex. "epl") */
  slug: string;
  /** BSD numeric league_id (ex. 1) */
  bsdId: number | null;
  /** FBref soccerdata format (ex. "ENG-Premier League") */
  fbrefLeague: string | null;
  /** Understat short slug (ex. "EPL") */
  understatSlug: string | null;
  /** League display info */
  info: { name: string; country: string } | null;
  /** Flag: data sources available */
  hasFbref: boolean;
  hasUnderstat: boolean;
  hasBsd: boolean;
};

/**
 * Résout tous les identifiants de ligue depuis n'importe quel point d'entrée.
 *
 * @param input - OddAlerts country/slug OU PariScore slug
 * @returns Objet avec tous les identifiants, ou null si inconnu
 */
export function resolveLeagueIds(input: string): LeagueIds | null {
  // Étape 1 : normaliser vers le PariScore slug
  let slug: string | null = null;

  // Input est un OddAlerts country/slug ?
  if (input.includes("/")) {
    slug = ODDALERTS_TO_SLUG[input] ?? null;
  }

  // Input est déjà un PariScore slug ?
  if (!slug && BSD_LEAGUE_IDS[input] !== undefined) {
    slug = input;
  }

  // Fuzzy match (insensible à la casse)
  if (!slug) {
    const lower = input.toLowerCase().replace(/[\s-]+/g, "_");
    if (BSD_LEAGUE_IDS[lower] !== undefined) {
      slug = lower;
    }
  }

  if (!slug) return null;

  const bsdId = BSD_LEAGUE_IDS[slug] ?? null;
  const fbrefLeague = SLUG_TO_FBREF[slug] ?? null;
  const understatSlug = SLUG_TO_UNDERSTAT[slug] ?? null;
  const info = LEAGUE_INFO[slug] ?? null;

  return {
    slug,
    bsdId,
    fbrefLeague,
    understatSlug,
    info,
    hasFbref: fbrefLeague !== null,
    hasUnderstat: understatSlug !== null,
    hasBsd: bsdId !== null,
  };
}

/**
 * Convertit un OddAlerts country/slug en PariScore slug.
 */
export function oddalertsToSlug(country: string, leagueSlug: string): string | null {
  return ODDALERTS_TO_SLUG[`${country}/${leagueSlug}`] ?? null;
}

/**
 * Liste toutes les ligues avec couverture FBref (Big 5 + Championship).
 */
export function fbrefCoveredLeagues(): string[] {
  return Object.keys(SLUG_TO_FBREF);
}

/**
 * Liste toutes les ligues avec couverture Understat.
 */
export function understatCoveredLeagues(): string[] {
  return Object.keys(SLUG_TO_UNDERSTAT);
}

/**
 * Vérifie si une ligue a des données pour un type de source donné.
 */
export function hasSourceCoverage(
  slug: string,
  source: "bsd" | "fbref" | "understat",
): boolean {
  switch (source) {
    case "bsd":
      return slug in BSD_LEAGUE_IDS;
    case "fbref":
      return slug in SLUG_TO_FBREF;
    case "understat":
      return slug in SLUG_TO_UNDERSTAT;
    default:
      return false;
  }
}

// ── Reverse lookup : BSD numeric ID → OddAlerts URL path ──

const BSD_ID_TO_ODDALERTS: Record<number, string> = {};
for (const [oddalertsKey, slug] of Object.entries(ODDALERTS_TO_SLUG)) {
  const bsdId = BSD_LEAGUE_IDS[slug];
  if (bsdId !== undefined) {
    BSD_ID_TO_ODDALERTS[bsdId] = oddalertsKey;
  }
}

/**
 * Convertit un BSD league ID (numeric) en chemin OddAlerts "{country}/{slug}".
 * Retourne null si le mapping n'existe pas.
 *
 * Exemple : bsdIdToOddalertsPath(1) → "england/premier-league"
 */
export function bsdIdToOddalertsPath(bsdId: number): string | null {
  return BSD_ID_TO_ODDALERTS[bsdId] ?? null;
}

/**
 * Convertit un BSD league ID en URL complète /ligues/{country}/{slug}.
 * Retourne null si le mapping n'existe pas.
 */
export function bsdIdToLeagueUrl(bsdId: number): string | null {
  const path = bsdIdToOddalertsPath(bsdId);
  return path ? `/ligues/${path}` : null;
}
