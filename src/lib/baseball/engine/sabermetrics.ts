/**
 * Sabermetrics Engine — Modèles avancés pour le baseball
 *
 * Modèles:
 * 1. Pythagorean Expectation (existant, refactorisé)
 * 2. Starting Pitcher Matchup Rating
 * 3. PowerScore Baseball
 * 4. Value Bet Detection
 *
 * Sources:
 * - Pythagorean: Bill James (1980)
 * - FIP: Tango, Lichtman, Dolphin (2006)
 * - Pitching+: MLB Advanced Media
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TeamStats {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  homeRecord?: { wins: number; losses: number };
  awayRecord?: { wins: number; losses: number };
  last10?: { wins: number; losses: number };
  streak?: { type: "W" | "L"; count: number };
}

export interface PitcherStats {
  name: string;
  team: string;
  era: number;
  whip: number;
  kPer9: number;
  ip: number;
  wins: number;
  losses: number;
  fip?: number;
  avg?: number;
  hrPer9?: number;
  bbPer9?: number;
}

export interface MatchupResult {
  model: string;
  probHome: number;
  probAway: number;
  expectedRuns: number;
  confidence: number;
  valueBet?: {
    side: "home" | "away";
    modelProb: number;
    marketOdds: number;
    edge: number;
    kelly: number;
    recommendation: string;
  };
}

// ─── Pythagorean Expectation ────────────────────────────────────────────────

/**
 * Calcul de l'expectation pythagoricienne de victoire.
 * Formule: Win% = RS^x / (RS^x + RA^x)
 * x = 1.83 (exposant optimal pour le baseball moderne)
 */
export function pythagoreanExpectation(
  runsScored: number,
  runsAllowed: number,
  exponent: number = 1.83
): number {
  if (runsScored === 0 && runsAllowed === 0) return 0.5;
  const rsx = Math.pow(runsScored, exponent);
  const rax = Math.pow(runsAllowed, exponent);
  return rsx / (rsx + rax);
}

/**
 * Pythagorean expectation basée sur les records W/L.
 * Plus précis que RS/RA sur petite sample.
 */
export function pythagoreanFromRecord(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
}

// ─── Starting Pitcher Matchup Rating ────────────────────────────────────────

/**
 * Compare les lanceurs partants et retourne un avantage.
 * Formule: advantage = (ERA_away - ERA_home) / 6.00 + (FIP_diff / 6.00)
 *
 * ERA 2.00 vs ERA 4.00 → advantage = +0.333 (fort favori home)
 * ERA 3.50 vs ERA 3.50 → advantage = 0 (neutre)
 */
export function pitcherMatchupRating(
  homeStarter: PitcherStats | null,
  awayStarter: PitcherStats | null
): { advantage: "home" | "away" | "neutral"; rating: number; description: string } {
  if (!homeStarter || !awayStarter) {
    return { advantage: "neutral", rating: 0, description: "Lanceur inconnu" };
  }

  const eraAdvantage = (awayStarter.era - homeStarter.era) / 6.0;

  const fipAdv = homeStarter.fip && awayStarter.fip
    ? (awayStarter.fip - homeStarter.fip) / 6.0
    : 0;

  const whipAdv = (awayStarter.whip - homeStarter.whip) / 2.0;

  const kAdv = (homeStarter.kPer9 - awayStarter.kPer9) / 12.0;

  const rating = Math.max(-1, Math.min(1, eraAdvantage * 0.4 + fipAdv * 0.3 + whipAdv * 0.2 + kAdv * 0.1));

  let advantage: "home" | "away" | "neutral" = "neutral";
  if (rating > 0.05) advantage = "home";
  else if (rating < -0.05) advantage = "away";

  const description = rating > 0.15
    ? `${homeStarter.name} domine (${homeStarter.era} ERA vs ${awayStarter.era})`
    : rating < -0.15
    ? `${awayStarter.name} domine (${awayStarter.era} ERA vs ${homeStarter.era})`
    : `Matchup équilibré (${homeStarter.era} vs ${awayStarter.era} ERA)`;

  return { advantage, rating, description };
}

// ─── PowerScore Baseball ────────────────────────────────────────────────────

/**
 * PowerScore combine plusieurs métriques pour un score de force global.
 * Formule: PS = (RS/G * 0.3) + (RA/G * -0.2) + (Win% * 0.3) + (Streak * 0.1) + (Form * 0.1)
 *
 * RS/G = Runs Scored par Game
 * RA/G = Runs Allowed par Game
 * Win% = Victoires / Total
 * Streak = 0.5 si W streak, -0.5 si L streak (normalisé)
 * Form = Win% sur les 10 derniers
 */
export function powerScore(team: TeamStats): number {
  const games = team.wins + team.losses;
  if (games === 0) return 0;

  const rsPerGame = team.runsScored / games;
  const raPerGame = team.runsAllowed / games;
  const winPct = team.wins / games;

  const streakFactor = team.streak
    ? (team.streak.type === "W" ? 0.5 : -0.5) * Math.min(team.streak.count, 5) / 5
    : 0;

  const formFactor = team.last10
    ? (team.last10.wins / (team.last10.wins + team.last10.losses) - 0.5)
    : 0;

  const score = (rsPerGame * 0.3) + (-raPerGame * 0.2) + (winPct * 0.3) + (streakFactor * 0.1) + (formFactor * 0.1);
  return Math.round(score * 1000) / 1000;
}

