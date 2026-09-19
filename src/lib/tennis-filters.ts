/**
 * Filtres partagés pour le widget Top 10 tennis — tournament + time window.
 * Réplique la logique du widget football (football-top10-widget.tsx).
 *
 * Enrichi avec les filtres académiques (revue 2026-09-19) :
 * - Surface filter (Gao 2019 : serve strength by surface)
 * - Market type filter (1xBet markets)
 * - Competitive filter (Clegg 2023 : spread ≤ 2.0)
 * - Edge filter (Hubáček 2020 : decorrelation from market)
 * - Kelly adaptatif (Uhrín 2021 : fractional Kelly)
 * - Tournament category (Grand Slam ≠ Challenger)
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type TennisTimeWindow = "all" | "jour" | "48h" | "semaine";

export type TennisSurface = "hard" | "clay" | "grass" | "indoor" | "all";

export type TennisTournamentCategory =
  | "all"
  | "grand-slam"
  | "atp-1000"
  | "atp-500"
  | "atp-250"
  | "challenger"
  | "itf"
  | "wta";

export type TennisMarketCategory =
  | "all"
  | "match-winner"
  | "set-score"
  | "set-handicap"
  | "game-handicap"
  | "total-games"
  | "total-games-per-set"
  | "aces"
  | "tiebreak"
  | "first-set"
  | "double-result"
  | "live";

/** Ligne de jeux Over/Under pour le marché total-games-per-set. */
export type TennisGameLine = "6.5" | "7.5" | "8.5" | "9.5" | "10.5";

/** Type de bet du joueur (prematch + live). */
export type TennisBetType =
  | "winner"           // Match winner prematch
  | "over-games"       // Over games match prematch
  | "most-aces"        // Player most aces prematch
  | "over-set"         // Over games par set live
  | "set-winner"       // Set winner live
  | "winner-live";     // Match winner live

// ─── Constants ─────────────────────────────────────────────────────────────

export const TENNIS_TIME_WINDOWS: readonly { key: TennisTimeWindow; label: string; title: string }[] = [
  { key: "all", label: "Tout", title: "Tous les matchs" },
  { key: "jour", label: "Jour", title: "Matchs du jour" },
  { key: "48h", label: "48h", title: "Matchs sous 48 heures" },
  { key: "semaine", label: "Sem.", title: "Matchs de la semaine" },
] as const;

export const TENNIS_SURFACES: readonly { key: TennisSurface; label: string; emoji: string }[] = [
  { key: "all", label: "Toutes", emoji: "⬜" },
  { key: "hard", label: "Dur", emoji: "🔷" },
  { key: "clay", label: "Terre", emoji: "🔶" },
  { key: "grass", label: "Herbe", emoji: "🟩" },
  { key: "indoor", label: "Indoor", emoji: "◾" },
] as const;

export const TENNIS_TOURNAMENT_CATEGORIES: readonly { key: TennisTournamentCategory; label: string; emoji: string }[] = [
  { key: "all", label: "Tous", emoji: "◻️" },
  { key: "grand-slam", label: "Grand Slam", emoji: "🏆" },
  { key: "atp-1000", label: "ATP 1000", emoji: "🔷" },
  { key: "atp-500", label: "ATP 500", emoji: "🔹" },
  { key: "atp-250", label: "ATP 250", emoji: "▫️" },
  { key: "wta", label: "WTA", emoji: "🔸" },
  { key: "challenger", label: "Challenger", emoji: "▪️" },
  { key: "itf", label: "ITF", emoji: "◽" },
] as const;

export const TENNIS_MARKET_CATEGORIES: readonly { key: TennisMarketCategory; label: string; emoji: string }[] = [
  { key: "all", label: "Tous marchés", emoji: "◻️" },
  { key: "match-winner", label: "Vainqueur", emoji: "🏆" },
  { key: "set-score", label: "Score exact", emoji: "🎯" },
  { key: "set-handicap", label: "Hdp sets", emoji: "➕" },
  { key: "game-handicap", label: "Hdp jeux", emoji: "➖" },
  { key: "total-games", label: "Total jeux", emoji: "📊" },
  { key: "total-games-per-set", label: "Total/set", emoji: "📈" },
  { key: "aces", label: "Aces", emoji: "⚡" },
  { key: "tiebreak", label: "Tiebreak", emoji: "⏱️" },
  { key: "first-set", label: "1er set", emoji: "1️⃣" },
  { key: "double-result", label: "Double", emoji: "✖️" },
  { key: "live", label: "Live", emoji: "⏺️" },
] as const;

