// T1 — Moteur analytique snooker (mission innovations).
// P_win composite en espace probabiliste [0,1] :
//   P_win = 0.40·Elo + 0.25·Forme + 0.15·H2H + 0.20·Format
// (la formule brute de la mission mélangeait des grandeurs incompatibles —
//  chaque composant est ici une probabilité de victoire, pondérée ensuite.)
// Le facteur format amplifie la certitude du favori sur les formats longs
// via la proba binomiale de gagner un best-of-N à partir d'une proba frame.

import { expectedScore } from "../snooker/elo";

export const PONDERATION = { elo: 0.4, forme: 0.25, h2h: 0.15, format: 0.2 } as const;

/** Shrunk career win% → score de force (même calibration que la route predictions). */
function strength(winPct: number | null, played: number): number {
  const base = winPct ?? 50;
  return Math.max(1, base * (played / (played + 20)));
}

/** Composant Forme : duel des win% carrière (shrinkés), normalisé en proba. */
function probForme(
  a: { winPct?: number | null; matchesPlayed?: number },
  b: { winPct?: number | null; matchesPlayed?: number },
): number {
  const sa = strength(a.winPct ?? null, a.matchesPlayed ?? 0);
  const sb = strength(b.winPct ?? null, b.matchesPlayed ?? 0);
  return sa / (sa + sb);
}

/** Composant H2H : lissage de Laplace (a+1)/(a+b+2) — neutre 0.5 sans historique. */
export function probH2H(winsA = 0, winsB = 0): number {
  if (winsA + winsB === 0) return 0.5;
  return (winsA + 1) / (winsA + winsB + 2);
}

/**
 * Composant Format : proba de gagner un best-of-N depuis une proba frame.
 * La proba frame est l'edge match atténué (un edge match 65 % ≈ edge frame ~57 %) ;
 * les formats longs convergent alors vers la vraie force du favori (0.573 frame
 * → ~61 % en bo9, ~72 % en bo35).
 */
export function probFormat(pBase: number, bestOf: number): number {
  const pFrame = 0.5 + (pBase - 0.5) / 2.2;
  const need = Math.ceil(bestOf / 2);
  const q = 1 - pFrame;
  // Binomiale négative : P(atteindre `need` victoires avant `need` défaites)
  let prob = 0;
  let comb = 1; // C(need-1+l, l) calculé incrémentalement
  for (let l = 0; l < need; l++) {
    if (l > 0) comb = (comb * (need - 1 + l)) / l;
    prob += comb * Math.pow(pFrame, need) * Math.pow(q, l);
  }
  return Math.min(1, Math.max(0, prob));
}

export type CompositeInput = {
  bestOf: number;
  eloA: number;
  eloB: number;
  winPctA?: number | null;
  winPctB?: number | null;
  playedA?: number;
  playedB?: number;
  h2hWinsA?: number;
  h2hWinsB?: number;
};

export type CompositeResult = {
  pElo: number;
  pForme: number;
  pH2H: number;
  pFormat: number;
  pWin: number;
};

/** P_win composite du joueur A contre B (toutes composantes ∈ [0,1]). */
export function compositeWinProb(input: CompositeInput): CompositeResult {
  const pElo = expectedScore(input.eloA, input.eloB);
  const pForme = probForme(
    { winPct: input.winPctA, matchesPlayed: input.playedA },
    { winPct: input.winPctB, matchesPlayed: input.playedB },
  );
  const pH2H = probH2H(input.h2hWinsA, input.h2hWinsB);
  const pBase = PONDERATION.elo * pElo + PONDERATION.forme * pForme + PONDERATION.h2h * pH2H + PONDERATION.format * 0.5;
  const pFormat = probFormat(pBase, input.bestOf);
  // Le format remplace le 0.20 neutre et est re-normalisé sur 1.
  const pWin =
    (PONDERATION.elo * pElo + PONDERATION.forme * pForme + PONDERATION.h2h * pH2H) /
      (PONDERATION.elo + PONDERATION.forme + PONDERATION.h2h) *
      (1 - PONDERATION.format) +
    PONDERATION.format * pFormat;
  return { pElo, pForme, pH2H, pFormat, pWin: Math.min(1, Math.max(0, pWin)) };
}

/** Expected Value : EV = P_win × cote − 1 (par unité mise). */
export function expectedValue(pWin: number, odds: number): number {
  return pWin * odds - 1;
}

/** Confiance 1-5 : proba + volume de données (joueurs peu joués → confiance réduite). */
export function confidenceLevel(pWin: number, playedA: number, playedB: number): number {
  const minPlayed = Math.min(playedA, playedB);
  let conf = pWin >= 0.8 ? 5 : pWin >= 0.72 ? 4 : pWin >= 0.65 ? 3 : 2;
  if (minPlayed < 30) conf = Math.max(1, conf - 2);
  else if (minPlayed < 80) conf = Math.max(1, conf - 1);
  return conf;
}

/** P(A atteint `targetA` frames avant B) — récursion memoïsée pour le live (race to X). */
export function raceToProb(
  winsA: number,
  winsB: number,
  targetA: number,
  targetB: number,
  pFrame: number,
  memo = new Map<string, number>(),
): number {
  if (winsA >= targetA) return 1;
  if (winsB >= targetB) return 0;
  const key = `${winsA}:${winsB}`;
  const hit = memo.get(key);
  if (hit != null) return hit;
  const q = 1 - pFrame;
  const prob = pFrame * raceToProb(winsA + 1, winsB, targetA, targetB, pFrame, memo) +
    q * raceToProb(winsA, winsB + 1, targetA, targetB, pFrame, memo);
  memo.set(key, prob);
  return prob;
}

