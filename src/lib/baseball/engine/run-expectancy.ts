/**
 * Machine à états des bases — transitions Markoviennes d'une manche.
 * Chaque passage au bâton échantillonne un événement (K, BB, 1B, 2B, 3B, HR,
 * retrait) puis applique les règles d'avancement standard (règles de force
 * pour les buts-sur-balles, avancement conditionnel sur frappes).
 */

import {
  clamp,
  type BatterProfile,
  type PaKind,
  RUN_EXPECTANCY_MATRIX,
} from "./constants";

export const FIRST = 1;
export const SECOND = 2;
export const THIRD = 4;

export type Rng = () => number;

export function runExpectancy(bases: number, outs: number): number {
  return RUN_EXPECTANCY_MATRIX[clamp(bases, 0, 7)][clamp(outs, 0, 2)];
}

export interface HalfInningResult {
  runs: number;
  paCount: number;
  expectedRunsAdded: number;
}

/**
 * Simule une demi-manche complète (3 retraits) et retourne les points marqués.
 * `expectedRunsAdded` = espérance ajoutée par événement selon la matrice
 * d'espérance de points (utilisée pour le calibrage pythagoricien).
 */
export function simulateHalfInning(
  profile: BatterProfile,
  rng: Rng,
): HalfInningResult {
  let bases = 0;
  let outs = 0;
  let runs = 0;
  let paCount = 0;
  let expectedRunsAdded = 0;

  while (outs < 3) {
    paCount += 1;
    const outcome = sampleOutcome(profile, rng);
    const state = applyOutcome(bases, outs, outcome, rng);
    expectedRunsAdded +=
      runExpectancy(state.bases, state.outs) -
      runExpectancy(bases, outs) +
      state.runs;
    bases = state.bases;
    outs = state.outs;
    runs += state.runs;
    if (paCount > 100) break; // garde-fou anti-boucle infinie
  }
  return { runs, paCount, expectedRunsAdded };
}

export function sampleOutcome(profile: BatterProfile, rng: Rng): PaKind {
  const p = rng();
  if (p < profile.pStrikeout) return "strikeout";
  if (p < profile.pStrikeout + profile.pWalk) return "walk";
  if (p < profile.pStrikeout + profile.pWalk + profile.pSingle) return "single";
  if (
    p <
    profile.pStrikeout + profile.pWalk + profile.pSingle + profile.pDouble
  ) {
    return "double";
  }
  if (
    p <
    profile.pStrikeout +
      profile.pWalk +
      profile.pSingle +
      profile.pDouble +
      profile.pTriple
  ) {
    return "triple";
  }
  if (
    p <
    profile.pStrikeout +
      profile.pWalk +
      profile.pSingle +
      profile.pDouble +
      profile.pTriple +
      profile.pHomerun
  ) {
    return "homerun";
  }
  return "groundout";
}

export interface BaseState {
  bases: number;
  outs: number;
  runs: number;
}

/** Applique un événement et retourne le nouvel état des bases. */
export function applyOutcome(
  bases: number,
  outs: number,
  outcome: PaKind,
  rng: Rng,
): BaseState {
  switch (outcome) {
    case "strikeout":
      return { bases, outs: outs + 1, runs: 0 };
    case "walk":
      return applyWalk(bases, outs);
    case "single":
      return applyHit(bases, outs, 1, rng);
    case "double":
      return applyHit(bases, outs, 2, rng);
    case "triple":
      return applyHit(bases, outs, 3, rng);
    case "homerun":
      return applyHit(bases, outs, 4, rng);
    case "groundout":
      return applyGroundout(bases, outs, rng);
    case "doubleplay":
      return applyDoublePlay(bases, outs);
  }
}

function popcount(mask: number): number {
  let n = mask;
  let c = 0;
  while (n > 0) {
    c += n & 1;
    n >>= 1;
  }
  return c;
}

function applyWalk(bases: number, outs: number): BaseState {
  const runner1 = (bases & FIRST) !== 0;
  const runner2 = (bases & SECOND) !== 0;
  const runner3 = (bases & THIRD) !== 0;
  // Règles de force : seuls les coureurs dont toutes les bases derrière eux
  // sont occupées avancent d'un but.
  let newBases = FIRST; // le frappeur prend la 1re base
  let runs = 0;
  if (runner1 && runner2 && runner3) {
    // Bases pleines : 1st→2nd, 2nd→3rd, 3rd marque.
    newBases |= SECOND;
    runs = 1;
  } else if (runner1 && runner2) {
    // 1st forcé → 2nd ; 2nd forcé → 3rd.
    newBases |= SECOND | THIRD;
  } else if (runner1 && runner3) {
    // 1st forcé → 2nd ; 3rd non forcé, reste.
    newBases |= SECOND | THIRD;
  } else if (runner1) {
    newBases |= SECOND;
  } else if (runner2 && runner3) {
    // Aucun coureur forcé : restent en place.
    newBases |= SECOND | THIRD;
  } else if (runner2) {
    newBases |= SECOND;
  } else if (runner3) {
    newBases |= THIRD;
  }
  return { bases: newBases, outs, runs };
}

function applyHit(
  bases: number,
  outs: number,
  totalBases: 1 | 2 | 3 | 4,
  rng: Rng,
): BaseState {
  let runs = 0;
  let newBases = 0;

  if (totalBases === 4) {
    runs = popcount(bases) + 1;
    return { bases: 0, outs, runs };
  }

  const advance = (runner: number): void => {
    // runner : bit index 0..2
    if (runner + totalBases >= 3) {
      runs += 1;
    } else {
      newBases |= 1 << (runner + totalBases);
    }
  };

  if (totalBases === 3) {
    runs = popcount(bases) + 1;
    newBases = THIRD;
    return { bases: newBases, outs, runs };
  }

  if (totalBases === 2) {
    if ((bases & THIRD) !== 0) runs += 1;
    if ((bases & SECOND) !== 0) runs += 1;
    if ((bases & FIRST) !== 0) {
      if (rng() < 0.6) runs += 1;
      else newBases |= THIRD;
    }
    newBases |= SECOND;
    return { bases: newBases, outs, runs };
  }

  // Simple : règles d'avancement conditionnelles standard
  if ((bases & THIRD) !== 0) runs += 1;
  if ((bases & SECOND) !== 0) {
    if (rng() < 0.6) runs += 1;
    else newBases |= THIRD;
  }
  if ((bases & FIRST) !== 0) {
    if ((bases & SECOND) === 0 && rng() < 0.25) newBases |= THIRD;
    else newBases |= SECOND;
  }
  newBases |= FIRST;
  return { bases: newBases, outs, runs };
}

function applyGroundout(bases: number, outs: number, rng: Rng): BaseState {
  // Roulement : possibilité de double jeu si coureur en 1re et < 2 retraits
  if (outs < 2 && (bases & FIRST) !== 0 && rng() < 0.12) {
    return applyDoublePlay(bases, outs);
  }
  return { bases, outs: outs + 1, runs: 0 };
}

function applyDoublePlay(bases: number, outs: number): BaseState {
  // Le coureur le plus avancé est retiré en priorité (lead runner)
  const runnerBits: number[] = [];
  if ((bases & THIRD) !== 0) runnerBits.push(THIRD);
  if ((bases & SECOND) !== 0) runnerBits.push(SECOND);
  if ((bases & FIRST) !== 0) runnerBits.push(FIRST);
  const lead = runnerBits[0] ?? FIRST;
  return { bases: bases & ~lead, outs: Math.min(3, outs + 2), runs: 0 };
}
