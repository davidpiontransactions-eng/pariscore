// Monte Carlo saison — projections classement (titre / relégation).
// Phase 1 du doc .context/analyse-projections-classements.md :
//   1.2 λ ajusté xG (blend 70% xG + 30% buts — Torvaney/ESPN)
//   1.3 Home advantage spécifique équipe
//   1.4 Matrices de scores Dixon-Coles (ρ) pour chaque match simulé
// Ref : Peltola (2024) xG-based Monte Carlo, Opta Supercomputer (10k sims).

import { buildDixonColesMatrix } from "./dixon-coles";
import type { ScoreMatrix } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamRating = {
  id: string;
  name: string;
  /** λ marqués/match (buts réels) */
  gf: number;
  /** λ encaissés/match (buts réels) */
  ga: number;
  /** xG pour/match (optionnel — active le blend 70/30) */
  xgFor?: number | null;
  /** xG contre/match (optionnel) */
  xgAgainst?: number | null;
  /** Multiplicateur λ domicile (défaut 1.15) — spécifique équipe */
  homeAdv?: number;
  /** État actuel (si saison en cours) */
  points: number;
  played: number;
  goalDiff: number;
};

export type Fixture = {
  home: string;
  away: string;
};

export type ProjectionOptions = {
  sims?: number;
  /** Corrélation scores bas Dixon-Coles (défaut 0.05) */
  rho?: number;
  /** Poids du xG dans les λ (défaut 0.7 = Torvaney) */
  xgWeight?: number;
  /** Buts/match moyen de la ligue (défaut 1.35 par équipe) */
  leagueAvg?: number;
  /** Nombre de places relégables (défaut 3) */
  relegationSpots?: number;
  /** Graine aléatoire (reproductibilité) */
  seed?: number;
};

export type TeamProjection = {
  id: string;
  name: string;
  /** Points finaux moyens */
  avgPts: number;
  /** Écart-type points finaux */
  stdPts: number;
  /** Rang final moyen */
  avgRank: number;
  /** Probabilités (% 0-100) */
  titleProb: number;
  top4Prob: number;
  relegationProb: number;
};

export type LeagueProjection = {
  projections: TeamProjection[];
  sims: number;
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// RNG déterministe (mulberry32) — reproductibilité des tests
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// λ ajustés — blend 70% xG + 30% buts (item 1.2) + home adv équipe (1.3)
// ---------------------------------------------------------------------------

export function adjustedLambda(
  team: TeamRating,
  opp: TeamRating,
  isHome: boolean,
  opts: { xgWeight?: number; leagueAvg?: number } = {},
): number {
  const w = opts.xgWeight ?? 0.7;
  const avg = opts.leagueAvg ?? 1.35;

  // Attaque : blend xG/buts, shrinké vers la moyenne ligue
  const attackBase = team.gf > 0 ? team.gf : avg;
  const attackXg = team.xgFor != null ? team.xgFor : attackBase;
  const attack = w * attackXg + (1 - w) * attackBase;

  // Défense adverse : blend xGA/GA (plus c'est bas, plus λ est réduit)
  const defBase = opp.ga > 0 ? opp.ga : avg;
  const defXg = opp.xgAgainst != null ? opp.xgAgainst : defBase;
  const defense = w * defXg + (1 - w) * defBase;

  let lambda = (attack * defense) / avg;
  if (isHome) lambda *= team.homeAdv ?? 1.15;
  return Math.max(0.1, lambda);
}

// ---------------------------------------------------------------------------
// Tirage d'un score depuis une matrice Dixon-Coles (inverse CDF)
// ---------------------------------------------------------------------------

function sampleScore(matrix: ScoreMatrix, rng: () => number): { hg: number; ag: number } {
  const u = rng();
  let cum = 0;
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      cum += matrix[h][a];
      if (u <= cum) return { hg: h, ag: a };
    }
  }
  return { hg: 0, ag: 0 };
}

// ---------------------------------------------------------------------------
// Projection Monte Carlo
// ---------------------------------------------------------------------------