/** Lignes de jeux Over/Under disponibles (1xBet per-set). */
export const TENNIS_GAME_LINES: readonly { key: TennisGameLine; label: string; overProb: string }[] = [
  { key: "6.5", label: "Over 6.5", overProb: "~95%" },
  { key: "7.5", label: "Over 7.5", overProb: "~77%" },
  { key: "8.5", label: "Over 8.5", overProb: "~49%" },
  { key: "9.5", label: "Over 9.5", overProb: "~24%" },
  { key: "10.5", label: "Over 10.5", overProb: "~10%" },
] as const;

/** Types de bets du joueur. */
export const TENNIS_BET_TYPES: readonly { key: TennisBetType; label: string; emoji: string; mode: "prematch" | "live" }[] = [
  { key: "winner", label: "Vainqueur", emoji: "🏆", mode: "prematch" },
  { key: "over-games", label: "Over Games", emoji: "📊", mode: "prematch" },
  { key: "most-aces", label: "Most Aces", emoji: "⚡", mode: "prematch" },
  { key: "over-set", label: "Over/Set", emoji: "📈", mode: "live" },
  { key: "set-winner", label: "Set Winner", emoji: "🎯", mode: "live" },
  { key: "winner-live", label: "Winner Live", emoji: "⏺️", mode: "live" },
] as const;

// ─── Extract tournaments ───────────────────────────────────────────────────

/** Extrait la liste triée des tournois uniques depuis les matchs. */
export function extractTournaments(
  matches: { tournament: string }[],
): string[] {
  const set = new Set(matches.map((m) => m.tournament));
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ─── Extract surfaces ──────────────────────────────────────────────────────

/** Extrait la liste triée des surfaces uniques depuis les matchs. */
export function extractSurfaces(
  matches: { surface?: string }[],
): string[] {
  const set = new Set(matches.map((m) => m.surface ?? "unknown"));
  return [...set].sort();
}

// ─── Filter by tournament ──────────────────────────────────────────────────

/** Filtre les matchs par tournoi exact. null = tous les tournois. */
export function filterByTournament<T extends { tournament: string }>(
  matches: T[],
  tournament: string | null,
): T[] {
  if (!tournament) return matches;
  return matches.filter((m) => m.tournament === tournament);
}

// ─── Filter by surface ─────────────────────────────────────────────────────
// Source : Gao & Kowalczyk (2019) — serve strength varies by surface.

/** Filtre les matchs par surface. "all" = toutes les surfaces. */
export function filterBySurface<T extends { surface?: string }>(
  matches: T[],
  surface: TennisSurface,
): T[] {
  if (surface === "all") return matches;
  return matches.filter((m) => (m.surface ?? "").toLowerCase() === surface);
}

// ─── Filter by tournament category ─────────────────────────────────────────
// Source : Clegg & Cartlidge (2023) — competitive matches have different dynamics.

/** Filtre les matchs par catégorie de tournoi. */
export function filterByTournamentCategory<T extends { tournament: string; round?: string }>(
  matches: T[],
  category: TennisTournamentCategory,
): T[] {
  if (category === "all") return matches;
  const slug = category.toLowerCase();
  return matches.filter((m) => {
    const t = m.tournament.toLowerCase();
    if (slug === "grand-slam") {
      return /australian|roland.garros|wimbledon|us.open/i.test(t);
    }
    if (slug === "atp-1000") return /masters|1000/i.test(t);
    if (slug === "atp-500") return /500/i.test(t);
    if (slug === "atp-250") return /250/i.test(t);
    if (slug === "wta") return /wta/i.test(t);
    if (slug === "challenger") return /challenger/i.test(t);
    if (slug === "itf") return /itf|m15|w15|m25|w25/i.test(t);
    return true;
  });
}

// ─── Filter by market category ─────────────────────────────────────────────

/** Filtre les marchés par catégorie 1xBet. */
export function filterByMarketCategory<T extends { category: string }>(
  markets: T[],
  category: TennisMarketCategory,
): T[] {
  if (category === "all") return markets;
  return markets.filter((m) => m.category === category);
}

// ─── Filter by time window ─────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Filtre les matchs par fenêtre temporelle. */
export function filterByTimeWindow<T extends { scheduledAt: string }>(
  matches: T[],
  window: TennisTimeWindow,
): T[] {
  if (window === "all") return matches;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const t0 = startOfDay.getTime();
  let end: number;
  switch (window) {
    case "jour":
      end = t0 + DAY_MS;
      break;
    case "48h":
      end = t0 + 2 * DAY_MS;
      break;
    case "semaine":
      end = t0 + 7 * DAY_MS;
      break;
    default:
      return matches;
  }
  return matches.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return Number.isFinite(t) && t >= t0 && t < end;
  });
}

