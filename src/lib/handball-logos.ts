// Logos handball locaux + drapeaux ligues (aucun hotlink en prod).
// Sources : TheSportsDB (licence CC BY-NC, badges r2.thesportsdb.com).
// Couverture réelle : l'endpoint search_all_leagues.php?s=Handball ne retourne
// que 5 ligues → 4 logos mappés ; le reste = drapeau seul (fallback propre).

import { countryFlag } from "@/lib/top-matches/types";

/** Normalisation insensible accents/casse/ponctuation pour le matching. */
export function normHandballName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ─── Logos ligues (clés normalisées ; "||pays" = portée pays) ─── */

const LEAGUE_LOGOS: Record<string, string> = {
  // Starligue (logo French LNH Division 1)
  starligue: "/logos/handball/leagues/starligue.png",
  // Danemark domestique (logo Danish Mens Handball League, fallback générique)
  "herrehandboldligaen": "/logos/handball/leagues/herre-handbold.png",
  "1division||denmark": "/logos/handball/leagues/herre-handbold.png",
  "1divisionwomen||denmark": "/logos/handball/leagues/herre-handbold.png",
  "danishcup||denmark": "/logos/handball/leagues/herre-handbold.png",
  // Coupes d'Europe EHF
  "championsleaguewomen": "/logos/handball/leagues/ehf-champions-league.png",
  "europeancup": "/logos/handball/leagues/ehf-european-league.png",
};

/** Chemin du logo d'une ligue, ou null si non couvert (fallback drapeau). */
export function leagueLogo(leagueName: string, country?: string): string | null {
  const n = normHandballName(leagueName);
  if (country) {
    const scoped = LEAGUE_LOGOS[`${n}||${normHandballName(country)}`];
    if (scoped) return scoped;
  }
  return LEAGUE_LOGOS[n] ?? null;
}

/* ─── Logos équipes (clés normalisées ; scan includes comme hockey) ─── */

const TEAM_LOGOS: Record<string, string> = {
  kiel: "/logos/handball/teams/kiel.png",
  flensburg: "/logos/handball/teams/flensburg.png",
  fuchseberlin: "/logos/handball/teams/fuechse-berlin.png",
  goppingen: "/logos/handball/teams/goeppingen.png",
  gummersbach: "/logos/handball/teams/gummersbach.png",
  hsgwetzlar: "/logos/handball/teams/wetzlar.png",
  wetzlar: "/logos/handball/teams/wetzlar.png",
  erlangen: "/logos/handball/teams/erlangen.png",
  lemgo: "/logos/handball/teams/lemgo.png",
  hamburg: "/logos/handball/teams/hamburg.png",
  stuttgart: "/logos/handball/teams/stuttgart.png",
  nantes: "/logos/handball/teams/nantes.png",
  montpellier: "/logos/handball/teams/montpellier.png",
  chartres: "/logos/handball/teams/chartres.png",
  barcelona: "/logos/handball/teams/barcelona.png",
  magdeburg: "/logos/handball/teams/magdeburg.png",
  kielce: "/logos/handball/teams/kielce.png",
  szeged: "/logos/handball/teams/szeged.png",
  aalborg: "/logos/handball/teams/aalborg.png",
  vardar: "/logos/handball/teams/vardar.png",
  celje: "/logos/handball/teams/celje.png",
};

/** Chemin du logo d'une équipe, ou null si non couverte (fallback initiales). */
export function teamLogoUrl(teamName: string): string | null {
  const n = normHandballName(teamName);
  if (!n) return null;
  if (TEAM_LOGOS[n]) return TEAM_LOGOS[n];
  for (const [key, url] of Object.entries(TEAM_LOGOS)) {
    if (key.length >= 4 && (n.includes(key) || key.includes(n))) return url;
  }
  return null;
}

/* ─── Pays des ligues (généré depuis data/flashscore_handball.json) ─── */

