/**
 * Round priority resolver — R8 curation (2026-07-22).
 *
 * But : classer les matchs par phase du tournoi (Finale > Demi > Quart > ...).
 * Le champ `TennisMatch.round` est un string libre renvoyé par BSD
 * (ex: "Final", "Round of 32", "1/8", "Huitième", "Demi-finale", "SF").
 *
 * On normalise via une table regex qui couvre FR/EN/abréviations courantes.
 * 0 = phase la plus importante (Finale), 8 = inconnue/non-classée.
 */

export const ROUND_PRIORITY: Array<{ regex: RegExp; priority: number }> = [
  { regex: /\bfinale?\b|\bfinal\b/i, priority: 0 },
  { regex: /\bdemi[\s-]?finale\b|\bsemifinal|\bsf\b/i, priority: 1 },
  { regex: /\bquart[\s-]?de[\s-]?finale\b|\bquarter|\bqf\b/i, priority: 2 },
  { regex: /\bhuiti[\sèe]+me|\bround of 16|\b1\/8\b|\br16\b/i, priority: 3 },
  { regex: /\bseizi[\sèe]+me|\bround of 32|\b1\/16\b|\br32\b/i, priority: 4 },
  { regex: /\b32[\sèe]+me|\bround of 64|\b1\/32\b|\br64\b/i, priority: 5 },
  { regex: /round robin|\bpoule\b|\bgroup|\brr\b/i, priority: 6 },
  { regex: /qualif|q[1-4]|\bqualification/i, priority: 7 },
];

export const DEFAULT_ROUND_PRIORITY = 8;

/**
 * Résout la priorité d'un round depuis son libellé BSD/Odds.
 * @param round String libre (ex: "Round of 32", "Demi-finale")
 * @returns 0 (Finale) → 7 (Qualif), 8 si non reconnu
 */
export function resolveRoundPriority(round: string | undefined | null): number {
  if (!round) return DEFAULT_ROUND_PRIORITY;
  for (const { regex, priority } of ROUND_PRIORITY) {
    if (regex.test(round)) return priority;
  }
  return DEFAULT_ROUND_PRIORITY;
}
