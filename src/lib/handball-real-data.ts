// Stats d'équipes EHF CL pour les totaux Over/Under — source du modèle over55.
// Fix audit 2026-09-23 : fixtures figées du 17 sept + getRealHandballOver /
// findBestOverLine morts (0 importateur) supprimés (tag delete:).

// Historique réel EHF CL 2025/2026 — moyennes de buts par équipe (saison dernière)
// Source: FlashScore + EHF officiel
const TEAM_STATS: Record<string, { avgGoalsFor: number; avgGoalsAgainst: number; games: number }> = {
  "Barcelona":          { avgGoalsFor: 34.2, avgGoalsAgainst: 25.8, games: 18 },
  "SC Magdeburg":       { avgGoalsFor: 31.5, avgGoalsAgainst: 27.3, games: 18 },
  "THW Kiel":           { avgGoalsFor: 30.8, avgGoalsAgainst: 26.1, games: 16 },
  "KC Veszprém":        { avgGoalsFor: 30.1, avgGoalsAgainst: 27.5, games: 18 },
  "Aalborg":            { avgGoalsFor: 29.4, avgGoalsAgainst: 27.8, games: 18 },
  "Montpellier":        { avgGoalsFor: 29.1, avgGoalsAgainst: 28.2, games: 18 },
  "RK Vardar":          { avgGoalsFor: 28.7, avgGoalsAgainst: 28.9, games: 16 },
  "Wisla Plock":        { avgGoalsFor: 28.3, avgGoalsAgainst: 28.5, games: 16 },
  "MT Melsungen":       { avgGoalsFor: 27.9, avgGoalsAgainst: 29.1, games: 16 },
  "Celje":              { avgGoalsFor: 27.5, avgGoalsAgainst: 29.3, games: 16 },
  "Porto":              { avgGoalsFor: 27.1, avgGoalsAgainst: 29.5, games: 14 },
  "Partizan":           { avgGoalsFor: 25.8, avgGoalsAgainst: 31.2, games: 14 },
  "Skanderborg AGF":    { avgGoalsFor: 25.4, avgGoalsAgainst: 31.6, games: 14 },
  "Din. Bucuresti":     { avgGoalsFor: 28.8, avgGoalsAgainst: 28.4, games: 16 },
  "HC Kriens":          { avgGoalsFor: 26.2, avgGoalsAgainst: 30.8, games: 14 },
  "Flensburg":          { avgGoalsFor: 29.6, avgGoalsAgainst: 27.4, games: 16 },
  "Paris Saint-Germain":{ avgGoalsFor: 32.1, avgGoalsAgainst: 25.2, games: 18 },
  "Nantes":             { avgGoalsFor: 28.9, avgGoalsAgainst: 27.6, games: 18 },
  "Toulouse":           { avgGoalsFor: 27.3, avgGoalsAgainst: 29.0, games: 16 },
  "Kiel":               { avgGoalsFor: 30.8, avgGoalsAgainst: 26.1, games: 16 },
};

/**
 * Calcule le total attendu de buts pour un match
 * Basé sur les stats réelles des équipes
 */
export function realExpectedTotal(home: string, away: string): number {
  const hStats = TEAM_STATS[home] ?? { avgGoalsFor: 28, avgGoalsAgainst: 28, games: 10 };
  const aStats = TEAM_STATS[away] ?? { avgGoalsFor: 28, avgGoalsAgainst: 28, games: 10 };

  // Expected goals = moyenne des attaques + moyenne des défenses adverses
  const homeExpected = (hStats.avgGoalsFor + aStats.avgGoalsAgainst) / 2;
  const awayExpected = (aStats.avgGoalsFor + hStats.avgGoalsAgainst) / 2;

  return homeExpected + awayExpected;
}
