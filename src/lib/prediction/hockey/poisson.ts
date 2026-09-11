/**
 * src/lib/prediction/hockey/poisson.ts
 *
 * Modele Poisson pour le hockey sur glace.
 * Adapte du football (poisson.ts) avec les specificites hockey:
 * - Pas de draw en hockey (OT/SO decident) → 1X2 = 1/OT/2
 * - Objectifs moyens plus eleves (~4.5-5.5 par match KHL)
 * - Goals U/O a differentes lignes (4.5, 5.5, 6.5)
 * - Player props (buts, assists) via loi de Poisson par joueur
 */

// ─── Core Poisson ───────────────────────────────────────────────────────────

/** P(X = k) pour une loi de Poisson de moyenne λ */
export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda) || k < 0) return 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda) - Math.log(i);
  return Math.exp(logP);
}

/** P(X > k) — probabilité que les buts depassent le seuil */
export function poissonOver(k: number, lambda: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda)) return 0;
  if (k < 0) return lambda > 0 ? 100 : 0;
  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    cdf += term;
    term *= lambda / (i + 1);
    if (term < 1e-15 || !Number.isFinite(term)) break;
  }
  return (1 - cdf) * 100;
}

/** P(X = k) pour les buts d'un joueur individuel */
export function playerGoalsPMF(lambda: number, k: number): number {
  return poissonPMF(lambda, k);
}

/** P(X >= 1) — probabilite de marquer au moins 1 but */
export function playerScoreAny(lambda: number): number {
  if (lambda <= 0) return 0;
  return (1 - Math.exp(-lambda)) * 100;
}

/** P(X >= k) — probabilite de marquer k buts ou plus */
export function playerGoalsOver(k: number, lambda: number): number {
  return poissonOver(k - 1, lambda);
}

/** P(X = k) pour les assists d'un joueur */
export function playerAssistsPMF(lambda: number, k: number): number {
  return poissonPMF(lambda, k);
}

/** P(X >= 1) — probabilite de faire au moins 1 assist */
export function playerAssistAny(lambda: number): number {
  if (lambda <= 0) return 0;
  return (1 - Math.exp(-lambda)) * 100;
}

// ─── Match Score Matrix ─────────────────────────────────────────────────────

export type HockeyScoreMatrix = number[][];

export function buildHockeyScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  max = 10
): HockeyScoreMatrix {
  const m: HockeyScoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) row.push(poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a));
    m.push(row);
  }
  return m;
}

// ─── Match Markets ──────────────────────────────────────────────────────────

export type HockeyMarkets = {
  /** Probabilites 1X2 classiques (regulation time) */
  homeWin: number;
  draw: number;    // Match nul apres regulation (OT possible)
  awayWin: number;
  /** Probabilites avec OT/SO inclus */
  homeWinOT: number;   // Home gagne (regulation + OT + SO)
  awayWinOT: number;   // Away gagne (regulation + OT + SO)
  /** Double chance */
  homeOrDraw: number;
  awayOrDraw: number;
  /** Goals Over/Under a differentes lignes */
  over45: number;
  under45: number;
  over55: number;
  under55: number;
  over65: number;
  under65: number;
  over75: number;
  under75: number;
  /** Both Teams To Score */
  btts: number;
  /** Top scores probables */
  topScores: { home: number; away: number; prob: number }[];
  /** Resultat exact (regulation) */
  exactScore: string;
  exactScoreProb: number;
};

