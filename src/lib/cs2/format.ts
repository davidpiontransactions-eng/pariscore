/**
 * Helpers de formatage CS2 — anti-flottants, lissage bayésien des winrates.
 */

/** Tokens affichés en majuscules (acronymes / stylisation des structures CS2). */
const ALL_CAPS_TOKENS = new Set([
  "g2", "big", "furia", "mouz", "ence", "3dmax", "saw", "ic",
  "nip", "vp", "c9", "iem", "esl", "blast", "pgl", "eswc",
]);

/** "infurity gaming" → "Infurity Gaming", "ic prospects" → "IC Prospects". */
export function displayTeamName(name: string | null | undefined): string {
  if (!name) return "TBD";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (ALL_CAPS_TOKENS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Abréviation 3 lettres compacte pour badges ("IC Prospects" → "ICP"). */
export function abbrevTeamName(name: string | null | undefined): string {
  return displayTeamName(name).replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

/**
 * Formate un winrate % pour affichage : null/NaN → "—", sinon entier arrondi.
 * Interdit tout flottant non formaté.
 */
export function formatCS2Winrate(wr: number | null | undefined): string {
  if (wr == null || !Number.isFinite(wr)) return "—";
  const rounded = Math.round(Math.max(0, Math.min(100, wr)));
  return `${rounded}%`;
}

/**
 * Lissage bayésien des extrêmes (0% et 100% sont des artefacts d'échantillon
 * insuffisant — 1 seul match). Faute de taille d'échantillon par carte (non
 * exposée par le pipeline HLTV), on ramène les extrêmes vers 50% (prior) :
 *   [90,100] → [90,95]  (100% → 95%)
 *   [0,10]   → [5,10]   (0% → 5%)
 * La zone médiane 10-90% reste intacte (simple arrondi).
 */
export function smoothWinrate(wr: number | null | undefined): number | null {
  if (wr == null || !Number.isFinite(wr)) return null;
  const w = Math.max(0, Math.min(100, wr));
  if (w >= 90) return Math.round(90 + (w - 90) * 0.5);
  if (w <= 10) return Math.round(10 - (10 - w) * 0.5);
  return Math.round(w);
}

/** Formate une probabilité (0-1) en % arrondi, garde-fou NaN. */
export function formatProbability(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}
