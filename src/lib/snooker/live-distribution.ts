/**
 * Distribution live des scores finaux — snooker.
 *
 * Hypothèse (standard académique à granularité frame, cf. modèles de Markov
 * hiérarchiques tennis Barnett/O'Malley, hypothèse iid Klaassen & Magnus) :
 * frames indépendantes, proba de gagner une frame constante = pFrame.
 *
 * UNE distribution → 3 bets live : vainqueur, Over/Under total, handicap.
 * Toutes les probas dérivées sont en % (0-100) pour la cohérence UI.
 */

export type FinalScore = {
  /** Frames finales joueur 1 */
  a: number;
  /** Frames finales joueur 2 */
  b: number;
  /** Probabilité d'occurrence (0-1) */
  prob: number;
};

export type HandicapPick = {
  side: "p1" | "p2";
  /** Ligne : P1 "-m" (gagne par ≥ m) ou P2 "+m" (ne perd pas par > m) */
  line: number;
  label: string;
  /** Probabilité de réussite en % */
  prob: number;
  /** true si aucune ligne n'atteint la barre (on affiche la meilleure dispo) */
  belowBar: boolean;
};

/** Log-binomiale locale (auto-suffisante, pas de dépendance UI). */
function logBinomPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 0 : -Infinity;
  if (p >= 1) return k === n ? 0 : -Infinity;
  let logC = 0;
  for (let i = 0; i < k; i++) {
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return logC + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

/**
 * Distribution des scores finaux atteignables depuis (scoreA, scoreB).
 * P(finir A-B) = C(rest-1, à-marquer-1) · p^à-marquer · (1-p)^encaissées,
 * la dernière frame étant remportée par le vainqueur.
 */
export function liveScoreDistribution(
  pFrame: number,
  bestOf: number,
  scoreA: number,
  scoreB: number,
): FinalScore[] {
  const p = Math.min(0.999, Math.max(0.001, pFrame));
  const need = Math.ceil(bestOf / 2);
  if (scoreA >= need || scoreB >= need) return [];
  const out: FinalScore[] = [];
  // P1 conclut à need (B < need)
  for (let b = scoreB; b < need; b++) {
    const ra = need - scoreA;
    const rb = b - scoreB;
    const lp = logBinomPMF(ra - 1, ra + rb - 1, p) + Math.log(p);
    out.push({ a: need, b, prob: Math.exp(lp) });
  }
  // P2 conclut à need (A < need)
  for (let a = scoreA; a < need; a++) {
    const ra = a - scoreA;
    const rb = need - scoreB;
    const lp = logBinomPMF(rb - 1, ra + rb - 1, 1 - p) + Math.log(1 - p);
    out.push({ a, b: need, prob: Math.exp(lp) });
  }
  return out;
}

/** P(victoire du côté demandé) — somme des états finaux gagnants, en %. */
export function liveWinnerProb(dist: FinalScore[], side: "p1" | "p2"): number {
  const s = dist.reduce((t, f) => t + ((side === "p1" ? f.a > f.b : f.b > f.a) ? f.prob : 0), 0);
  return Math.min(100, Math.max(0, s * 100));
}

/** P(total frames > ligne) — en %. */
export function liveOverProb(dist: FinalScore[], line: number): number {
  const s = dist.reduce((t, f) => t + (f.a + f.b > line ? f.prob : 0), 0);
  return Math.min(100, Math.max(0, s * 100));
}

/**
 * P(couvrir le handicap) — en %.
 * P1 "-m" : gagne par au moins m frames (A-B ≥ m).
 * P2 "+m" : ne perd pas par plus de m frames (A-B ≤ m, convention bookmaker).
 */
export function liveHandicapProb(dist: FinalScore[], side: "p1" | "p2", line: number): number {
  const s = dist.reduce(
    (t, f) => t + ((side === "p1" ? f.a - f.b >= line : f.a - f.b <= line) ? f.prob : 0),
    0,
  );
  return Math.min(100, Math.max(0, s * 100));
}

/**
 * Choisit le bet handicap le plus pointu qui tient la barre (défaut 65 %) :
 * parmi les lignes P1 -m / P2 +m à proba ≥ barre, on garde la plus proche
 * par au-dessus (ligne la plus exigeante qui reste fiable).
 * Si aucune ligne ne tient la barre, on renvoie la meilleure dispo (belowBar).
 */
export function pickLiveHandicap(
  pFrame: number,
  bestOf: number,
  scoreA: number,
  scoreB: number,
  bar = 0.65,
): HandicapPick | null {
  const need = Math.ceil(bestOf / 2);
  if (scoreA >= need || scoreB >= need) return null;
  const dist = liveScoreDistribution(pFrame, bestOf, scoreA, scoreB);
  const cands: HandicapPick[] = [];
  for (let m = 1; m <= need - 1; m++) {
    cands.push({ side: "p1", line: m, label: `P1 -${m}`, prob: liveHandicapProb(dist, "p1", m), belowBar: false });
    cands.push({ side: "p2", line: m, label: `P2 +${m}`, prob: liveHandicapProb(dist, "p2", m), belowBar: false });
  }
  const ok = cands
    .filter((c) => c.prob >= bar * 100)
    .sort((x, y) => x.prob - y.prob);
  if (ok.length > 0) return ok[0];
  const best = [...cands].sort((x, y) => y.prob - x.prob)[0];
  return { ...best, belowBar: true };
}