export function hockeyMarketsFromMatrix(
  matrix: HockeyScoreMatrix,
  homeWinPct: number = 0
): HockeyMarkets {
  const max = matrix.length - 1;
  let regHome = 0, regDraw = 0, regAway = 0;
  let over45 = 0, over55 = 0, over65 = 0, over75 = 0;
  let btts = 0;
  const scores: { home: number; away: number; prob: number }[] = [];

  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = matrix[h][a];
      if (h > a) regHome += p;
      else if (h === a) regDraw += p;
      else regAway += p;

      const total = h + a;
      if (total >= 5) over45 += p;
      if (total >= 6) over55 += p;
      if (total >= 7) over65 += p;
      if (total >= 8) over75 += p;
      if (h >= 1 && a >= 1) btts += p;

      scores.push({ home: h, away: a, prob: p });
    }
  }

  scores.sort((a, b) => b.prob - a.prob);

  // En hockey, le draw en regulation mene a OT/SO
  // Estimation: ~50% des matches nuls en regulation sont gagnes par le home en OT/SO
  const otProb = regDraw;
  const homeWinOT = regHome + otProb * 0.52; // Legere avance home ice
  const awayWinOT = regAway + otProb * 0.48;

  const r = (v: number) => Math.round(v * 100) / 100;

  return {
    homeWin: r(regHome * 100),
    draw: r(regDraw * 100),
    awayWin: r(regAway * 100),
    homeWinOT: r(homeWinOT * 100),
    awayWinOT: r(awayWinOT * 100),
    homeOrDraw: r((regHome + regDraw) * 100),
    awayOrDraw: r((regAway + regDraw) * 100),
    over45: r(over45 * 100),
    under45: r((1 - over45) * 100),
    over55: r(over55 * 100),
    under55: r((1 - over55) * 100),
    over65: r(over65 * 100),
    under65: r((1 - over65) * 100),
    over75: r(over75 * 100),
    under75: r((1 - over75) * 100),
    btts: r(btts * 100),
    topScores: scores.slice(0, 5).map((s) => ({ ...s, prob: r(s.prob * 100) })),
    exactScore: `${scores[0].home}-${scores[0].away}`,
    exactScoreProb: r(scores[0].prob * 100),
  };
}

// ─── Player Props ───────────────────────────────────────────────────────────

export type PlayerProp = {
  name: string;
  team: string;
  position: string;
  goalsLambda: number;    // Buts attendus (λ)
  assistsLambda: number;  // Assists attendus (λ)
  pointsLambda: number;   // Points attendus (λ = G + A)
  probGoal1: number;      // P(>=1 but)
  probGoal2: number;      // P(>=2 buts)
  probAssist1: number;    // P(>=1 assist)
  probPoint1: number;     // P(>=1 point)
};

/**
 * Calcule les player props pour un match.
 * λ = (points par match du joueur) × (force de l'attaque de son equipe / moyenne ligue)
 *
 * @param players - Stats des joueurs (name, team, gp, g, a)
 * @param homeTeam - Nom de l'equipe home
 * @param awayTeam - Nom de l'equipe away
 * @param homeLambda - λ de buts attendu pour l'equipe home
 * @param awayLambda - λ de buts attendu pour l'equipe away
 * @param leagueAvgGoals - Moyenne de buts par match de la ligue (~5.0 KHL)
 */
export function computePlayerProps(
  players: { name: string; team: string; position: string; gp: number; g: number; a: number }[],
  homeTeam: string,
  awayTeam: string,
  homeLambda: number,
  awayLambda: number,
  leagueAvgGoals: number = 5.0
): PlayerProp[] {
  const homePlayers = players.filter((p) => p.team === homeTeam);
  const awayPlayers = players.filter((p) => p.team === awayTeam);

  const allPlayers = [...homePlayers, ...awayPlayers];

  return allPlayers.map((p) => {
    const isHome = p.team === homeTeam;
    const teamLambda = isHome ? homeLambda : awayLambda;

    // Buts par match
    const gpg = p.gp > 0 ? p.g / p.gp : 0;
    // Assists par match
    const apg = p.gp > 0 ? p.a / p.gp : 0;

    // Ajustement: lambda du joueur = (stat par match) × (force attaque team / moyenne ligue)
    const teamStrength = teamLambda / (leagueAvgGoals / 2);
    const goalsLambda = gpg * teamStrength;
    const assistsLambda = apg * teamStrength;
    const pointsLambda = goalsLambda + assistsLambda;

    return {
      name: p.name,
      team: p.team,
      position: p.position,
      goalsLambda: Math.round(goalsLambda * 1000) / 1000,
      assistsLambda: Math.round(assistsLambda * 1000) / 1000,
      pointsLambda: Math.round(pointsLambda * 1000) / 1000,
      probGoal1: r(playerScoreAny(goalsLambda)),
      probGoal2: r(playerGoalsOver(2, goalsLambda)),
      probAssist1: r(playerAssistAny(assistsLambda)),
      probPoint1: r(playerScoreAny(pointsLambda)),
    };
  }).sort((a, b) => b.pointsLambda - a.pointsLambda);
}

