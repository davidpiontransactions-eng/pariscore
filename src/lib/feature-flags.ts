/**
 * Feature flags pour la refonte UI/UX v1 (P1-P4).
 *
 * Ces clés correspondent aux flags PostHog qui permettent le rollback
 * progressif de chaque module de la refonte.
 *
 * Usage: const variant = useAnalytics().getVariant(REFONTE_FLAGS.NEW_DASHBOARD);
 */
export const REFONTE_FLAGS = {
  /** Dashboard global multi-sport (P4) */
  NEW_DASHBOARD:        "refonte-v2-dashboard",
  /** Anneau de confiance SVG (P2) */
  CONFIDENCE_RING:      "refonte-v2-confidence-ring",
  /** Matrice de cotes bookmaker × match (P3) */
  ODDS_VALUE_MATRIX:    "refonte-v2-odds-matrix",
  /** Simulateur de scénarios (P3) */
  SCENARIO_SIMULATOR:   "refonte-v2-scenario-sim",
  /** Barre de navigation mobile (P1) */
  BOTTOM_NAV_MOBILE:    "refonte-v2-bottom-nav",
  /** Comparateur H2H avancé (P3) */
  H2H_ADVANCED:         "refonte-v2-h2h-advanced",
  /** Carte insight AI Gemini (P4) */
  AI_INSIGHT_CARD:      "refonte-v2-ai-insight",
  /** Header auto-hide au scroll (P1) */
  AUTO_HIDE_HEADER:     "refonte-v2-auto-hide-header",
  /** Swipe horizontal sports (P1) */
  SPORT_SWIPE:          "refonte-v2-sport-swipe",
  /** Bottom sheet / drawer mobile (P1) */
  BOTTOM_SHEET:         "refonte-v2-bottom-sheet",
} as const;

export type RefonteFlag = keyof typeof REFONTE_FLAGS;

/** Vérifie si un flag de refonte est activé (true = nouvelle version, false = legacy). */
export function isRefonteEnabled(
  getVariant: (flag: string) => string | null,
  flag: RefonteFlag,
): boolean {
  const variant = getVariant(REFONTE_FLAGS[flag]);
  // Si le flag n'existe pas ou vaut "control", on reste sur legacy
  if (!variant || variant === "control") return false;
  return variant === "test" || variant === "new";
}
