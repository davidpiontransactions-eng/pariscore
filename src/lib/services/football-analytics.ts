// Service analytique football — picks >= 60% depuis matrice Dixon-Coles,
// ratio xG (Dominance Ratio), et esperance mathematique (EV).
//
// S'appuie sur dixon-coles.ts (existant) — les probas sont normalisees [0,1]
// (le module Dixon-Coles renvoie des pourcentages 0-100, on divise par 100).

import { buildDixonColesMatrix, dixonColesMarkets } from "../prediction/football/dixon-coles";

/** Entree du moteur de picks. */
export type PickInput = {
  lambdaHome: number;
  lambdaAway: number;
  /** Part des buts marques en 1ere MT (0-1) — necessaire pour le pick over05ht. */
  htShare?: number | null;
  /** Cotes bookmaker (optionnelles — EV calculee si presentes). */
  odds?: {
    over15?: number | null;
    ahHomePlus15?: number | null;  // cote AH +1.5 domicile
    ahAwayPlus15?: number | null;  // cote AH +1.5 exterieur
  } | null;
  /** xG cumule (optionnel — declencheur supplementaire over15). */
  xgTotal?: number | null;
};

/** Pick genere par le moteur (proba normalisee [0,1]). */
export type MatchPick = {
  type: "over15" | "dcOver15" | "ahPlus15" | "over05ht";
  side?: "home" | "away";
  prob: number;
  ev: number | null;
  trigger: string;
};

const MIN_PICK_PROB = 0.60;

/** Construit les picks eligibles (>= 60%) pour un match. */
export function computeMatchPicks(input: PickInput): MatchPick[] {
  const { lambdaHome, lambdaAway, htShare, odds, xgTotal } = input;
  const picks: MatchPick[] = [];

  // Matrice DC complete (9x9) necessaire pour les calculs joints.
  const matrix = buildDixonColesMatrix(lambdaHome, lambdaAway, 0.05, 8);
  const mk = dixonColesMarkets(lambdaHome, lambdaAway, 0.05);
  const max = matrix.length - 1;

  // ── over15 : P(total >= 2) ──
  // Declencheur : xG cumule > 2.6 OU xG inconnu (conservateur).
  const xgOk = xgTotal == null || xgTotal > 2.6;
  if (xgOk) {
    const prob = mk.over15 / 100;
    if (prob >= MIN_PICK_PROB) {
      const ev = odds?.over15 ? deVigPrice(prob, odds.over15) : null;
      picks.push({ type: "over15", prob, ev, trigger: `DC over15=${(prob * 100).toFixed(0)}%` });
    }
  }

  // ── dcOver15 : P(1X ET >= 2 buts) = P(1X) - P(1X ET <= 1 but) ──
  // Match ou le domicile ne perd pas ET au moins 2 buts.
  let p1xAndUnder15 = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h >= a && h + a <= 1) p1xAndUnder15 += matrix[h][a];
    }
  }
  const p1x = (mk.homeWin + mk.draw) / 100;
  const dcOver15Prob = p1x - p1xAndUnder15;
  if (dcOver15Prob >= MIN_PICK_PROB) {
    const ev = odds?.over15 ? deVigPrice(dcOver15Prob, odds.over15) : null;
    picks.push({ type: "dcOver15", side: "home", prob: dcOver15Prob, ev, trigger: `DC 1X&over15=${(dcOver15Prob * 100).toFixed(0)}%` });
  }

  // ── ahPlus15 : outsider qui ne perd pas par 2+ buts ──
  // AH +1.5 exterieur = P(away ne perd pas par 2+) = 1 - P(home gagne par 2+).
  let pHomeWinsBy2 = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h >= a + 2) pHomeWinsBy2 += matrix[h][a];
    }
  }
  const ahAwayProb = 1 - pHomeWinsBy2;
  if (ahAwayProb >= MIN_PICK_PROB) {
    const ev = odds?.ahAwayPlus15 ? deVigPrice(ahAwayProb, odds.ahAwayPlus15) : null;
    picks.push({ type: "ahPlus15", side: "away", prob: ahAwayProb, ev, trigger: `DC AH+1.5 away=${(ahAwayProb * 100).toFixed(0)}%` });
  }

  // ── over05ht : part de buts en 1ere MT (donnee exogene) ──
  if (htShare != null && htShare >= 0.65) {
    // Estimation : P(over 0.5 HT) proportionnelle a htShare (modele lineaire conservative).
    const prob = Math.min(0.95, htShare);
    if (prob >= MIN_PICK_PROB) {
      picks.push({ type: "over05ht", prob, ev: null, trigger: `htShare=${(htShare * 100).toFixed(0)}%` });
    }
  }

  return picks.sort((a, b) => b.prob - a.prob);
}

/** Dominance Ratio : xG_for / xGA (clamp affichage). Retourne null si xGA nul. */
export function dominanceRatio(xgFor: number | null | undefined, xgAgainst: number | null | undefined): number | null {
  if (xgFor == null || xgAgainst == null || xgAgainst <= 0) return null;
  return Math.min(3, Math.max(0.3, xgFor / xgAgainst));
}

/** EV = P * cote_nette - 1. Retourne null si cote absente. */
function deVigPrice(prob: number, odds: number): number | null {
  if (odds <= 1) return null;
  return prob * odds - 1;
}

/** Melange lambda forme + xG (50/50 si xG dispo, sinon forme pure). */
export function blendLambda(
  lambdaForme: number,
  lambdaXg: number | null | undefined,
): number {
  if (lambdaXg == null || lambdaXg <= 0) return lambdaForme;
  return 0.5 * lambdaForme + 0.5 * lambdaXg;
}
