// Mapping slug interne PariScore → ligues.
//
// Deux identifiants cohabitent (confusion historique documentée ici) :
//  - `BSD_LEAGUE_IDS`   : slug → **vrai** ID ligue BSD (sports.bzzoiro.com),
//    vérifiés en live le 2026-09-08 via GET /api/v2/leagues/?limit=200
//    (avant ce fix, ce tableau contenait les ids `leagues_config.json`
//    = ids API-Football v3 — ex. 2. Bundesliga = 79 alors que BSD id 79
//    = "Club Friendlies").
//  - `CONFIG_LEAGUE_IDS` : slug → id legacy `leagues_config.json`
//    (source server.js, historiquement alignés sur les ids API-Football).
//    Conservés pour compat — NE PAS utiliser comme id BSD.
export const BSD_LEAGUE_IDS: Record<string, number> = {
  ligue1: 6,            // BSD "Ligue 1"
  ligue2: 89,           // BSD "Ligue 2"
  epl: 1,               // BSD "Premier League"
  championship: 12,     // BSD "Championship"
  fa_cup: 39,           // BSD "FA Cup"
  league_cup: 40,       // BSD "Carabao Cup"
  laliga: 3,            // BSD "La Liga"
  laliga2: 38,          // BSD "Segunda División"
  bundesliga: 5,        // BSD "Bundesliga"
  seriea: 4,            // BSD "Serie A"
  coppa_italia: 42,     // BSD "Coppa Italia"
  primeira_liga: 2,     // BSD "Liga Portugal Betclic"
  eredivisie: 10,       // BSD "Eredivisie"
  jupiler: 14,          // BSD "Pro League" (Belgique)
  super_lig: 11,        // BSD "Trendyol Super Lig" (Turquie)
  scot_prem: 13,        // BSD "Scottish Premiership"
  superleague_greece: 24, // BSD "Stoiximan Super League" (Grèce)
  super_league_swiss: 15, // BSD "Super League" (Suisse)
  allsvenskan: 26,      // BSD "Allsvenskan" (Suède)
  liga_1_romania: 23,   // BSD "Superliga" (Roumanie)
  j1_league: 49,        // BSD "J1 League" (Japon)
  k_league1: 50,        // BSD "K League 1" (Corée)
  argentina_primera: 85, // BSD "Liga Profesional de Fútbol"
  colombia_primera: 80, // BSD "Categoría Primera A"
  denmark_superliga: 84, // BSD "Danish Superliga"
  norway_eliteserien: 54, // BSD "Eliteserien" (Norvège)
  saudi_pro_league: 17, // BSD "Saudi Pro League"
};

/**
 * Slugs internes SANS couverture BSD (vérifié 2026-09-08, include_inactive=true).
 * Ne JAMAIS filtrer les matchs BSD avec ces slugs (aucun événement) — utiliser
 * une source alternative (OpenLigaDB pour bundesliga2) ou le mock explicite.
 */
export const BSD_UNCOVERED_LEAGUES: ReadonlySet<string> = new Set([
  "bundesliga2",        // 2. Bundesliga — OpenLigaDB (api.openligadb.de, bl2)
  "serieb",             // Serie B (Italie)
  "russian_premier",    // Russian Premier League
  "scot_champ",         // Scottish Championship
  "challenge_swiss",    // Challenge League (Suisse)
  "superettan",         // Superettan (Suède)
  "first_league_cze",   // First League (Tchéquie)
  "j2_league",          // J2 League (Japon)
  "chile_primera",      // Primera División (Chili)
  "ecuador_serie_a",    // Serie A (Équateur)
  "paraguay_primera",   // Primera División (Paraguay)
  "austria_bundesliga", // Bundesliga (Autriche)
  "australia_a_league", // A-League (Australie)
]);

