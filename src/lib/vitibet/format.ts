// Helpers d'affichage des indicateurs Vitibet (partagés carte match + Top 10).

/** Ton du badge INDEX : > +5 favori domicile, < -5 favori extérieur, sinon neutre. */
export function indexTone(indexValue: number | null): "home" | "away" | "neutral" {
  if (indexValue != null && indexValue > 5) return "home";
  if (indexValue != null && indexValue < -5) return "away";
  return "neutral";
}

/** INDEX signé (+8.96 / -21.82) — « – » si absent (jamais de valeur inventée). */
export function fmtIndex(indexValue: number | null): string {
  if (indexValue == null) return "–";
  const s = indexValue.toFixed(2);
  return indexValue > 0 ? `+${s}` : s;
}
