/**
 * Moteur de prédiction Rugby4Cast (PariScore).
 *
 * Modèles (inspirés de la recherche publique en analytics sportif) :
 *  1. ELO — rating dynamique par équipe, pondéré par la marge de victoire et
 *     l'avantage du terrain.
 *  2. POISSON / DIXON-COLES — facteurs attaque/défense dérivés des taux de
 *     points récents (pondérés par récence) → score attendu par équipe.
 *  3. GRILLE 2D — grille complète de scores pour probabilités 1X2, scores
 *     exacts, over/under, handicap et bandes de marge.
 *  4. MARQUEURS D'ESSAIS — essais attendus répartis entre finisseurs connus
 *     selon poste + taux historique → cotes "anytime" & "premier essai".
 *  5. MONTE CARLO — simulation de la fin de saison → chances de titre.
 *
 * AMÉLIORATIONS PariScore par rapport au modèle de référence :
 *  - Ajustement "rest days" (fraîcheur/fatigue) sur le score attendu.
 *  - Ajustement H2H (historique des confrontations directes).
 *  - Marché handicap (spread) + bandes de marge dérivés de la grille.
 *  - Verdict à niveaux de confiance explicites.
 */

import type {
  HandicapMarket,
  MarginBand,
  OverUnderLine,
  TopScore,
  VerdictLabel,
} from "./types";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export interface ModelConfig {
  homeAdvantage: number;
  kFactor: number;
  recentWeightDays: number;
  minGames: number;
}

export const DEFAULT_CONFIG: ModelConfig = {
  homeAdvantage: 55,
  kFactor: 30,
  recentWeightDays: 240,
  minGames: 3,
};

/* ------------------------------------------------------------------ */
/* ELO                                                                 */
/* ------------------------------------------------------------------ */

