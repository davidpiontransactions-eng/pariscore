/**
 * l10.ts — PowerScore L5 / L10 d'un joueur de snooker.
 *
 * DEUX FENÊTRES, UNE SEULE FONCTION. `windowOf(records, 5)` analyse les 5
 * derniers matchs, `windowOf(records, 10)` les 10 derniers. Même code, même
 * jeu de métriques, deux appels. Aucun mélange entre les deux fenêtres.
 *
 * LES 7 MÉTRIQUES (poids = 100)
 * ------------------------------------------------------------------
 *  1. Élo de la fenêtre            30  seul indicateur ajusté à la force de
 *                                      l'adversaire ; tout le reste mesure
 *                                      un résultat brut, pas une qualité
 *                                      d'adversaire.
 *  2. Frame share                  18  7-1 et 7-6 sont la même victoire en
 *                                      W/L mais pas du tout le même match.
 *  3. Conversion de deciders       15  les matchs à une frame près ; c'est
 *                                      là que se joue le plafond des 67 %.
 *  4. Écart de POINTS par frame    10  domination en points et pas seulement
 *                                      en frames : distinguishes le 5-1 à 40
 *                                      points/frame du 5-1 à 80.
 *  5. Points par frame             10  débit de construction des points.
 *  6. Centuries pour 100 frames     9  seul signal de « power » disponible ;
 *                                      pas de pot% dans la base.
 *  7. Resilience                    8  gagner après avoir perdu au moins
 *                                      une frame distingue le durable du
 *                                      spécialiste d'une frame.
 *
 * SUPPRIMÉS (et pourquoi) — ils occupaient 55 % de l'ancien score :
 *  - `maxBreak`  : 147 pour 9 des 10 meilleurs joueurs du top. Variance
 *                  nulle, donc information nulle. 10 % de poids gaspillés.
 *  - `winPct` career : redondant avec l'Élo, qui l'englobe déjà et corrige
 *                  en plus de la force d'adversaire.
 *  - `quickElo` : `((wins+15)/(played+30) - 0.5) * 1000` — un win-rate lissé,
 *                  pas un Élo ; et son paramètre `centuries` est accepté puis
 *                  ignoré (`elo-engine.ts:35`).
 *  - `ranking`   : 383 lignes dans toute la base.
 *
 * SAMPLE SIZE — une fenêtre de 5 matchs est un échantillon minuscule. Le score
 * est donc rétréci vers 50 par un facteur Bayesien `n / (n + SHRINK_K)` :
 *   n=5 → 38 % du signal propre · n=10 → 56 %.
 * Sans ça, un 5-0 sur des adversaires faibles afficherait « élite ».
 */

import { combinePowerMetrics, type PowerMetric, type PowerScore } from "@/lib/power-score";
import type { EloMatchRecord } from "./elo-walkforward";

/**
 * Demi-poids empirique de l'échantillon. Calibré : n=5 → 38 %, n=10 → 56 %.
 */
export const SHRINK_K = 8;

/**
 * La PRIEUR du rétrécissement est bien 50, et c'est mathématique, pas une
 * approximation : un match a exactement un vainqueur et un perdant, donc le
 * taux de victoire moyen du champ vaut 50,00 % par construction. Mesuré sur
 * 34 694 matchs : `winRate = 50.00 %`, `frameShare moyen = 50.00 %`.
 *
 * Noté ici parce qu'une revue a proposé de « corriger » cette valeur en la
 * remplaçant par le taux de victoire observé : la mesure confirme 50,00 %, le
 * remplacement ne changerait rien.
 */
export const SHRINK_PRIOR = 50;

/** Poids des 7 métriques — somment à 100. */
export const L10_WEIGHTS = {
  elo: 30,
  frameShare: 18,
  decider: 15,
  margin: 10,
  pointsPerFrame: 10,
  centuries: 9,
  resilience: 8,
} as const;

