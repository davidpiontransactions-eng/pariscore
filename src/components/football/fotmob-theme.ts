// Thème clair FotMob partagé — îlot calendrier + popup live.
// Carte #fff, bordure #f0f0f0, aplats #f5f5f5, encre #222/#717171,
// barres domicile #1a1a1a / extérieur #bdbdbd, accent live #00985f.
// Source unique (P1 SESSION-2026-09-09-POPUP-LIVE-FOOT-innovations) —
// ne pas dupliquer ces tokens dans les composants, importer d'ici.

export const FOT = {
  card: "#ffffff",
  border: "#f0f0f0",
  soft: "#f5f5f5",
  ink: "#222222",
  muted: "#717171",
  home: "#1a1a1a",
  away: "#bdbdbd",
  live: "#00985f",
  liveSoft: "#f2faf5",
} as const;

/** Style carte blanche standard du popup. */
export const fotCard = {
  backgroundColor: FOT.card,
  borderColor: FOT.border,
} as const;

/** Largeur domicile % pour barres bilatérales (50 si total nul). */
export function fotHomePct(home: number, away: number): number {
  const t = home + away;
  if (!Number.isFinite(t) || t <= 0) return 50;
  return Math.max(0, Math.min(100, (home / t) * 100));
}