export function expectedElo(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

/** Multiplicateur de marge (FiveThirtyEight) : les larges victoires bougent
 * davantage le rating, mais l'effet s'atténue quand l'écart Elo initial est grand. */
export function marginMultiplier(goalDiff: number, eloDiff: number): number {
  return Math.log(Math.abs(goalDiff) + 1) * (2.2 / (eloDiff * 0.001 + 2.2));
}

export interface EloTeam {
  elo: number;
}

/** Applique un match terminé pour mettre à jour les Elo (mutation en place). */
export function updateElo(
  teams: Map<string, EloTeam>,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  cfg: ModelConfig = DEFAULT_CONFIG
): void {
  const home = teams.get(homeId);
  const away = teams.get(awayId);
  if (!home || !away) return;

  const homeAdj = home.elo + cfg.homeAdvantage;
  const expHome = expectedElo(homeAdj, away.elo);
  const expAway = 1 - expHome;

  const diff = homeScore - awayScore;
  const actualHome = diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  const actualAway = 1 - actualHome;

  const mov = Math.min(2.5, marginMultiplier(diff, homeAdj - away.elo));
  const k = cfg.kFactor * mov;

  home.elo = home.elo + k * (actualHome - expHome);
  away.elo = away.elo + k * (actualAway - expAway);
}

/* ------------------------------------------------------------------ */
/* Facteurs attaque / défense (pondérés par récence)                    */
/* ------------------------------------------------------------------ */

export interface RawGame {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  ageDays: number;
}

function weight(ageDays: number, cfg: ModelConfig): number {
  return Math.pow(0.5, ageDays / cfg.recentWeightDays);
}

export interface TeamFactors {
  teamId: string;
  attack: number;
  defence: number;
  elo: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Calcule les facteurs attaque/défense par équipe depuis les résultats récents
 * pondérés. attack = points marqués pondérés / moyenne ligue ; defence =
 * points encaissés pondérés / moyenne ligue.
 */
export function computeFactors(
  teams: Map<string, EloTeam>,
  games: RawGame[],
  cfg: ModelConfig = DEFAULT_CONFIG
): Map<string, TeamFactors> {
  const acc = new Map<string, { pf: number; pa: number; w: number; n: number }>();
  let totalPf = 0;
  let totalW = 0;

  for (const g of games) {
    const w = weight(g.ageDays, cfg);
    const h = acc.get(g.homeId) ?? { pf: 0, pa: 0, w: 0, n: 0 };
    h.pf += g.homeScore * w;
    h.pa += g.awayScore * w;
    h.w += w;
    h.n += 1;
    acc.set(g.homeId, h);
    const a = acc.get(g.awayId) ?? { pf: 0, pa: 0, w: 0, n: 0 };
    a.pf += g.awayScore * w;
    a.pa += g.homeScore * w;
    a.w += w;
    a.n += 1;
    acc.set(g.awayId, a);
    totalPf += (g.homeScore + g.awayScore) * w;
    totalW += 2 * w;
  }

  const avg = totalW > 0 ? totalPf / totalW : 22;

  const out = new Map<string, TeamFactors>();
  for (const [teamId, row] of acc) {
    const elo = teams.get(teamId)?.elo ?? 1500;
    if (row.n < cfg.minGames) {
      out.set(teamId, { teamId, attack: 1, defence: 1, elo });
      continue;
    }
    const attack = avg > 0 ? row.pf / row.w / avg : 1;
    const defence = avg > 0 ? row.pa / row.w / avg : 1;
    out.set(teamId, {
      teamId,
      attack: clamp(attack, 0.25, 2.5),
      defence: clamp(defence, 0.25, 2.5),
      elo,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fraîcheur (rest days) — AMÉLIORATION PariScore                       */
/* ------------------------------------------------------------------ */

/**
 * Courbe de fraîcheur : le repos court (< 5 j) pénalise, la fenêtre optimale
 * est ~7–14 j, les très longues coupures (> 21 j) coûtent un peu de rythme.
 * Retourne un multiplicateur appliqué au lambda de l'équipe.
 */
export function freshnessMultiplier(restDays: number | null): number {
  if (restDays === null || restDays < 0) return 1;
  if (restDays < 5) return 0.94;
  if (restDays < 7) return 0.98;
  if (restDays <= 14) return 1.03;
  if (restDays <= 21) return 1.0;
  return 0.97;
}

/* ------------------------------------------------------------------ */
/* Modèle de match Poisson (Dixon-Coles)                                */
/* ------------------------------------------------------------------ */

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export interface MatchModelInput {
  homeAttack: number;
  homeDefence: number;
  homeElo: number;
  awayAttack: number;
  awayDefence: number;
  awayElo: number;
  leagueAvgHome: number;
  leagueAvgAway: number;
  neutral: boolean;
  homeAdvantage: number;
  homeRestDays: number | null;
  awayRestDays: number | null;
  h2hHomeWins: number;
  h2hAwayWins: number;
  h2hDraws: number;
}

export interface MatchModelResult {
  lambdaHome: number;
  lambdaAway: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  expectedMargin: number;
  overUnder: OverUnderLine[];
  topScores: TopScore[];
  mostLikelyScore: string;
  handicap: HandicapMarket;
  marginBands: MarginBand[];
  restEdge: number;
  h2hEdge: number;
}

const MAX_SCORE = 70;

/** Ajustement H2H : un historique dominant donne un léger avantage. */
function h2hMultiplier(homeWins: number, awayWins: number): number {
  const total = homeWins + awayWins;
  if (total < 2) return 1;
  const edge = (homeWins - awayWins) / total;
  return 1 + clamp(edge * 0.08, -0.06, 0.06);
}

/**
 * Modèle de match Dixon-Coles :
 *   lambda_home = leagueAvgHome * attack_home * defence_away * homeBoost
 *   lambda_away = leagueAvgAway * attack_away * defence_home
 * homeBoost intègre l'avantage du terrain, la fraîcheur et le H2H.
 */
export function modelMatch(input: MatchModelInput): MatchModelResult {
  const { homeAdvantage, neutral } = input;
  const homeBase = neutral ? 1 : 1 + Math.min(0.28, homeAdvantage / 200);

  const homeFresh = freshnessMultiplier(input.homeRestDays);
  const awayFresh = freshnessMultiplier(input.awayRestDays);
  const h2hHome = h2hMultiplier(input.h2hHomeWins, input.h2hAwayWins);
  const h2hAway = h2hMultiplier(input.h2hAwayWins, input.h2hHomeWins);

  const restEdge = homeFresh - awayFresh;
  const h2hEdge = h2hHome - h2hAway;

  let lambdaHome =
    input.leagueAvgHome * input.homeAttack * input.awayDefence * homeBase * homeFresh * h2hHome;
  let lambdaAway =
    input.leagueAvgAway * input.awayAttack * input.homeDefence * awayFresh * h2hAway;

  const lh = clamp(lambdaHome, 0.2, 65);
  const la = clamp(lambdaAway, 0.2, 65);

  // Grille 2D de probabilités de score.
  const grid: number[][] = [];
  for (let i = 0; i <= MAX_SCORE; i++) {
    grid.push([]);
    for (let j = 0; j <= MAX_SCORE; j++) {
      grid[i].push(poissonPmf(i, lh) * poissonPmf(j, la));
    }
  }

  // Normalisation : la queue de distribution tronquée à MAX_SCORE est
  // réinjectée proportionnellement pour que Σ grille = 1 (sinon les probas
  // 1X2, over/under et handicap sont sous-évaluées sur les gros écarts).
  let gridTotal = 0;
  for (const row of grid) for (const p of row) gridTotal += p;
  if (gridTotal > 0 && gridTotal < 0.999) {
    for (const row of grid) for (let j = 0; j < row.length; j++) row[j] /= gridTotal;
  }

  let win = 0;
  let draw = 0;
  let loss = 0;
  let expHome = 0;
  let expAway = 0;
  for (let i = 0; i <= MAX_SCORE; i++) {
    for (let j = 0; j <= MAX_SCORE; j++) {
      const p = grid[i][j];
      expHome += i * p;
      expAway += j * p;
      if (i > j) win += p;
      else if (i === j) draw += p;
      else loss += p;
    }
  }

  // Over/under — lignes classiques rugby.
  const lines = [41.5, 46.5, 51.5, 56.5, 61.5];
  const overUnder: OverUnderLine[] = lines.map((line) => {
    let over = 0;
    for (let i = 0; i <= MAX_SCORE; i++) {
      for (let j = 0; j <= MAX_SCORE; j++) {
        if (i + j > line) over += grid[i][j];
      }
    }
    return { line, over, under: 1 - over };
  });

  // Scores exacts les plus probables.
  const scores: TopScore[] = [];
  for (let i = 0; i <= MAX_SCORE; i++) {
    for (let j = 0; j <= MAX_SCORE; j++) {
      const p = grid[i][j];
      if (p > 0.0035) scores.push({ home: i, away: j, prob: p });
    }
  }
  scores.sort((a, b) => b.prob - a.prob);
  const topScores = scores.slice(0, 5);
  const mostLikely = topScores[0];

  // Handicap (spread) — ligne arrondie au demi-point proche de la marge attendue.
  const expectedMargin = expHome - expAway;
  const handicapLine = Math.round(expectedMargin) - 0.5;
  let homeCover = 0;
  let awayCover = 0;
  for (let i = 0; i <= MAX_SCORE; i++) {
    for (let j = 0; j <= MAX_SCORE; j++) {
      const margin = i - j;
      if (margin > handicapLine) homeCover += grid[i][j];
      else if (margin < handicapLine) awayCover += grid[i][j];
    }
  }
  const handicap: HandicapMarket = {
    line: handicapLine,
    homeCoverProb: homeCover,
    awayCoverProb: awayCover,
  };

  // Bandes de marge — probabilité de gagner par 1-6, 7-12, 13+ points.
  const bands: { label: string; lo: number; hi: number }[] = [
    { label: "1-6", lo: 1, hi: 6 },
    { label: "7-12", lo: 7, hi: 12 },
    { label: "13+", lo: 13, hi: MAX_SCORE },
  ];
  const marginBands: MarginBand[] = bands.map((b) => {
    let homeProb = 0;
    let awayProb = 0;
    for (let i = 0; i <= MAX_SCORE; i++) {
      for (let j = 0; j <= MAX_SCORE; j++) {
        const m = i - j;
        if (m >= b.lo && m <= b.hi) homeProb += grid[i][j];
        if (-m >= b.lo && -m <= b.hi) awayProb += grid[i][j];
      }
    }
    return { label: b.label, homeProb, awayProb };
  });

  return {
    lambdaHome: lh,
    lambdaAway: la,
    homeWinProb: win,
    drawProb: draw,
    awayWinProb: loss,
    expectedHomeScore: expHome,
    expectedAwayScore: expAway,
    expectedMargin,
    overUnder,
    topScores,
    mostLikelyScore: mostLikely
      ? `${mostLikely.home}-${mostLikely.away}`
      : `${Math.round(expHome)}-${Math.round(expAway)}`,
    handicap,
    marginBands,
    restEdge,
    h2hEdge,
  };
}

/* ------------------------------------------------------------------ */
/* Verdict à niveaux de confiance                                       */
/* ------------------------------------------------------------------ */

export interface Verdict {
  label: VerdictLabel;
  teamId: string | null;
  confidence: number;
}

export function computeVerdict(
  homeWin: number,
  awayWin: number,
  homeId: string,
  awayId: string
): Verdict {
  if (homeWin >= 0.85) return { label: "backing-home", teamId: homeId, confidence: homeWin };
  if (awayWin >= 0.85) return { label: "backing-away", teamId: awayId, confidence: awayWin };
  if (homeWin >= 0.62) return { label: "leaning-home", teamId: homeId, confidence: homeWin };
  if (awayWin >= 0.62) return { label: "leaning-away", teamId: awayId, confidence: awayWin };
  return { label: "toss-up", teamId: null, confidence: Math.max(homeWin, awayWin) };
}

/* ------------------------------------------------------------------ */
/* Marqueurs d'essai                                                    */
/* ------------------------------------------------------------------ */

export interface TryScorerInput {
  name: string;
  teamId: string;
  position: string;
  triesPerGame: number;
  games: number;
}

export interface TryScorerOutput {
  name: string;
  teamId: string;
  position: string;
  expectedTries: number;
  anytimeProb: number;
  firstTryProb: number;
  rank: number;
}

const POSITION_BOOST: Record<string, number> = {
  Wing: 1.7,
  Fullback: 1.25,
  Centre: 1.1,
  Flanker: 0.9,
  "No. 8": 0.8,
  "Scrum-half": 0.55,
  "Fly-half": 0.45,
  Hooker: 0.5,
  Prop: 0.28,
  Lock: 0.35,
};

function positionOf(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes("wing")) return "Wing";
  if (p.includes("fullback") || p.includes("full back")) return "Fullback";
  if (p.includes("centre") || p.includes("center")) return "Centre";
  if (p.includes("flanker") || p.includes("breakaway")) return "Flanker";
  if (p.includes("number eight") || p.includes("no. 8") || p === "8") return "No. 8";
  if (p.includes("scrum") || p.includes("halfback") || p.includes("half back")) return "Scrum-half";
  if (p.includes("fly") || p.includes("stand") || p.includes("five-eighth") || p.includes("five eighth") || p.includes("10")) return "Fly-half";
  if (p.includes("hooker")) return "Hooker";
  if (p.includes("prop")) return "Prop";
  if (p.includes("lock") || p.includes("second row")) return "Lock";
  return "Back";
}

/**
 * Répartit les essais attendus d'une équipe entre ses finisseurs connus.
 * share_i ∝ (triesPerGame_i + 0.02) * positionBoost_i
 */
export function predictTryScorers(
  teamExpectedTries: number,
  playersOfTeam: TryScorerInput[],
  opponentTryRate: number
): TryScorerOutput[] {
  if (playersOfTeam.length === 0) return [];

  const totalTries = Math.max(0.05, teamExpectedTries * Math.max(0.7, opponentTryRate));
  const scored = playersOfTeam.map((p) => {
    const boost = POSITION_BOOST[positionOf(p.position)] ?? 1;
    const base = (p.triesPerGame + 0.02) * boost;
    return { ...p, base };
  });
  const sumBase = scored.reduce((s, p) => s + p.base, 0);
  if (sumBase <= 0) return [];

  return scored
    .map((p) => {
      const share = p.base / sumBase;
      const expectedTries = totalTries * share;
      const anytimeProb = 1 - Math.exp(-expectedTries);
      const teamScoresTry = 1 - Math.exp(-totalTries);
      const firstTryProb = share * teamScoresTry;
      return {
        name: p.name,
        teamId: p.teamId,
        position: positionOf(p.position),
        expectedTries,
        anytimeProb: Math.min(0.92, anytimeProb),
        firstTryProb: Math.min(0.9, firstTryProb),
        rank: 0,
      };
    })
    .sort((a, b) => b.anytimeProb - a.anytimeProb)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}

/* ------------------------------------------------------------------ */
/* Monte Carlo — simulation de saison                                   */
/* ------------------------------------------------------------------ */

export interface SimFixture {
  homeId: string;
  awayId: string;
  lambdaHome: number;
  lambdaAway: number;
}

export interface SimStanding {
  teamId: string;
  points: number;
  pf: number;
  pa: number;
  titleChance: number;
}

function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Simule `n` fois la fin de saison ; retourne classement + chances de titre. */
export function simulateSeason(
  fixtures: SimFixture[],
  currentStandings: Map<string, { points: number; pf: number; pa: number }>,
  allTeamIds: string[],
  n = 2000,
  points: { win: number; draw: number } = { win: 4, draw: 2 }
): Map<string, SimStanding> {
  const titleCounts = new Map<string, number>();
  const lastPoints = new Map<string, { points: number; pf: number; pa: number }>();

  for (let sim = 0; sim < n; sim++) {
    const table = new Map<string, { points: number; pf: number; pa: number }>();
    for (const teamId of allTeamIds) {
      const cur = currentStandings.get(teamId) ?? { points: 0, pf: 0, pa: 0 };
      table.set(teamId, { ...cur });
    }
    for (const f of fixtures) {
      const hs = samplePoisson(f.lambdaHome);
      const as = samplePoisson(f.lambdaAway);
      const h = table.get(f.homeId)!;
      const a = table.get(f.awayId)!;
      h.pf += hs;
      h.pa += as;
      a.pf += as;
      a.pa += hs;
      if (hs > as) h.points += points.win;
      else if (as > hs) a.points += points.win;
      else {
        h.points += points.draw;
        a.points += points.draw;
      }
    }
    const sorted = [...table.entries()].sort((x, y) => {
      if (y[1].points !== x[1].points) return y[1].points - x[1].points;
      return (y[1].pf - y[1].pa) - (x[1].pf - x[1].pa);
    });
    const winner = sorted[0][0];
    titleCounts.set(winner, (titleCounts.get(winner) ?? 0) + 1);
    for (const [teamId, row] of table) lastPoints.set(teamId, row);
  }

  const out = new Map<string, SimStanding>();
  for (const teamId of allTeamIds) {
    const row = lastPoints.get(teamId) ?? { points: 0, pf: 0, pa: 0 };
    out.set(teamId, {
      teamId,
      points: row.points,
      pf: row.pf,
      pa: row.pa,
      titleChance: (titleCounts.get(teamId) ?? 0) / n,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers de formatage                                                 */
/* ------------------------------------------------------------------ */

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
