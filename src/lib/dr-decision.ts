/**
 * Feu tricolore de décision — transforme le DR (Dominance Ratio) en signal
 * actionnable pour le widget Document PiP.
 *
 * Échelle du `dr` côté React : [-1, +1] (tanh-smoothed, cf. `use-momentum-dr.ts`).
 * ATTENTION : différent du DR legacy `_tnComputeDR` (ratio ≥ 0, seuil 1.3) —
 * ne pas mélanger les 2 échelles.
 *
 * Seuils calés sur `qualLabelKey` de `momentum-dr.tsx:45-50` (paliers
 * qualitatifs déjà validés en prod) :
 *   |dr| < 0.30  → "neutral"      → ❌ NE PAS PARIER (edge insuffisant)
 *   |dr| 0.30-0.55 → "slight/moderate" → ⚠️ ATTENDRE (tendance naissante)
 *   |dr| >= 0.55 → "dominant"     → ✅ PARIE (dominance nette)
 *
 * Plus une garde "données insuffisantes" si le momentum n'est pas encore
 * "settled" (moins de 4 points trackés) — évite les faux signaux en début
 * de match quand le buffer est vide.
 */

export type DrDecisionLevel = "bet" | "wait" | "no-bet";

export type DrDecision = {
  level: DrDecisionLevel;
  /** Emoji icône pour affichage compact. */
  icon: "✅" | "⚠️" | "❌";
  /** Couleur de texte (classe Tailwind). */
  colorClass: string;
  /** Fond (classe Tailwind, pour badge). */
  bgClass: string;
  /** Label court (FR, dur — le widget PiP n'a pas de next-intl). */
  label: string;
  /** Raison courte (FR) — aide l'utilisateur à comprendre le signal. */
  reason: string;
};

const DECISIONS = {
  bet: {
    level: "bet" as const,
    icon: "✅" as const,
    colorClass: "text-emerald-300",
    bgClass: "bg-emerald-500/15",
    label: "PARIE",
    reason: "Dominance nette détectée",
  },
  wait: {
    level: "wait" as const,
    icon: "⚠️" as const,
    colorClass: "text-amber-300",
    bgClass: "bg-amber-500/15",
    label: "ATTENDRE",
    reason: "Tendance naissante, laisser confirmer",
  },
  noBet: {
    level: "no-bet" as const,
    icon: "❌" as const,
    colorClass: "text-rose-300",
    bgClass: "bg-rose-500/15",
    label: "NE PAS PARIER",
    reason: "Match équilibré, edge insuffisant",
  },
};

/** DR minimum en valeur absolue pour recommander un pari. */
const DR_BET_THRESHOLD = 0.55;
/** DR en-dessous duquel le match est jugé équilibré (pas d'edge). */
const DR_NO_BET_THRESHOLD = 0.3;
/** Points minimum dans le buffer momentum avant d'émettre un signal fiable. */
const MIN_POINTS_TRACKED = 4;

/**
 * @param dr — Dominance Ratio lissé ∈ [-1, +1] (cf. `useMomentumDR`).
 * @param pointsTracked — Nombre de points dans le buffer momentum.
 * @param settled — true si le buffer a atteint la taille min pour un calcul stable.
 */
export function getDrDecision(
  dr: number,
  pointsTracked: number,
  settled: boolean,
): DrDecision {
  // Garde "données insuffisantes" : en début de match, le DR est bruité.
  if (!settled || pointsTracked < MIN_POINTS_TRACKED) {
    return {
      ...DECISIONS.wait,
      reason: "Données insuffisantes (< 4 points trackés)",
    };
  }

  const absDr = Math.abs(dr);

  if (absDr >= DR_BET_THRESHOLD) {
    return DECISIONS.bet;
  }
  if (absDr < DR_NO_BET_THRESHOLD) {
    return DECISIONS.noBet;
  }
  return DECISIONS.wait;
}
