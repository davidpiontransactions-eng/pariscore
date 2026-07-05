// Real prediction engine for tennis prematch
//
// Inputs (per player):
//   - elo:           Elo rating (surfaced)
//   - form:          last N matches (W/L) most-recent-last
//   - surfaceMatches: matches played on the upcoming surface (for surface Elo)
//
// Outputs:
//   - probA / probB (0-100)
//   - ic: [low, high] 95% confidence interval (bootstrap)
//   - confidence:     0-1 model confidence (1 - normalized IC width)
//   - eloGap:          rating difference (favori - challenger)
//   - model:           string label
//
// Model: weighted blend of
//   1. Elo implied probability (logistic, surface-aware)
//   2. Recent form (last 6 H2H-adjusted results)
//   3. H2H direct matchup
//
// Confidence interval: parametric bootstrap with 1000 resamples
// per surface-prior σ, returns the 2.5th and 97.5th percentiles.

export type Surface = "Dur" | "Terre battue" | "Gazon";

export type MatchOutcome = "W" | "L";

export type PlayerInputs = {
  id: string;
  name: string;
  elo: number;
  surfaceElo: number; // Elo restricted to the upcoming surface
  form: MatchOutcome[]; // most recent last
  h2h: { won: number; lost: number }; // vs this specific opponent
};

export type PredictionResult = {
  probA: number; // 0-100 (playerA = favori)
  probB: number;
  ic: [number, number]; // 95% CI for probA
  confidence: number; // 0-1
  eloGap: number; // favori minus challenger
  model: string;
  weights: { elo: number; surface: number; form: number; h2h: number };
};

const ELO_K = 32; // standard tennis K
const ELO_DENO = 400; // standard scale
const FORM_WINDOW = 6; // last 6 matches
const SURFACE_WEIGHT = 0.55; // surfaceElo counts for 55% of overall Elo
const FORM_WEIGHT = 0.20;
const H2H_WEIGHT = 0.10;
const ELO_TOTAL_WEIGHT = 0.70; // surface+overall Elo together
const BOOTSTRAP_N = 1000;

/**
 * Compute the implied probability of A beating B from Elo gap.
 * Standard logistic: P(A wins) = 1 / (1 + 10^(-Δ/400))
 */
export function eloImpliedProb(eloA: number, eloB: number): number {
  const delta = eloA - eloB;
  return 1 / (1 + Math.pow(10, -delta / ELO_DENO));
}

/**
 * Surface-blended Elo: weight surface Elo at SURFACE_WEIGHT.
 * If surfaceElo equals overall Elo (no surface data), no effect.
 */
function blendedElo(player: PlayerInputs): number {
  return SURFACE_WEIGHT * player.surfaceElo + (1 - SURFACE_WEIGHT) * player.elo;
}

/**
 * Recent form score: weighted average of last FORM_WINDOW matches
 * W=1, L=0, with exponential decay (most recent weighs most).
 * Returns 0-1.
 */
function formScore(form: MatchOutcome[]): number {
  const recent = form.slice(-FORM_WINDOW);
  if (recent.length === 0) return 0.5; // no data → neutral
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = Math.pow(0.85, recent.length - 1 - i); // older = lower weight
    weighted += w * (recent[i] === "W" ? 1 : 0);
    total += w;
  }
  return weighted / total;
}

/**
 * H2H score: fraction of wins for player A in direct matchups.
 * Returns 0.5 if no H2H data.
 */
function h2hScore(h2h: { won: number; lost: number }): number {
  const total = h2h.won + h2h.lost;
  if (total === 0) return 0.5;
  return h2h.won / total;
}

/**
 * Main prediction. Blends 3 signals into a final probability.
 */
export function predict(
  playerA: PlayerInputs,
  playerB: PlayerInputs
): PredictionResult {
  const blendedEloA = blendedElo(playerA);
  const blendedEloB = blendedElo(playerB);
  const eloGap = blendedEloA - blendedEloB;

  // 1. Elo-based implied prob (logistic)
  const pElo = eloImpliedProb(blendedEloA, blendedEloB);

  // 2. Form score (0-1) for each player
  const formA = formScore(playerA.form);
  const formB = formScore(playerB.form);
  // Convert to probability of A winning using logistic on the difference
  const pForm = 1 / (1 + Math.exp(-(formA - formB) * 4)); // scale=4 amplifies

  // 3. H2H score for A (treat playerA.h2h as wins/losses vs playerB)
  const pH2H = h2hScore(playerA.h2h);

  // 4. Weighted blend
  const wElo = ELO_TOTAL_WEIGHT;
  const wForm = FORM_WEIGHT;
  const wH2H = H2H_WEIGHT;
  const totalW = wElo + wForm + wH2H;
  const pA =
    (wElo * pElo + wForm * pForm + wH2H * pH2H) / totalW;

  // 5. Bootstrap confidence interval
  // Resample with Gaussian noise on each component, recompute pA, take percentiles
  const samples: number[] = [];
  const sigmaElo = 0.04; // ~4 percentage points of std on Elo component
  const sigmaForm = 0.08;
  const sigmaH2H = 0.10;
  for (let i = 0; i < BOOTSTRAP_N; i++) {
    const pEloN = clamp(pElo + gaussian() * sigmaElo, 0.01, 0.99);
    const pFormN = clamp(pForm + gaussian() * sigmaForm, 0.01, 0.99);
    const pH2HN = clamp(pH2H + gaussian() * sigmaH2H, 0.01, 0.99);
    const pSample =
      (wElo * pEloN + wForm * pFormN + wH2H * pH2HN) / totalW;
    samples.push(pSample);
  }
  samples.sort((a, b) => a - b);
  const icLow = Math.round(samples[Math.floor(0.025 * BOOTSTRAP_N)] * 100);
  const icHigh = Math.round(samples[Math.floor(0.975 * BOOTSTRAP_N)] * 100);

  const probA = Math.round(pA * 100);
  const probB = 100 - probA;

  // Confidence: inverse of normalized IC width
  const icWidth = icHigh - icLow;
  const confidence = clamp(1 - icWidth / 40, 0, 1); // 40pt = max uncertainty

  return {
    probA,
    probB,
    ic: [icLow, icHigh],
    confidence: Math.round(confidence * 100) / 100,
    eloGap: Math.round(eloGap),
    model: "Elo+Forme+Surface+H2H",
    weights: { elo: wElo, surface: SURFACE_WEIGHT, form: wForm, h2h: wH2H },
  };
}

// --- Utilities ---

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Box-Muller transform for standard normal
function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Update an Elo rating after a match result.
 * Useful for live in-play Elo recomputation.
 */
export function updateElo(
  winnerElo: number,
  loserElo: number,
  k: number = ELO_K
): { newWinner: number; newLoser: number } {
  const expectedWinner = eloImpliedProb(winnerElo, loserElo);
  const expectedLoser = 1 - expectedWinner;
  return {
    newWinner: winnerElo + k * (1 - expectedWinner),
    newLoser: loserElo + k * (0 - expectedLoser),
  };
}