// ─── Lambda Estimation ──────────────────────────────────────────────────────

export type TeamStats = {
  name: string;
  gp: number;
  gf: number;   // Buts marqués
  ga: number;   // Buts encaissés
  home?: { gf: number; ga: number; gp: number };
  away?: { gf: number; ga: number; gp: number };
};

/**
 * Estime λ (lambda) pour chaque equipe d'un match.
 *
 * Formule:
 *   λ_home = (home_gf / home_gp + away_ga / away_gp) / 2 × homeAdvantage
 *   λ_away = (away_gf / away_gp + home_ga / home_gp) / 2
 *
 * homeAdvantage ≈ 1.05-1.10 au hockey (5-10% de bonus home)
 */
export function estimateLambdas(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  homeAdvantage: number = 1.07
): { home: number; away: number } {
  // Attaque home (domicile) vs Défense away (extérieur)
  const homeAttHome = homeTeam.home && homeTeam.home.gp > 0
    ? homeTeam.home.gf / homeTeam.home.gp
    : homeTeam.gf / Math.max(homeTeam.gp, 1);
  const awayDefAway = awayTeam.away && awayTeam.away.gp > 0
    ? awayTeam.away.ga / awayTeam.away.gp
    : awayTeam.ga / Math.max(awayTeam.gp, 1);

  // Attaque away (extérieur) vs Défense home (domicile)
  const awayAttAway = awayTeam.away && awayTeam.away.gp > 0
    ? awayTeam.away.gf / awayTeam.away.gp
    : awayTeam.gf / Math.max(awayTeam.gp, 1);
  const homeDefHome = homeTeam.home && homeTeam.home.gp > 0
    ? homeTeam.home.ga / homeTeam.home.gp
    : homeTeam.ga / Math.max(homeTeam.gp, 1);

  // Moyenne defensives de la ligue pour normaliser
  const leagueAvg = 2.5; // ~5 buts total / 2 equipes

  const lambdaHome = ((homeAttHome + awayDefAway) / 2) * homeAdvantage;
  const lambdaAway = (awayAttAway + homeDefHome) / 2;

  return {
    home: Math.max(0.5, Math.min(lambdaHome, 6)),
    away: Math.max(0.5, Math.min(lambdaAway, 6)),
  };
}

// ─── Full Prediction ────────────────────────────────────────────────────────

export type HockeyPrediction = {
  lambda: { home: number; away: number };
  markets: HockeyMarkets;
  playerProps: PlayerProp[];
  model: string;
  confidence: number; // 0-100
};

/**
 * Prediction complete pour un match hockey.
 *
 * @param homeTeam - Stats de l'equipe home
 * @param awayTeam - Stats de l'equipe away
 * @param players - Stats des joueurs disponibles
 * @param homeOdds - Cote 1 (optionnel, pour calibrage)
 * @param awayOdds - Cote 2 (optionnel, pour calibrage)
 */
