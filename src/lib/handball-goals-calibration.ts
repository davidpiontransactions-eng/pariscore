// Calibration de la dispersion des totaux de buts — handball.
//
// ν (l'exposant de la CMP) contrôle la DISPERSION du modèle : ν = 1 → Poisson,
// ν > 1 → distribution resserrée. C'est le seul paramètre qui décide si un
// seuil de total produit une probabilité exploitable ou un 0 % / 100 %.
//
import { overUnderProb } from "./handball-cmp";

// ┌── MESURE (35 matchs RÉELS, Vitibet, scrape 2026-10-04) ──────────────┐
// │ 5 ligues, 6 à 9 matchs terminés chacune, scores finaux relevés.      │
// └───────────────────────────────────────────────────────────────────────┘

/** Totaux de buts réels (GF+GA) relevés sur les 5 ligues Vitibet. */
export const OBSERVED_TOTALS = {
  /** Herre Handbold Ligaen (leagueId 23) — 03.10 et 02.10.2026. */
  herreHandboldLigaen: {
    league: "Herre Handbold Ligaen",
    perTeamMean: 31.8,
    totals: [66, 66, 77, 49, 53, 72, 67],
  },
  /** Bambusa Kvindeligaen (25) — 04.10, 03.10, 02.10 et 30.09.2026. */
  bambusaKvindeligaen: {
    league: "Bambusa Kvindeligaen",
    perTeamMean: 28.5,
    totals: [55, 43, 64, 49, 49, 63, 48],
  },
  /** 1. Division Women (16) — 04.10, 03.10, 02.10 et 26.09.2026. */
  firstDivisionWomen: {
    league: "1. Division Women",
    perTeamMean: 25.6,
    totals: [51, 48, 39, 58, 59, 52],
  },
  /** MOL Liga Women (140) — 03.10 et 19.09.2026. */
  molLigaWomen: {
    league: "MOL Liga Women",
    perTeamMean: 29.2,
    totals: [53, 61, 58, 69, 54, 52],
  },
  /** 2. Bundesliga (43) — 03.10, 02.10, 30.09 et 27.09.2026. */
  bundesliga2: {
    league: "2. Bundesliga",
    perTeamMean: 28.5,
    totals: [69, 55, 58, 67, 52, 62, 47, 62, 60],
  },
} as const satisfies Record<string, { league: string; perTeamMean: number; totals: number[] }>;

export type ObservedLeagueKey = keyof typeof OBSERVED_TOTALS;

function variance(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
}

export type ObservedStats = {
  league: string;
  n: number;
  mean: number;
  /** Écart-type d'un TOTAL de match. */
  sigma: number;
  /** Écart-type de la MOYENNE d'un match (σ / √n). */
  sigmaOfMean: number;
};

/** Statistiques observées d'une ligue. null si la clé est inconnue. */
export function observedStats(key: ObservedLeagueKey): ObservedStats | null {
  const row = OBSERVED_TOTALS[key];
  if (!row) return null;
  const n = row.totals.length;
  const mean = row.totals.reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(variance(row.totals));
  return { league: row.league, n, mean, sigma, sigmaOfMean: sigma / Math.sqrt(n) };
}

/** Toutes les ligues observées. */
export function observedAllStats(): ObservedStats[] {
  return (Object.keys(OBSERVED_TOTALS) as ObservedLeagueKey[])
    .map((k) => observedStats(k))
    .filter((s): s is ObservedStats => s != null);
}

/**
 * σ d'un TOTAL observé, agrégé sur toutes les ligues.
 *
 * On moyenne les VARIANCES intra-ligue (et non les écarts-types) : les ligues
 * ont des moyennes différentes (51 → 64 buts), donc pooling les σ bruts
 * confondrait la dispersion INTER-ligue avec la dispersion d'un match, qui est
 * ce qu'on cherche à modéliser.
 */
export function observedPooledSigma(): { n: number; sigma: number } {
  const all = observedAllStats();
  const n = all.reduce((a, s) => a + s.n, 0);
  const meanVar = all.reduce((a, s) => a + s.sigma ** 2, 0) / all.length;
  return { n, sigma: Math.sqrt(meanVar) };
}

/**
 * ν calibré sur les données réelles.
 *
 * ┌── MESURE vs MODÈLE (λ ≈ 28.5, total attendu 57) ─────────────────────┐
 * │ σ empirique intra-ligue (35 matchs, 5 ligues) ....... 7.25            │
 * │ σ modèle à ν = 1.3 (CMP_DEFAULT_NU) ............... 4.53   (−38 %)   │
 * │ σ modèle à ν = 1.0 (Poisson) ....................... 7.62   (+5 %)    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * ν = 1.3 est donc **écarté** : il prédit une dispersion 1.6× trop faible,
 * soit ~3.7σ d'écart avec l'observation. Conséquence concrète : avec ν = 1.3,
 * `over55.5` vaut 0.0 % et `under62.5` vaut 100.0 % — des probabilités
 * inexploitables qui écrasent mécaniquement le taux de réussite (c'était le
 * symptôme « Over à 57-58 % » remonté sur le TOP 10, avec des seuils fixes
 * calibrés pour un ν = 1.3 alors que le marché réel est ~Poisson).
 *
 * ν = 1.0 reproduit la dispersion observée à 5 % près.
 *
 * Limite assumée : avec 6 à 9 matchs par ligue, l'écart-type de l'estimation
 * de σ est de l'ordre de σ/√(2n) ≈ 2 buts — les ν **par ligue** ne sont pas
 * distinguables (estimations individuelles de 0.9 à 1.3, toutes compatibles
 * avec 1.0). On retient donc une valeur unique. Un recalibrage par ligue
 * exigerait ~40+ matchs chacune.
 */
export const CALIBRATED_NU = 1.0;

/** Borne basse de ν compatible avec la mesure (voir bloc de commentaire). */
export const NU_LOWER_BOUND = 0.9;

// ─── Utilitaires exposés ───

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Probabilité que le total de buts dépasse `line`.
 *
 * Délègue à `overUnderProb` (handball-cmp) : la convolution des deux pmf y est
 * déjà écrite et testée, la réimplémenter avait introduit un bug de kMax.
 *
 * `lambdaH`/`lambdaE` sont des TAUX CMP (cf. cmpLambdaForMean), `nu` l'exposant
 * appliqué aux DEUX équipes. Renvoie null si un paramètre est inutilisable —
 * jamais de nombre inventé.
 */
export function totalProbabilityOver(
  lambdaH: number,
  nu: number,
  lambdaE: number,
  line: number,
): number | null {
  if (!Number.isFinite(lambdaH) || !Number.isFinite(lambdaE) || !Number.isFinite(line)) {
    return null;
  }
  if (lambdaH <= 0 || lambdaE <= 0) return null;
  const { over } = overUnderProb(lambdaH, nu, lambdaE, nu, line);
  if (!Number.isFinite(over)) return null;
  return Math.min(1, Math.max(0, over));
}
