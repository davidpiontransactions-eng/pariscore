import {
  simulateVeto,
  ACTIVE_MAP_POOL,
  type Cs2MapName,
  type TeamModel,
} from "./cs2-predictive-ml-engine";

/**
 * map-play-prob.ts — Probabilité qu'une map soit jouée dans une série.
 * ---------------------------------------------------------------------------------
 * Fondement académique : le veto (pick/ban) est un multiplicateur de victoire majeur —
 * +19.8% de probabilité de victoire de match pour un veto optimal chez des équipes
 * égales (Petri et al., arXiv 2106.08888). Connaître QUELLE map sera jouée affine
 * directement les marchés winner-map, over/under rounds et handicap rounds.
 *
 * Principe : on exécute la simulation rationnelle du veto (simulateVeto) → les maps
 * retenues sont quasi-certaines (P≈1). Pour les autres, un prior dérivé des fréquences
 * historiques pick/ban (Laplace smoothing) distribue le reste. Si des fréquences
 * historiques sont fournies, on lisse 70/30 entre la décision veto et l'historique.
 */

/**
 * Calcule P(map jouée) pour chaque map du pool actif.
 * @param models TeamModel des deux équipes (winrates par carte).
 * @param bestOf Format de la série (1|3|5) — détermine le nombre de maps retenues.
 * @param historicalFreq Nombre de fois où chaque map a été jouée par la paire (0 = inconnu).
 * @returns Record<Cs2MapName, number> — la somme des P = bestOf (nombre de maps jouées).
 */
export function mapPlayProbability(
  models: { team1: TeamModel; team2: TeamModel },
  bestOf: 1 | 3 | 5,
  historicalFreq: Partial<Record<Cs2MapName, number>>,
): Record<Cs2MapName, number> {
  const pool = [...ACTIVE_MAP_POOL];
  const { pickedMaps } = simulateVeto(models.team1, models.team2, pool, bestOf);
  const nMaps = bestOf; // nombre de maps jouées attendu

  // Prior historique (Laplace) : fréquence normalisée + 1/count pour éviter les zéros.
  const histEntries = ACTIVE_MAP_POOL.map((m) => [m, historicalFreq[m] ?? 0] as const);
  const histTotal = histEntries.reduce((a, [, v]) => a + v, 0);
  const laplace = (m: Cs2MapName): number =>
    histTotal > 0 ? (historicalFreq[m] ?? 0 + 1) / (histTotal + ACTIVE_MAP_POOL.length) : 1 / pool.length;

  // Distribution target : maps retenues par le veto.
  const vetoProb = (m: Cs2MapName): number => (pickedMaps.includes(m) ? 1 : 0);

  // Lissage : 70% veto, 30% historique (si historique fournie), sinon 100% veto.
  const useHist = histTotal > 0;
  const alpha = useHist ? 0.7 : 1.0;

  const raw = ACTIVE_MAP_POOL.map((m) => {
    const p = alpha * vetoProb(m) + (1 - alpha) * laplace(m);
    return [m, p] as const;
  });

  // Renormalise pour que la somme = nMaps.
  const rawSum = raw.reduce((a, [, v]) => a + v, 0);
  const out = {} as Record<Cs2MapName, number>;
  for (const [m, v] of raw) {
    out[m] = rawSum > 0 ? (v / rawSum) * nMaps : 0;
  }
  return out;
}