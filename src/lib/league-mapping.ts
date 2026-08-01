// Mapping ID ligue interne → ID ligue BSD (source: server.js legacy)
// Format: BSD numeric ID → slug interne
export const BSD_LEAGUE_IDS: Record<string, number> = {
  ligue1: 61,           // fra.1
  ligue2: 62,           // fra.2
  epl: 39,              // eng.1
  championship: 40,     // eng.2
  fa_cup: 45,           // eng.fa
  league_cup: 48,       // eng.league_cup
  laliga: 140,          // esp.1
  laliga2: 141,         // esp.2
  bundesliga: 78,       // ger.1
  bundesliga2: 79,      // ger.2
  seriea: 135,          // ita.1
  serieb: 136,          // ita.2
  coppa_italia: 137,    // ita.coppa_italia
  primeira_liga: 94,    // por.1
  eredivisie: 88,       // ned.1
  jupiler: 144,         // bel.1
  super_lig: 203,       // tur.1
  russian_premier: 121, // rus.1 (guess)
  scot_prem: 188,       // sco.1
  scot_champ: 189,      // sco.2
  superleague_greece: 318, // gre.1
  super_league_swiss: 207, // sui.1
  challenge_swiss: 208, // sui.2
  allsvenskan: 113,     // swe.1
  superettan: 114,      // swe.2
  liga_1_romania: 283,  // rou.1
  first_league_cze: 345, // cze.1
  j1_league: 98,        // jpn.1
  j2_league: 99,        // jpn.2
  k_league1: 292,       // kor.1
  argentina_primera: 128, // arg.1
  colombia_primera: 239, // col.1
  chile_primera: 265,   // chi.1
  ecuador_serie_a: 240, // ecu.1
  paraguay_primera: 480, // par.1
  austria_bundesliga: 262, // aut.1
  denmark_superliga: 119, // den.1
  australia_a_league: 900, // aus.1
  norway_eliteserien: 103, // nor.1
};

// Reverse mapping
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