// Ligues ambiguës exclues (même nom, plusieurs pays) : Extraliga (CZ/SK),
// 1. Division + 1. Division Women (DK/NO), Superleague (RU/MK).
const LEAGUE_COUNTRY: Record<string, string> = {
  "Asian Games": "ASIA",
  "Asian Games Women": "ASIA",
  "DHB Pokal": "GERMANY",
  "Andebol 1": "PORTUGAL",
  "Danish Cup": "DENMARK",
  "NM Cup": "NORWAY",
  Handbollsligan: "SWEDEN",
  "I Liga": "POLAND",
  NLA: "SWITZERLAND",
  "Serie A": "ITALY",
  Bundesliga: "GERMANY",
  "Elkjop-ligaen": "NORWAY",
  "Elkjop-ligaen Women": "NORWAY",
  "I Liga Women": "POLAND",
  Superlig: "TURKEY",
  "Slovakia Cup": "SLOVAKIA",
  "Champions League Women": "EUROPE",
  "2. Bundesliga": "GERMANY",
  Superliga: "POLAND",
  "Suomen Cup": "FINLAND",
  "European Cup": "EUROPE",
  "1. NLB Liga": "SLOVENIA",
  "Liga ASOBAL": "SPAIN",
  Allsvenskan: "SWEDEN",
  "Schweizer Cup": "SWITZERLAND",
  A1: "GREECE",
  "ARKUS Liga": "SERBIA",
  "WHA Women": "AUSTRIA",
  "Premijer liga": "CROATIA",
  "Herre Handbold Ligaen": "DENMARK",
  Starligue: "FRANCE",
  "NB I": "HUNGARY",
  "1a Divisao Women": "PORTUGAL",
  "Superleague Women": "RUSSIA",
  "Schweizer Cup Women": "SWITZERLAND",
  Meistriliiga: "ESTONIA",
  "Division 1": "BELARUS",
  "1. HRL Women": "CROATIA",
  "Super Handball League": "EUROPE",
  "2. Bundesliga Women": "GERMANY",
  "NB I Women": "HUNGARY",
  "Olis Deild Women": "ICELAND",
  Eredivisie: "NETHERLANDS",
  "Eredivisie Women": "NETHERLANDS",
  "Central League Women": "POLAND",
  "Swedish Cup": "SWEDEN",
  "Swedish Cup Women": "SWEDEN",
  HLA: "AUSTRIA",
  MRHL: "EUROPE",
  "Lietuvos Lyga": "LITHUANIA",
  "AXA League": "LUXEMBOURG",
  "Allsvenskan Women": "SWEDEN",
};

/** Pays d'une ligue (fallback quand le match ne porte pas le pays). */
export function leagueCountry(leagueName: string, known?: string): string {
  if (known) return known;
  return LEAGUE_COUNTRY[leagueName] ?? "";
}

/* ─── Drapeaux (noms flashscore MAJUSCULES → countryFlag) ─── */

const COUNTRY_ISO: Record<string, string> = {
  GERMANY: "DE",
  FRANCE: "FR",
  SPAIN: "ES",
  DENMARK: "DK",
  NORWAY: "NO",
  SWEDEN: "SE",
  HUNGARY: "HU",
  PORTUGAL: "PT",
  ITALY: "IT",
  AUSTRIA: "AT",
  SWITZERLAND: "CH",
  NETHERLANDS: "NL",
  POLAND: "PL",
  "CZECH REPUBLIC": "CZ",
  SLOVAKIA: "SK",
  CROATIA: "HR",
  SLOVENIA: "SI",
  SERBIA: "RS",
  GREECE: "GR",
  LUXEMBOURG: "LU",
  LITHUANIA: "LT",
  ESTONIA: "EE",
  FINLAND: "FI",
  ICELAND: "IS",
  TURKEY: "TR",
  BELARUS: "BY",
  "NORTH MACEDONIA": "MK",
  RUSSIA: "RU",
  EUROPE: "EU",
};

/** Drapeau emoji d'un pays flashscore (EUROPE→🇪🇺, ASIA→🌏). */
export function leagueFlag(country: string | undefined | null): string {
  if (!country) return "";
  const upper = country.toUpperCase();
  if (upper === "ASIA") return "🌏";
  const iso = COUNTRY_ISO[upper];
  if (iso) return countryFlag(iso);
  // Repli : countryFlag gère déjà noms minuscules + codes ISO
  return countryFlag(country);
}
