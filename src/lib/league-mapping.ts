// Mapping ID ligue interne → ID saison BSD
// Source: server.js ALL_LEAGUE_IDS (legacy) + ajouts manuels
export const BSD_LEAGUE_IDS: Record<string, number> = {
  ligue1: 103,
  epl: 8,
  laliga: 564,
  bundesliga: 82,
  seriea: 384,
  primeira_liga: 474,
  eredivisie: 90,
  jupiler: 60,
  super_lig: 322,
  russian_premier: 121,
  championship: 60,
  // À compléter depuis le legacy
};

// Reverse mapping
export const BSD_ID_TO_SLUG: Record<number, string> = {};
for (const [slug, id] of Object.entries(BSD_LEAGUE_IDS)) {
  BSD_ID_TO_SLUG[id] = slug;
}

// Infos ligues (nom, pays, sport)
export const LEAGUE_INFO: Record<string, { name: string; country: string; sport: "football" | "basketball" }> = {
  ligue1: { name: "Ligue 1", country: "France", sport: "football" },
  epl: { name: "Premier League", country: "England", sport: "football" },
  laliga: { name: "La Liga", country: "Spain", sport: "football" },
  bundesliga: { name: "Bundesliga", country: "Germany", sport: "football" },
  seriea: { name: "Serie A", country: "Italy", sport: "football" },
  primeira_liga: { name: "Primeira Liga", country: "Portugal", sport: "football" },
  eredivisie: { name: "Eredivisie", country: "Netherlands", sport: "football" },
  jupiler: { name: "Jupiler Pro League", country: "Belgium", sport: "football" },
  super_lig: { name: "Süper Lig", country: "Turkey", sport: "football" },
  russian_premier: { name: "Russian Premier League", country: "Russia", sport: "football" },
  championship: { name: "Championship", country: "England", sport: "football" },
};