export function projectLeagueTable(
  teams: TeamRating[],
  fixtures: Fixture[],
  opts: ProjectionOptions = {},
): LeagueProjection {
  const sims = opts.sims ?? 10_000;
  const rho = opts.rho ?? 0.05;
  const relegSpots = opts.relegationSpots ?? 3;
  const rng = mulberry32(opts.seed ?? 42);

  const byId = new Map(teams.map((t) => [t.id, t]));
  const n = teams.length;

  // Accumulateurs : points par sim, compteur titres/top4/relégation, sommes rangs
  const ptsSum = new Map<string, number>();
  const ptsSqSum = new Map<string, number>();
  const rankSum = new Map<string, number>();
  const titleCnt = new Map<string, number>();
  const top4Cnt = new Map<string, number>();
  const relegCnt = new Map<string, number>();
  for (const t of teams) {
    ptsSum.set(t.id, 0);
    ptsSqSum.set(t.id, 0);
    rankSum.set(t.id, 0);
    titleCnt.set(t.id, 0);
    top4Cnt.set(t.id, 0);
    relegCnt.set(t.id, 0);
  }

  // Pré-calcul des matrices par paire λ (quantification → cache) + tirages
  const matrixCache = new Map<string, ScoreMatrix>();
  const matrixFor = (lh: number, la: number): ScoreMatrix => {
    // Quantification 0.05 → cache compact sans collision visible en projection
    const key = `${lh.toFixed(2)}|${la.toFixed(2)}`;
    let m = matrixCache.get(key);
    if (!m) {
      m = buildDixonColesMatrix(lh, la, rho, 10);
      matrixCache.set(key, m);
    }
    return m;
  };

  const pts = new Map<string, number>();
  for (let sim = 0; sim < sims; sim++) {
    for (const t of teams) pts.set(t.id, t.points);

    for (const f of fixtures) {
      const home = byId.get(f.home);
      const away = byId.get(f.away);
      if (!home || !away) continue;
      const lh = adjustedLambda(home, away, true, opts);
      const la = adjustedLambda(away, home, false, opts);
      const { hg, ag } = sampleScore(matrixFor(lh, la), rng);
      if (hg > ag) pts.set(home.id, pts.get(home.id)! + 3);
      else if (hg < ag) pts.set(away.id, pts.get(away.id)! + 3);
      else {
        pts.set(home.id, pts.get(home.id)! + 1);
        pts.set(away.id, pts.get(away.id)! + 1);
      }
    }

    // Classement de la sim : pts → goalDiff → nom
    const table = teams
      .map((t) => ({ id: t.id, p: pts.get(t.id)!, gd: t.goalDiff }))
      .sort((a, b) => b.p - a.p || b.gd - a.gd || (a.id < b.id ? -1 : 1));

    for (let rank = 0; rank < table.length; rank++) {
      const id = table[rank].id;
      const p = pts.get(id)!;
      ptsSum.set(id, ptsSum.get(id)! + p);
      ptsSqSum.set(id, ptsSqSum.get(id)! + p * p);
      rankSum.set(id, rankSum.get(id)! + rank + 1);
      if (rank === 0) titleCnt.set(id, titleCnt.get(id)! + 1);
      if (rank < 4) top4Cnt.set(id, top4Cnt.get(id)! + 1);
      if (rank >= n - relegSpots) relegCnt.set(id, relegCnt.get(id)! + 1);
    }
  }

  const projections: TeamProjection[] = teams.map((t) => {
    const avgPts = ptsSum.get(t.id)! / sims;
    const variance = Math.max(0, ptsSqSum.get(t.id)! / sims - avgPts * avgPts);
    return {
      id: t.id,
      name: t.name,
      avgPts: Math.round(avgPts * 10) / 10,
      stdPts: Math.round(Math.sqrt(variance) * 10) / 10,
      avgRank: Math.round((rankSum.get(t.id)! / sims) * 10) / 10,
      titleProb: Math.round((titleCnt.get(t.id)! / sims) * 1000) / 10,
      top4Prob: Math.round((top4Cnt.get(t.id)! / sims) * 1000) / 10,
      relegationProb: Math.round((relegCnt.get(t.id)! / sims) * 1000) / 10,
    };
  });

  projections.sort((a, b) => b.avgPts - a.avgPts);
  return { projections, sims, generatedAt: new Date().toISOString() };
}