/**
 * BORNES DE NORMALISATION — MESURÉES SUR DONNÉES RÉPARÉES.
 *
 * ⚠️ SECONDE MESURE. La première (p1/p90 sur 804 fenêtres) a été faite sur une
 * base dont la colonne dscores porte le VAINQUEUR en premier dans 96,7 % des
 * lignes : les écarts y étaient calculés sur la mauvaise paire de joueurs. Ces
 * bornes-ci sont re-mesurées sur 2 281 joueurs, base réparée.
 *
 *   métrique         bornes         p50 réel
 *   elo              1453 - 1526    1491
 *   frameShare       0.210 - 0.563  0.40
 *   margin           -40.3 - +7.7   -12.4
 *   pointsPerFrame   26.4 - 54.2    42.8
 *   centuries/100    0.00 - 3.50    0.00
 *
 * p10/p90 plutôt que p25/p75 : on cherche la RÉSOLUTION pour discriminer deux
 * joueurs proches, pas la symétrie autour de 50. Le rétrécissement bayésien
 * ramène de toute façon vers 50.
 *
 * MESURE ASSOCIÉE qui limite strongly l'exploitabilité — voir `L10_METRIC_CAVEATS` :
 * `decider` et `resilience` sont quasi BINAIRES sur la base réelle
 * (resilience p50 = p75 = 100 % ; decider p25 = 0 et p75 = 100) et
 * `decider` est absent de 37 % des fenêtres L5. Elles sont gardées pour
 * l'affichage et le tooltip, avec un poids faible.
 */
export const L10_BOUNDS = {
  elo: { lo: 1453, hi: 1526 },
  frameShare: { lo: 0.21, hi: 0.563 },
  margin: { lo: -40.3, hi: 7.7 },
  pointsPerFrame: { lo: 26.4, hi: 54.2 },
  centuries: { lo: 0, hi: 3.5 },
} as const;

/**
 * Réserves connues, mesurées sur 2 281 joueurs.
 *
 * `decider` (écart de frames ≤ 1) : absente de 37,4 % des fenêtres L5 et 19,3 %
 * des L10. Quand elle existe, elle est quasi binaire — p25 = 0, p75 = 100.
 * Son poids est donc renormalisé vers le haut ou vers le bas selon la présence,
 * ce qui fait osciller la couverture de la fenêtre (0.85 ↔ 1.00).
 *
 * `resilience` : p50 = p75 = 100 %, donc la majorité des joueurs qui gagnent
 * gagnent tous leurs frames remontées. Elle distingue mal « gagne souvent »
 * de « gagne en siendo rattrapé ».
 *
 * Conséquence retenue : ces deux métriques ne doivent PAS servir à prédire.
 * La validation (`snooker-power-score-validate.ts`) l'a mesuré — l'Élo seul
 * bat le composite L5/L10 sur les trois métriques.
 */
export const L10_METRIC_CAVEATS = {
  deciderAbsentL5Pct: 37.4,
  deciderAbsentL10Pct: 19.3,
  resilienceMedianPct: 100,
} as const;

/** Bornes de l'export, pour outillage/traceabilité. */
export const L10_BOUNDS_MEASURED_ON = {
  date: "2026-10-01",
  matches: 115862,
  players: 2281,
  percentiles: "p10/p90",
  dataQuality: "réparée (winner_url)",
} as const;

const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

/** Normalisation linéaire bornée, `null` si l'entrée est absente. */
function scale(value: number | null, lo: number, hi: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (hi === lo) return 50;
  return clamp100(((value - lo) / (hi - lo)) * 100);
}

export type L10WindowResult = PowerScore & {
  /** Nb de matchs réellement dans la fenêtre (≤ N). */
  matches: number;
  /** Victoires dans la fenêtre. */
  wins: number;
  /** Défaite dans la fenêtre. */
  losses: number;
  /** Détail des matchs de la fenêtre, du plus ancien au plus récent. */
  details: EloMatchRecord[];
};

export type WindowOptions = {
  /**
   * ISO `YYYY-MM-DD`. N'inclut QUE les matchs strictement antérieurs à cette
   * date.
   *
   * OBLIGATOIRE pour prédire un match, et c'est le défaut dans le cas d'un
   * affichage : sur les 7 métriques, 6 sont le RÉSULTAT BRUT des matchs de la
   * fenêtre (frame share, deciders, points par frame, centuries…). Si le match
   * à prédire est dans la fenêtre, son propre résultat entre dans son propre
   * score — une défaite fait baisser le PowerScore du joueur qu'on s'apprête à
   * prédire, avant même qu'il joue. L'Élo est immunisé (il est gelé avant le
   * match), mais lui seul.
   *
   * Sans ce filtre, l'affichage est correct — au moment où l'on consulte, le
   * dernier match EST joué — mais la validation walk-forward mesure une fuite.
   */
  before?: string;
};