/** Ids legacy leagues_config.json (≈ ids API-Football). Référence uniquement. */
export const CONFIG_LEAGUE_IDS: Record<string, number> = {
  ligue1: 61,
  ligue2: 62,
  epl: 39,
  championship: 40,
  fa_cup: 45,
  league_cup: 48,
  laliga: 140,
  laliga2: 141,
  bundesliga: 78,
  bundesliga2: 79,
  seriea: 135,
  serieb: 136,
  coppa_italia: 137,
  primeira_liga: 94,
  eredivisie: 88,
  jupiler: 144,
  super_lig: 203,
  russian_premier: 121,
  scot_prem: 188,
  scot_champ: 189,
  superleague_greece: 318,
  super_league_swiss: 207,
  challenge_swiss: 208,
  allsvenskan: 113,
  superettan: 114,
  liga_1_romania: 283,
  first_league_cze: 345,
  j1_league: 98,
  j2_league: 99,
  k_league1: 292,
  argentina_primera: 128,
  colombia_primera: 239,
  chile_primera: 265,
  ecuador_serie_a: 240,
  paraguay_primera: 480,
  austria_bundesliga: 262,
  denmark_superliga: 119,
  australia_a_league: 900,
  norway_eliteserien: 103,
};

// Reverse mapping (consommation par id BSD)
export const BSD_ID_TO_SLUG: Record<number, string> = {};
for (const [slug, id] of Object.entries(BSD_LEAGUE_IDS)) {
  BSD_ID_TO_SLUG[id] = slug;
}

// Infos ligues (nom, pays, sport)
export const LEAGUE_INFO: Record<string, { name: string; country: string; sport: "football" | "basketball" }> = {
  ligue1: { name: "Ligue 1", country: "France", sport: "football" },
  ligue2: { name: "Ligue 2", country: "France", sport: "football" },
  epl: { name: "Premier League", country: "England", sport: "football" },
  championship: { name: "Championship", country: "England", sport: "football" },
  fa_cup: { name: "FA Cup", country: "England", sport: "football" },
  league_cup: { name: "League Cup", country: "England", sport: "football" },
  laliga: { name: "La Liga", country: "Spain", sport: "football" },
  laliga2: { name: "La Liga 2", country: "Spain", sport: "football" },
  bundesliga: { name: "Bundesliga", country: "Germany", sport: "football" },
  bundesliga2: { name: "2. Bundesliga", country: "Germany", sport: "football" },
  seriea: { name: "Serie A", country: "Italy", sport: "football" },
  serieb: { name: "Serie B", country: "Italy", sport: "football" },
  coppa_italia: { name: "Coppa Italia", country: "Italy", sport: "football" },
  primeira_liga: { name: "Primeira Liga", country: "Portugal", sport: "football" },
  eredivisie: { name: "Eredivisie", country: "Netherlands", sport: "football" },
  jupiler: { name: "Jupiler Pro League", country: "Belgium", sport: "football" },
  super_lig: { name: "Süper Lig", country: "Turkey", sport: "football" },
  russian_premier: { name: "Russian Premier League", country: "Russia", sport: "football" },
  scot_prem: { name: "Scottish Premiership", country: "Scotland", sport: "football" },
  scot_champ: { name: "Scottish Championship", country: "Scotland", sport: "football" },
  superleague_greece: { name: "Super League Greece", country: "Greece", sport: "football" },
  super_league_swiss: { name: "Super League", country: "Switzerland", sport: "football" },
  challenge_swiss: { name: "Challenge League", country: "Switzerland", sport: "football" },
  allsvenskan: { name: "Allsvenskan", country: "Sweden", sport: "football" },
  superettan: { name: "Superettan", country: "Sweden", sport: "football" },
  liga_1_romania: { name: "Liga I", country: "Romania", sport: "football" },
  first_league_cze: { name: "First League", country: "Czech Republic", sport: "football" },
  j1_league: { name: "J1 League", country: "Japan", sport: "football" },
  j2_league: { name: "J2 League", country: "Japan", sport: "football" },
  k_league1: { name: "K League 1", country: "South Korea", sport: "football" },
  argentina_primera: { name: "Primera División", country: "Argentina", sport: "football" },
  colombia_primera: { name: "Primera A", country: "Colombia", sport: "football" },
  chile_primera: { name: "Primera División", country: "Chile", sport: "football" },
  ecuador_serie_a: { name: "Serie A", country: "Ecuador", sport: "football" },
  paraguay_primera: { name: "Primera División", country: "Paraguay", sport: "football" },
  austria_bundesliga: { name: "Bundesliga", country: "Austria", sport: "football" },
  denmark_superliga: { name: "Superliga", country: "Denmark", sport: "football" },
  australia_a_league: { name: "A-League", country: "Australia", sport: "football" },
  norway_eliteserien: { name: "Eliteserien", country: "Norway", sport: "football" },
};
