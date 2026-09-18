/**
 * Moteur de prédiction Pro D2 — Poisson simplifié basé sur le classement.
 *
 * Pas de données ESPN pour Pro D2, donc pas d'Elo dynamique.
 * Utilise : PPG (points per game), offensive strength (PF/PG),
 * defensive strength (PA/PG), et avantage domicile Pro D2 (~58%).
 *
 * Modèle : Poisson 2D (grille 40×40).
 */

// Poisson PMF: P(X=k) = (lambda^k * e^(-lambda)) / k!
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

interface ProD2Team {
  name: string;
  ppg: number; // points per game
  offensiveStrength: number; // PF/PG / leagueAvg
  defensiveStrength: number; // PA/PG / leagueAvg (lower = better)
  gamesPlayed: number;
}

interface ProD2Prediction {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  expectedMargin: number;
  mostLikelyScore: string;
  verdict: string;
  confidence: number;
}

/** Avantage domicile Pro D2 — basé sur les données historiques (~58%). */
const HOME_ADVANTAGE = 1.08;
/** Moyenne de points par match en Pro D2 (historique). */
const LEAGUE_AVG_POINTS = 48;

/**
 * Calcule les forces offensives/défensives à partir du classement.
 * Pour les équipes absentes du top5, utilise la moyenne de la ligue.
 */
export function buildProD2Teams(
  standings: { name: string; points: number; played: number; pointsFor: number; pointsAgainst: number }[],
  allTeamNames?: string[]
): ProD2Team[] {
  // Filter teams with games played > 0
  const withData = standings.filter((t) => t.played > 0);
  if (withData.length === 0) {
    // Pas de données : créer des profils par défaut pour toutes les équipes
    return (allTeamNames || []).map((name) => ({
      name,
      ppg: LEAGUE_AVG_POINTS / 2,
      offensiveStrength: 1.0,
      defensiveStrength: 1.0,
      gamesPlayed: 0,
    }));
  }

  // Moyenne ligue par équipe — garde-fou : le widget court Idalgo ne fournit
  // pas toujours PF/PA (0/0 = NaN) → repli sur la moyenne historique.
  const avgRaw =
    withData.reduce((sum, t) => sum + (t.pointsFor + t.pointsAgainst) / t.played, 0) /
    withData.length /
    2;
  const safeAvg =
    Number.isFinite(avgRaw) && avgRaw > 0 ? avgRaw : LEAGUE_AVG_POINTS / 2;

  const teams: ProD2Team[] = withData.map((t) => {
    const ppg = t.pointsFor / t.played;
    const papg = t.pointsAgainst / t.played;
    return {
      name: t.name,
      ppg: Number.isFinite(ppg) ? ppg : safeAvg,
      // Donnée absente (0) = force moyenne, jamais 0 ni NaN.
      offensiveStrength: ppg > 0 ? ppg / safeAvg : 1.0,
      defensiveStrength: papg > 0 ? papg / safeAvg : 1.0,
      gamesPlayed: t.played,
    };
  });

  // Ajouter les équipes absentes du classement avec des forces moyennes
  if (allTeamNames) {
    const knownNames = new Set(teams.map((t) => t.name));
    for (const name of allTeamNames) {
      if (!knownNames.has(name)) {
        teams.push({
          name,
          ppg: LEAGUE_AVG_POINTS / 2,
          offensiveStrength: 1.0,
          defensiveStrength: 1.0,
          gamesPlayed: 0,
        });
      }
    }
  }

  return teams;
}

/**
 * Calcule la prédiction Poisson pour un match Pro D2.
 */
export function predictProD2Match(
  homeTeam: ProD2Team,
  awayTeam: ProD2Team
): ProD2Prediction {
  // Lambda = leagueAvg × offensiveStrength × opponentDefensiveStrength × homeBoost
  const leagueAvgPerTeam = LEAGUE_AVG_POINTS / 2; // ~24
  const lambdaHome =
    leagueAvgPerTeam * homeTeam.offensiveStrength * awayTeam.defensiveStrength * HOME_ADVANTAGE;
  const lambdaAway =
    leagueAvgPerTeam * awayTeam.offensiveStrength * homeTeam.defensiveStrength;

  // Poisson grid (40×40)
  const gridSize = 40;
  const grid: number[][] = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let bestProb = 0;
  let bestScore = { home: 0, away: 0 };

  for (let i = 0; i < gridSize; i++) {
    grid[i] = [];
    for (let j = 0; j < gridSize; j++) {
      const prob = poissonPmf(i, lambdaHome) * poissonPmf(j, lambdaAway);
      grid[i][j] = prob;
      if (i > j) homeWin += prob;
      else if (i === j) draw += prob;
      else awayWin += prob;
      if (prob > bestProb) {
        bestProb = prob;
        bestScore = { home: i, away: j };
      }
    }
  }

  const verdict =
    homeWin >= 0.65
      ? "backing-home"
      : awayWin >= 0.65
      ? "backing-away"
      : homeWin >= 0.55
      ? "leaning-home"
      : awayWin >= 0.55
      ? "leaning-away"
      : "toss-up";

  const confidence = Math.max(homeWin, awayWin);

  return {
    homeWinProb: Math.round(homeWin * 1000) / 1000,
    drawProb: Math.round(draw * 1000) / 1000,
    awayWinProb: Math.round(awayWin * 1000) / 1000,
    expectedHomeScore: Math.round(lambdaHome * 10) / 10,
    expectedAwayScore: Math.round(lambdaAway * 10) / 10,
    expectedMargin: Math.round((lambdaHome - lambdaAway) * 10) / 10,
    mostLikelyScore: `${bestScore.home}-${bestScore.away}`,
    verdict,
    confidence: Math.round(confidence * 100),
  };
}

/**
 * Génère les prédictions pour tous les matchs Pro D2 programmés.
 */
export function predictProD2Fixtures(
  standings: { name: string; points: number; played: number; pointsFor: number; pointsAgainst: number }[],
  fixtures: { home: string; away: string }[]
): Map<string, ProD2Prediction> {
  const teams = buildProD2Teams(standings);
  const teamMap = new Map(teams.map((t) => [t.name, t]));
  const predictions = new Map<string, ProD2Prediction>();

  for (const fixture of fixtures) {
    const home = teamMap.get(fixture.home);
    const away = teamMap.get(fixture.away);
    if (!home || !away) continue;

    const key = `${fixture.home}-${fixture.away}`;
    predictions.set(key, predictProD2Match(home, away));
  }

  return predictions;
}
