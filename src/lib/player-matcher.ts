// Player name matcher for real-API → elo-data.json resolution.
//
// The Odds API returns player names in various formats:
//   - "Aryna Sabalenka" (full)
//   - "A. Sabalenka" (initial + surname)
//   - "Sabalenka A." (surname + initial)
//   - all-caps, mixed-case, with/without diacritics
//
// `elo-data.json` is keyed by canonical id (sabalenka, osaka, alcaraz,
// rublev, sinner, medvedev) with the player's full display name in
// `name`. This module bridges the two with fuzzy matching.
//
// The matching strategy is intentionally lightweight (no external
// dependencies): normalize both sides (lowercase, strip diacritics,
// strip punctuation), then try — in order — exact match, surname
// substring match, initial+surname match. Returns null if no match.

import realEloData from "@/lib/prediction/elo-data.json";
import type { EloHistoryPoint } from "@/lib/prediction/elo-history";

type RealPlayerHistory = {
  name: string;
  currentElo: number;
  history: Array<{ date: string; elo: number }>;
};

const REAL_PLAYERS: Record<string, RealPlayerHistory> =
  (realEloData as {
    players: Record<string, RealPlayerHistory>;
  }).players ?? {};

// Inverted index: normalized player name → player id. Built once at
// module load. Re-exported for callers that need to iterate all known
// players.
const NAME_INDEX: Array<{ id: string; name: string; normalized: string; surname: string; initials: string[] }> = (() => {
  const out: Array<{ id: string; name: string; normalized: string; surname: string; initials: string[] }> = [];
  for (const [id, h] of Object.entries(REAL_PLAYERS)) {
    const parts = h.name.split(/\s+/).filter(Boolean);
    const surname = parts[parts.length - 1] ?? h.name;
    const initials = parts.slice(0, -1).map((p) => p[0]?.toLowerCase() ?? "");
    out.push({
      id,
      name: h.name,
      normalized: normalize(h.name),
      surname: normalize(surname),
      initials,
    });
  }
  return out;
})();

export type PlayerEloMatch = {
  /** Canonical id from elo-data.json (e.g. "sabalenka"). */
  id: string;
  /** Canonical display name (e.g. "Aryna Sabalenka"). */
  name: string;
  /** Overall Elo (latest). */
  elo: number;
  /** Surface-specific Elo — for real-API matches we don't know the
   * upcoming surface precisely, so we return the overall Elo as a
   * reasonable default. The prediction engine blends this at
   * SURFACE_WEIGHT = 0.55. */
  surfaceElo: number;
  /** Full Elo history (oldest → newest). */
  history: EloHistoryPoint[];
};

/**
 * Find a player's Elo data by fuzzy name matching against
 * `elo-data.json`. Returns null if no match.
 *
 * Matching order (each step case- and diacritic-insensitive):
 *   1. Exact normalized name match (e.g. "Aryna Sabalenka")
 *   2. Surname substring match (e.g. "Sabalenka" or "A. Sabalenka")
 *   3. Initial+surname pattern (e.g. "A Sabalenka" matches
 *      "Aryna Sabalenka" if "a" is one of Aryna's initials)
 *   4. Surname prefix match (handles slight spelling variations)
 */
export function findPlayerElo(name: string): PlayerEloMatch | null {
  if (!name || !name.trim()) return null;

  const n = normalize(name);
  if (!n) return null;

  // 1. Exact normalized name match
  for (const entry of NAME_INDEX) {
    if (entry.normalized === n) {
      return toEloMatch(entry.id);
    }
  }

  // 2. Surname substring — handles "Sabalenka" or "A. Sabalenka"
  //    (the surname is a substring of the API name).
  for (const entry of NAME_INDEX) {
    if (entry.surname.length < 4) continue;
    if (n.includes(entry.surname) || entry.normalized.includes(n)) {
      return toEloMatch(entry.id);
    }
  }

  // 3. Initial + surname pattern (e.g. "a sabalenka")
  //    API returns "A. Sabalenka" → normalized "a sabalenka".
  //    Check that the first letter matches one of the player's
  //    initials AND the surname matches.
  const apiTokens = n.split(" ").filter(Boolean);
  if (apiTokens.length >= 2) {
    const apiFirst = apiTokens[0];
    const apiSurname = apiTokens[apiTokens.length - 1];
    for (const entry of NAME_INDEX) {
      if (apiSurname.length < 4) continue;
      if (!entry.surname.includes(apiSurname) && !apiSurname.includes(entry.surname)) {
        continue;
      }
      // First token of length 1 → initial; check it's in player's initials
      if (apiFirst.length === 1 && entry.initials.includes(apiFirst)) {
        return toEloMatch(entry.id);
      }
      // Otherwise, accept if surname matches strongly (length ≥ 4)
      if (apiSurname.length >= 4 && entry.surname.includes(apiSurname)) {
        return toEloMatch(entry.id);
      }
    }
  }

  // 4. Surname prefix match — handle minor spelling variations
  //    (e.g. "Medvedev" vs "Medvedev D.").
  for (const entry of NAME_INDEX) {
    if (entry.surname.length < 5) continue;
    if (entry.surname.startsWith(n) || n.startsWith(entry.surname)) {
      return toEloMatch(entry.id);
    }
  }

  return null;
}

/**
 * Extract the last N wins/losses (most recent last) from a player's
 * Elo history. Used as the form signal for the prediction engine when
 * the player is in elo-data.json.
 *
 * The Elo history records each match the player played, in
 * chronological order. We infer W/L by comparing consecutive Elo
 * points: a rise = W, a drop = L.
 */
export function extractFormFromHistory(
  history: EloHistoryPoint[],
  windowSize = 6
): ("W" | "L")[] {
  if (!history || history.length < 2) return [];
  const recent = history.slice(-windowSize - 1); // need windowSize+1 points for windowSize results
  const out: ("W" | "L")[] = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].elo;
    const curr = recent[i].elo;
    if (curr > prev) out.push("W");
    else if (curr < prev) out.push("L");
    // Equal Elo (rare — e.g. retirements) → skip
  }
  return out;
}

// --- Internals -----------------------------------------------------------

function toEloMatch(id: string): PlayerEloMatch | null {
  const h = REAL_PLAYERS[id];
  if (!h) return null;
  return {
    id,
    name: h.name,
    elo: h.currentElo,
    // We don't have per-surface Elo in elo-data.json — fall back to
    // the overall Elo. The prediction engine blends it at 0.55 weight.
    surfaceElo: h.currentElo,
    history: h.history.map((p) => ({ date: p.date, elo: p.elo })),
  };
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9 ]/gi, " ") // replace punctuation with space
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