// ─── Competitive match filter ──────────────────────────────────────────────
// Source : Clegg & Cartlidge (2023) — competitive matches offer more value.

/** Filtre les matchs "compétitifs" (spread de cotes ≤ maxSpread). */
export function filterByCompetitiveness<T extends { oddsHome?: number; oddsAway?: number }>(
  matches: T[],
  maxSpread: number = 2.0,
): T[] {
  return matches.filter((m) => {
    if (!m.oddsHome || !m.oddsAway) return true; // pas de cotes = garder
    const spread = Math.max(m.oddsHome, m.oddsAway) / Math.min(m.oddsHome, m.oddsAway);
    return spread <= maxSpread;
  });
}

// ─── Edge filter ────────────────────────────────────────────────────────────
// Source : Hubáček & Šír (2020) — decorrelation from market.

/** Filtre les matchs avec un edge minimum. */
export function filterByMinEdge<T extends { edge?: number }>(
  matches: T[],
  minEdge: number = 0.03,
): T[] {
  return matches.filter((m) => (m.edge ?? 0) >= minEdge);
}

// ─── Kelly fraction filter ─────────────────────────────────────────────────
// Source : Uhrín et al. (2021) — adaptive fractional Kelly.

/** Filtre les matchs avec une fraction Kelly minimum. */
export function filterByMinKelly<T extends { kellyFraction?: number }>(
  matches: T[],
  minKelly: number = 0.01,
): T[] {
  return matches.filter((m) => (m.kellyFraction ?? 0) >= minKelly);
}

// ─── Surface factor for Elo/Hold% ──────────────────────────────────────────
// Source : Gao & Kowalczyk (2019) — serve strength varies by surface.

/** Facteur multiplicatif par surface pour les stats serveur. */
export function surfaceFactor(surface: string): number {
  switch (surface.toLowerCase()) {
    case "grass": return 1.15;   // service dominant
    case "hard": return 1.0;     // référence
    case "indoor": return 1.05;  // légèrement favorable au service
    case "clay": return 0.85;    // retour dominant
    default: return 1.0;
  }
}

/** Facteur multiplicatif par surface pour les aces. */
export function surfaceAceFactor(surface: string): number {
  switch (surface.toLowerCase()) {
    case "grass": return 1.3;    // beaucoup plus d'aces
    case "hard": return 1.0;     // référence
    case "indoor": return 1.1;   // légèrement plus
    case "clay": return 0.7;     // beaucoup moins
    default: return 1.0;
  }
}

// ─── Tournament category weight ────────────────────────────────────────────
// Poids décroissant selon la catégorie (Grand Slam = plus fiable).

/** Poids de fiabilité selon la catégorie de tournoi. */
export function tournamentCategoryWeight(tournament: string): number {
  const t = tournament.toLowerCase();
  if (/australian|roland.garros|wimbledon|us.open/i.test(t)) return 1.0;
  if (/masters|1000/i.test(t)) return 0.9;
  if (/500/i.test(t)) return 0.8;
  if (/250/i.test(t)) return 0.7;
  if (/wta/i.test(t)) return 0.75;
  if (/challenger/i.test(t)) return 0.6;
  if (/itf|m15|w15|m25|w25/i.test(t)) return 0.5;
  return 0.7;
}