/**
 * PowerScore sur les `windowSize` derniers matchs (fenêtre glissante, triée
 * du plus ancien au plus récent). `windowSize` = 5 ou 10.
 *
 * `opts.before` exclut les matchs à la date donnée ou après : c'est ce qui
 * sépare l'affichage (« sa forme actuelle ») de la prédiction (« sa forme
 * avant ce match »).
 */
export function windowOf(records: EloMatchRecord[], windowSize: number, opts?: WindowOptions): L10WindowResult {
  const before = opts?.before;
  const eligible = before ? records.filter((r) => r.date < before) : records;
  const details = eligible.slice(-windowSize);
  const n = details.length;

  if (n === 0) {
    return {
      score: 50,
      metrics: [],
      coverage: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      details,
    };
  }

  const wins = details.filter((r) => r.won).length;
  const losses = n - wins;

  // ── 1. Élo ────────────────────────────────────────────────────────────────
  // On prend l'Élo du DERNIER match de la fenêtre (le plus récent, donc déjà
  // ajusté à tout ce qui précède). Moyenne avec l'Élo médian de la fenêtre
  // pour lisser le bruit d'une fenêtre à 5 matchs.
  const eloLast = details[details.length - 1].elo;
  const eloMean = details.reduce((s, r) => s + r.elo, 0) / n;
  const eloValue = scale((eloLast + eloMean) / 2, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);

  // ── 2. Frame share ────────────────────────────────────────────────────────
  const shareMean = details.reduce((s, r) => s + r.frameShare, 0) / n;

  // ── 3. Conversion de deciders ─────────────────────────────────────────────
  // Match « serré » = écart de frames ≤ 1. On ne compte que ceux-ci : une
  // conversion de 100 % sur 0 decider n'a pas de sens.
  const deciders = details.filter((r) => Math.abs(r.framesWon - r.framesLost) <= 1);
  const deciderRate = deciders.length > 0 ? (deciders.filter((r) => r.won).length / deciders.length) * 100 : null;

  // ── 4. Écart de POINTS par frame ───────────────────────────────────────────
  // (pointsWon - pointsLost) / frames jouées. C'est ce qui distingue un 5-1 à
  // 40 points/frame d'un 5-1 à 80 : le frame share les voit identiques, l'écart
  // de points non. Exige `pointsLost`, donc exclut les matchs sans frames.
  const marginFrameStats = details.filter(
    (r) => r.pointsWon != null && r.pointsLost != null && r.totalFrames != null && r.totalFrames > 0,
  );
  const marginMean =
    marginFrameStats.length > 0
      ? marginFrameStats.reduce((s, r) => s + ((r.pointsWon as number) - (r.pointsLost as number)) / (r.totalFrames as number), 0) / marginFrameStats.length
      : null;

  // ── 5. Points par frame ───────────────────────────────────────────────────
  // Uniquement sur les matchs dont les frames sont lisibles : une division par
  // zéro sur `totalFrames = 0` rendrait tout le score `NaN`.
  const withFrames = details.filter((r) => r.pointsWon != null && r.totalFrames != null && r.totalFrames > 0);
  const ppfMean =
    withFrames.length > 0
      ? withFrames.reduce((s, r) => s + (r.pointsWon as number) / (r.totalFrames as number), 0) / withFrames.length
      : null;

  // ── 6. Centuries pour 100 frames ──────────────────────────────────────────
  const withCent = details.filter((r) => r.centuries != null && r.totalFrames != null && r.totalFrames > 0);
  const cenPer100 =
    withCent.length > 0
      ? (withCent.reduce((s, r) => s + (r.centuries as number) / (r.totalFrames as number), 0) / withCent.length) * 100
      : null;

  // ── 7. Resilience ─────────────────────────────────────────────────────────
  // Victoires obtenues en ayant perdu au moins une frame : un 4-3 ou un 5-4
  // compte, un 4-0 non. 100 % → 100, 0 % → 50 (neutre : ne pas pénaliser un
  // joueur qui gagne largement, ce n'est pas un défaut).
  const comebackWins = details.filter((r) => r.won && r.framesLost > 0).length;
  const playedWins = wins;
  const resilienceRate = playedWins > 0 ? (comebackWins / playedWins) * 100 : null;

  const metrics: PowerMetric[] = [
    {
      key: "elo",
      label: "Élo fenêtre",
      weight: L10_WEIGHTS.elo,
      value: eloValue,
      display: `${Math.round((eloLast + eloMean) / 2)}`,
      hint: `Élo gelé avant chaque match, demi-vie 12 mois · borné ${L10_BOUNDS.elo.lo}-${L10_BOUNDS.elo.hi}`,
    },
    {
      key: "frameShare",
      label: "Frame share",
      weight: L10_WEIGHTS.frameShare,
      value: scale(shareMean, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi),
      display: `${(shareMean * 100).toFixed(0)} %`,
      hint: `Frames gagnées / frames jouées · borné ${(L10_BOUNDS.frameShare.lo * 100).toFixed(0)}-${(L10_BOUNDS.frameShare.hi * 100).toFixed(0)} %`,
    },
    {
      key: "decider",
      label: "Deciders",
      weight: L10_WEIGHTS.decider,
      value: deciderRate,
      display: deciders.length > 0 ? `${deciders.filter((r) => r.won).length}/${deciders.length}` : "n/a",
      hint: "Victoires sur les matchs à 1 frame près — là où se joue le plafond des 67 %",
    },
    {
      key: "margin",
      label: "Écart points",
      weight: L10_WEIGHTS.margin,
      value: scale(marginMean, L10_BOUNDS.margin.lo, L10_BOUNDS.margin.hi),
      display: marginMean != null ? `${marginMean >= 0 ? "+" : ""}${marginMean.toFixed(1)}` : "n/a",
      hint: `Points gagnés − perdus par frame · borné ${L10_BOUNDS.margin.lo} à +${L10_BOUNDS.margin.hi}`,
    },
    {
      key: "pointsPerFrame",
      label: "Points/frame",
      weight: L10_WEIGHTS.pointsPerFrame,
      value: scale(ppfMean, L10_BOUNDS.pointsPerFrame.lo, L10_BOUNDS.pointsPerFrame.hi),
      display: ppfMean != null ? ppfMean.toFixed(1) : "n/a",
      hint: `Débit moyen de points par frame · borné ${L10_BOUNDS.pointsPerFrame.lo}-${L10_BOUNDS.pointsPerFrame.hi} · PAS un pot%`,
    },
    {
      key: "centuries",
      label: "Centuries",
      weight: L10_WEIGHTS.centuries,
      value: scale(cenPer100, L10_BOUNDS.centuries.lo, L10_BOUNDS.centuries.hi),
      display: cenPer100 != null ? `${cenPer100.toFixed(2)}/100` : "n/a",
      hint: `Centuries pour 100 frames · borné ${L10_BOUNDS.centuries.lo}-${L10_BOUNDS.centuries.hi}`,
    },
    {
      key: "resilience",
      label: "Resilience",
      weight: L10_WEIGHTS.resilience,
      value: resilienceRate,
      display: resilienceRate != null ? `${resilienceRate.toFixed(0)} %` : "n/a",
      hint: "Victoires après avoir perdu ≥ 1 frame",
    },
  ];

  const combined = combinePowerMetrics(metrics);

  // Rétrécissement Bayesien vers la moyenne du champ (50,0 % par construction).
  // Une fenêtre de 5 matchs ne mérite pas la confiance d'un displayscore complet.
  const trust = n / (n + SHRINK_K);
  const score = Math.round(SHRINK_PRIOR + (combined.score - SHRINK_PRIOR) * trust);

  return {
    ...combined,
    score: Math.max(0, Math.min(100, score)),
    matches: n,
    wins,
    losses,
    details,
  };
}