export function predictHockeyMatch(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  players: { name: string; team: string; position: string; gp: number; g: number; a: number }[],
  homeOdds?: number,
  awayOdds?: number
): HockeyPrediction {
  // 1. Estimer les lambdas
  const lambda = estimateLambdas(homeTeam, awayTeam);

  // 2. Si cotes disponibles, calibrer via implied probabilities
  if (homeOdds && awayOdds && homeOdds > 0 && awayOdds > 0) {
    const impliedHome = 1 / homeOdds;
    const impliedAway = 1 / awayOdds;
    const total = impliedHome + impliedAway;

    // Ajuster lambda proportionnellement aux cotes
    const oddsRatio = impliedHome / impliedAway;
    const lambdaTotal = lambda.home + lambda.away;
    const adjTotal = lambdaTotal * 1.02; // Leger ajustement pour la marge bookmaker

    lambda.home = (oddsRatio / (1 + oddsRatio)) * adjTotal;
    lambda.away = adjTotal - lambda.home;
  }

  // 3. Construire la matrice de scores
  const matrix = buildHockeyScoreMatrix(lambda.home, lambda.away);

  // 4. Extraire les marchés
  const markets = hockeyMarketsFromMatrix(matrix);

  // 5. Player props
  const playerProps = computePlayerProps(
    players,
    homeTeam.name,
    awayTeam.name,
    lambda.home,
    lambda.away,
    (homeTeam.gf + awayTeam.gf) / Math.max(homeTeam.gp + awayTeam.gp, 1) * 2
  );

  // 6. Confiance: basee sur le nombre de matchs joues
  const avgGp = (homeTeam.gp + awayTeam.gp) / 2;
  const confidence = Math.min(95, Math.round(50 + avgGp * 2));

  return {
    lambda,
    markets,
    playerProps: playerProps.slice(0, 10),
    model: homeOdds ? "poisson-odds-calibrated" : "poisson-standalone",
    confidence,
  };
}

// ─── Live Prediction ────────────────────────────────────────────────────────

export type HockeyLivePrediction = {
  minute: number;
  scoreHome: number;
  scoreAway: number;
  markets: HockeyMarkets;
  lambdaRemaining: { home: number; away: number };
  totalGoalsLine: { line: number; overProb: number; underProb: number };
};

/**
 * Prediction live: recalcule λ restant en fonction du score et du temps ecoule.
 *
 * @param homeLambda - Lambda prematch home
 * @param awayLambda - Lambda prematch away
 * @param minute - Minute actuelle (0-60)
 * @param scoreHome - Buts home actuels
 * @param scoreAway - Buts away actuels
 * @param totalRegMinutes - Minutes totales regulation (60 par defaut)
 */
export function predictHockeyLive(
  homeLambda: number,
  awayLambda: number,
  minute: number,
  scoreHome: number,
  scoreAway: number,
  totalRegMinutes: number = 60
): HockeyLivePrediction {
  const remaining = Math.max(0, totalRegMinutes - minute);
  const fraction = remaining / totalRegMinutes;

  // Lambda restant = lambda original × fraction du temps restant
  const lambdaRemaining = {
    home: Math.max(0.1, homeLambda * fraction),
    away: Math.max(0.1, awayLambda * fraction),
  };

  // Recalculer les marchés avec le score actuel + lambda restant
  const matrix = buildHockeyScoreMatrix(
    scoreHome + lambdaRemaining.home,
    scoreAway + lambdaRemaining.away
  );
  const markets = hockeyMarketsFromMatrix(matrix);

  // Total goals line (live)
  const totalCurrent = scoreHome + scoreAway;
  const totalLambda = lambdaRemaining.home + lambdaRemaining.away;
  const over55 = poissonOver(5 - totalCurrent, totalLambda);

  return {
    minute,
    scoreHome,
    scoreAway,
    markets,
    lambdaRemaining,
    totalGoalsLine: {
      line: 5.5,
      overProb: Math.round(over55 * 10) / 10,
      underProb: Math.round((100 - over55) * 10) / 10,
    },
  };
}

function r(v: number): number {
  return Math.round(v * 100) / 100;
}