/**
 * P(A gagne le match ET avec une marge ≥ minMargin) — pari handicap frame
 * (ex: favori −1.5 → minMargin 2). Récursion memoïsée sur les frames.
 */
export function winByMarginProb(
  winsA: number,
  winsB: number,
  need: number,
  minMargin: number,
  pFrame: number,
  memo = new Map<string, number>(),
): number {
  if (winsA >= need) return winsA - winsB >= minMargin ? 1 : 0;
  if (winsB >= need) return 0;
  const key = `${winsA}:${winsB}`;
  const hit = memo.get(key);
  if (hit != null) return hit;
  const q = 1 - pFrame;
  const prob =
    pFrame * winByMarginProb(winsA + 1, winsB, need, minMargin, pFrame, memo) +
    q * winByMarginProb(winsA, winsB + 1, need, minMargin, pFrame, memo);
  memo.set(key, prob);
  return prob;
}

/** E[frames totales] d'un best-of-N en cours (winsA/winsB déjà joués) — utile au live. */
export function expectedTotalFrames(
  winsA: number,
  winsB: number,
  need: number,
  pFrame: number,
  memo = new Map<string, number>(),
): number {
  if (winsA >= need || winsB >= need) return winsA + winsB;
  const key = `${winsA}:${winsB}`;
  const hit = memo.get(key);
  if (hit != null) return hit;
  const q = 1 - pFrame;
  const e =
    pFrame * expectedTotalFrames(winsA + 1, winsB, need, pFrame, memo) +
    q * expectedTotalFrames(winsA, winsB + 1, need, pFrame, memo) +
    1;
  memo.set(key, e);
  return e;
}

/** P(total frames > line) — pari Over/Under (line X.5). Forme fermée par complément. */
export function probTotalFramesOver(bestOf: number, pFrame: number, line: number): number {
  const need = Math.ceil(bestOf / 2);
  const q = 1 - pFrame;
  let cum = 0;
  let comb = 1; // C(t-1, need-1) incrémental
  for (let t = need; t <= Math.floor(line); t++) {
    if (t > need) comb = (comb * (t - 1)) / (t - need);
    // Fin en t frames : A gagne `need` (dernière frame incluse) ou B gagne `need`.
    cum += comb * Math.pow(pFrame, need) * Math.pow(q, t - need);
    cum += comb * Math.pow(q, need) * Math.pow(pFrame, t - need);
  }
  return Math.min(1, Math.max(0, 1 - cum));
}

/**
 * Génère les 3 paris pre-match d'un match (mission T3) :
 * 1. Handicap frame sécurisé (favori −X.5 si P_win ≥ 70 %)
 * 2. Total frames Over/Under (orienté par les decider rates)
 * 3. Century occurrence (si century rate combiné suffisant)
 */
export function buildPreMatchBets(args: {
  bestOf: number;
  pWin: number;
  deciderA?: number | null;
  deciderB?: number | null;
  centuryA?: number | null;
  centuryB?: number | null;
  playedA?: number;
  playedB?: number;
}): Array<{ type: string; label: string; prob: number }> {
  const bets: Array<{ type: string; label: string; prob: number }> = [];
  const need = Math.ceil(args.bestOf / 2);
  const pFrame = 0.5 + (args.pWin - 0.5) / 2.2;

  // 1) Handicap : le favori (P_win ≥ 70 %) démarque −1.5 frames.
  if (args.pWin >= 0.7) {
    bets.push({
      type: "handicap",
      label: `Favori −1.5 frames`,
      prob: winByMarginProb(0, 0, need, 2, pFrame),
    });
  }

  // 2) Total frames : decider rates élevés → match serré → Over ; sinon Under.
  const dA = (args.deciderA ?? 50) / 100;
  const dB = (args.deciderB ?? 50) / 100;
  const closeness = (dA + dB) / 2; // >0.5 → va au décider
  const eTotal = expectedTotalFrames(0, 0, need, pFrame);
  const overLine = args.bestOf - 0.5; // bo9 → Over 8.5
  if (closeness >= 0.55) {
    bets.push({ type: "total_frames", label: `Over ${overLine} frames`, prob: probTotalFramesOver(args.bestOf, pFrame, overLine) });
  } else {
    bets.push({ type: "total_frames", label: `Under ${overLine} frames`, prob: 1 - probTotalFramesOver(args.bestOf, pFrame, overLine) });
  }

  // 3) Century : occurrence si les deux rates cumulés dépassent 0.25/match.
  const cA = (args.centuryA ?? 0) / 100; // centuryRate stocké en %
  const cB = (args.centuryB ?? 0) / 100;
  if (cA + cB > 0.25) {
    // Poisson approx : P(≥1 century) = 1 − e^−λ, λ = taux combiné × E[frames]
    const lambda = (cA + cB) * eTotal;
    bets.push({ type: "century", label: "Au moins un century", prob: 1 - Math.exp(-lambda) });
  }

  return bets;
}