/**
 * Compare le PowerScore de deux équipes.
 */
export function powerScoreComparison(
  home: TeamStats,
  away: TeamStats
): { homeScore: number; awayScore: number; diff: number; favorite: "home" | "away" | "neutral" } {
  const homeScore = powerScore(home);
  const awayScore = powerScore(away);
  const diff = homeScore - awayScore;

  let favorite: "home" | "away" | "neutral" = "neutral";
  if (diff > 0.02) favorite = "home";
  else if (diff < -0.02) favorite = "away";

  return { homeScore, awayScore, diff, favorite };
}

// ─── Expected Runs ──────────────────────────────────────────────────────────

/**
 * Calcule les runs attendues basées sur les lanceurs et la ligne de course.
 * Utilise les averages de la ligue + ajustements lanceur.
 */
export function expectedRuns(
  homeStarter: PitcherStats | null,
  awayStarter: PitcherStats | null,
  leagueAvgERA: number = 4.00
): { home: number; away: number; total: number } {
  const homeERA = homeStarter?.era ?? leagueAvgERA;
  const awayERA = awayStarter?.era ?? leagueAvgERA;

  const leagueAvgRunsPerGame = leagueAvgERA * 0.9;

  const homeExpected = leagueAvgRunsPerGame * (leagueAvgERA / homeERA);
  const awayExpected = leagueAvgRunsPerGame * (leagueAvgERA / awayERA);

  return {
    home: Math.round(homeExpected * 100) / 100,
    away: Math.round(awayExpected * 100) / 100,
    total: Math.round((homeExpected + awayExpected) * 100) / 100,
  };
}

// ─── Value Bet Detection ────────────────────────────────────────────────────

/**
 * Détecte les value bets en comparant le modèle aux cotes du marché.
 * Formule: Edge = ModelProb - (1 / DecimalOdds)
 * Kelly: f* = (bp - q) / b où b = odds - 1, p = modelProb, q = 1 - p
 */
export function detectValueBet(
  modelProb: number,
  marketOdds: number,
  minEdge: number = 0.03,
  confidence: number = 3
): {
  hasValue: boolean;
  edge: number;
  kelly: number;
  recommendation: string;
} | null {
  if (marketOdds <= 1 || modelProb <= 0) return null;

  const marketProb = 1 / marketOdds;
  const edge = modelProb - marketProb;

  if (edge < minEdge) return null;

  const b = marketOdds - 1;
  const q = 1 - modelProb;
  const kelly = Math.max(0, (b * modelProb - q) / b);

  let recommendation: string;
  if (edge > 0.10) recommendation = "STRONG VALUE — mise élevée";
  else if (edge > 0.06) recommendation = "VALUE — mise modérée";
  else recommendation = "SLIGHT VALUE — petite mise";

  return {
    hasValue: true,
    edge: Math.round(edge * 10000) / 100,
    kelly: Math.round(kelly * 10000) / 100,
    recommendation,
  };
}

// ─── Full Matchup Prediction ────────────────────────────────────────────────

/**
 * Prédiction complète d'un match de baseball.
 * Combine Pythagorean + Pitcher Matchup + PowerScore + Value Bet detection.
 */
export function predictBaseballMatch(
  home: TeamStats,
  away: TeamStats,
  homeStarter: PitcherStats | null,
  awayStarter: PitcherStats | null,
  homeOdds?: number,
  awayOdds?: number
): MatchupResult {
  const pythHome = pythagoreanExpectation(home.runsScored, home.runsAllowed);
  const pythAway = pythagoreanExpectation(away.runsScored, away.runsAllowed);

  const pitcherAdv = pitcherMatchupRating(homeStarter, awayStarter);

  const psComp = powerScoreComparison(home, away);

  const expRuns = expectedRuns(homeStarter, awayStarter);

  const homeFieldAdv = 0.04;

  let probHome = (pythHome * 0.40)
    + ((pitcherAdv.rating + 1) / 2 * 0.25)
    + ((psComp.diff + 0.2) / 0.4 * 0.20)
    + homeFieldAdv;

  probHome = Math.max(0.15, Math.min(0.85, probHome));
  const probAway = 1 - probHome;

  const absDiff = Math.abs(probHome - 0.5);
  const confidence = absDiff > 0.20 ? 5 : absDiff > 0.15 ? 4 : absDiff > 0.10 ? 3 : absDiff > 0.05 ? 2 : 1;

  let valueBet: MatchupResult["valueBet"];

  if (homeOdds) {
    const vb = detectValueBet(probHome, homeOdds, 0.03, confidence);
    if (vb?.hasValue) {
      valueBet = {
        side: "home",
        modelProb: probHome,
        marketOdds: homeOdds,
        edge: vb.edge,
        kelly: vb.kelly,
        recommendation: vb.recommendation,
      };
    }
  }
  if (!valueBet && awayOdds) {
    const vb = detectValueBet(probAway, awayOdds, 0.03, confidence);
    if (vb?.hasValue) {
      valueBet = {
        side: "away",
        modelProb: probAway,
        marketOdds: awayOdds,
        edge: vb.edge,
        kelly: vb.kelly,
        recommendation: vb.recommendation,
      };
    }
  }

  return {
    model: "sabermetrics+elo",
    probHome: Math.round(probHome * 10000) / 10000,
    probAway: Math.round(probAway * 10000) / 10000,
    expectedRuns: expRuns.total,
    confidence,
    valueBet,
  };
}
