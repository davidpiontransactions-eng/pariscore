/**
 * Extrait l'ID BSD numérique depuis un match.id formaté "bsd-33487".
 * Retourne null si l'ID n'est pas un entier strictement positif.
 */
export function parseBsdId(matchId: string): number | null {
  if (!matchId) return null;
  const stripped = matchId.replace(/^bsd-/, "");
  if (!/^\d+$/.test(stripped)) return null;
  const num = Number.parseInt(stripped, 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}