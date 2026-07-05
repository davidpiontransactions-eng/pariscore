// Real Elo history backend.
//
// All 6 players we track — ATP (Alcaraz, Rublev, Sinner, Medvedev) and
// WTA (Sabalenka, Osaka) — get a real Elo history computed offline by
// `scripts/fetch-tennis-data.ts`. The script replays 3 years (2023–2025)
// of Jeff Sackmann's tennis_atp and tennis_wta match CSVs (canonical
// URLs first, then verified GitHub forks — see the script header for
// the exact source list) through a standard Elo update (K=32, denom=400,
// start=1500) and writes the per-player progression to `elo-data.json`
// (committed to the repo).
//
// The synthetic mock history defined below is only kept as a defensive
// fallback for any player id that is ever absent from `elo-data.json`
// (e.g. JSON missing or corrupted, or a new player added to
// tennis-data.ts before the next fetch run). It is NOT used by any of
// the 6 current players in production.
//
// Output shape (`PlayerEloHistory`) is unchanged from the previous mock
// implementation — the API contract for `/api/tennis/elo-history` is
// preserved.

import type { Player } from "@/lib/tennis-data";
import realEloData from "./elo-data.json";

export type EloHistoryPoint = {
  date: string; // ISO
  elo: number;
};

export type PlayerEloHistory = {
  playerId: string;
  currentElo: number;
  history: EloHistoryPoint[];
};

// ---------------------------------------------------------------------------
// Real computed Elo (from scripts/fetch-tennis-data.ts → elo-data.json)
// ---------------------------------------------------------------------------

type RealPlayerHistory = {
  name: string;
  currentElo: number;
  history: Array<{ date: string; elo: number }>;
};

const REAL_PLAYERS: Record<string, RealPlayerHistory> =
  (realEloData as {
    players: Record<string, RealPlayerHistory>;
  }).players ?? {};

const REAL_PLAYER_IDS = new Set(Object.keys(REAL_PLAYERS));

// Seed match history per player (last 12 months, ~25 matches/year for top players).
//
// DEFENSIVE FALLBACK ONLY — all 6 current players (sabalenka, osaka,
// alcaraz, rublev, sinner, medvedev) have real Elo in elo-data.json and
// never reach this branch. This dict is kept so an unknown player id
// (e.g. tennis-data.ts gets a new player before the next fetch run, or
// elo-data.json is missing) degrades gracefully to a plausible
// reverse-computed progression instead of returning an empty history.
const PLAYER_HISTORIES: Record<string, { opponentElo: number; result: "W" | "L"; daysAgo: number }[]> = {
  sabalenka: [
    { opponentElo: 1980, result: "W", daysAgo: 5 },
    { opponentElo: 2050, result: "W", daysAgo: 12 },
    { opponentElo: 2100, result: "W", daysAgo: 19 },
    { opponentElo: 1950, result: "W", daysAgo: 26 },
    { opponentElo: 2200, result: "W", daysAgo: 33 },
    { opponentElo: 2400, result: "L", daysAgo: 40 },
    { opponentElo: 1980, result: "W", daysAgo: 50 },
    { opponentElo: 2080, result: "W", daysAgo: 60 },
    { opponentElo: 1950, result: "W", daysAgo: 75 },
    { opponentElo: 2150, result: "W", daysAgo: 90 },
    { opponentElo: 2200, result: "L", daysAgo: 105 },
    { opponentElo: 1980, result: "W", daysAgo: 120 },
    { opponentElo: 2050, result: "W", daysAgo: 140 },
    { opponentElo: 1900, result: "W", daysAgo: 160 },
    { opponentElo: 2150, result: "W", daysAgo: 180 },
    { opponentElo: 2300, result: "L", daysAgo: 200 },
    { opponentElo: 1980, result: "W", daysAgo: 220 },
    { opponentElo: 2050, result: "W", daysAgo: 240 },
    { opponentElo: 1950, result: "W", daysAgo: 260 },
    { opponentElo: 2200, result: "L", daysAgo: 285 },
    { opponentElo: 1980, result: "W", daysAgo: 310 },
    { opponentElo: 2050, result: "W", daysAgo: 335 },
    { opponentElo: 1950, result: "W", daysAgo: 360 },
  ],
  osaka: [
    { opponentElo: 1800, result: "L", daysAgo: 5 },
    { opponentElo: 1750, result: "W", daysAgo: 12 },
    { opponentElo: 1850, result: "W", daysAgo: 19 },
    { opponentElo: 1900, result: "L", daysAgo: 26 },
    { opponentElo: 1750, result: "W", daysAgo: 33 },
    { opponentElo: 1800, result: "W", daysAgo: 50 },
    { opponentElo: 1700, result: "L", daysAgo: 70 },
    { opponentElo: 1850, result: "W", daysAgo: 90 },
    { opponentElo: 1750, result: "W", daysAgo: 110 },
    { opponentElo: 1950, result: "L", daysAgo: 130 },
    { opponentElo: 1800, result: "W", daysAgo: 155 },
    { opponentElo: 1700, result: "W", daysAgo: 180 },
    { opponentElo: 1850, result: "L", daysAgo: 210 },
    { opponentElo: 1750, result: "W", daysAgo: 240 },
    { opponentElo: 1900, result: "L", daysAgo: 270 },
    { opponentElo: 1700, result: "W", daysAgo: 300 },
    { opponentElo: 1800, result: "W", daysAgo: 330 },
    { opponentElo: 1750, result: "W", daysAgo: 360 },
  ],
  alcaraz: [
    { opponentElo: 2100, result: "W", daysAgo: 5 },
    { opponentElo: 2200, result: "W", daysAgo: 12 },
    { opponentElo: 2050, result: "W", daysAgo: 19 },
    { opponentElo: 2150, result: "W", daysAgo: 26 },
    { opponentElo: 2250, result: "W", daysAgo: 33 },
    { opponentElo: 2000, result: "W", daysAgo: 40 },
    { opponentElo: 2300, result: "W", daysAgo: 50 },
    { opponentElo: 2200, result: "W", daysAgo: 60 },
    { opponentElo: 2150, result: "W", daysAgo: 75 },
    { opponentElo: 2100, result: "W", daysAgo: 90 },
  ],
  rublev: [
    { opponentElo: 1950, result: "W", daysAgo: 5 },
    { opponentElo: 2050, result: "L", daysAgo: 12 },
    { opponentElo: 2000, result: "W", daysAgo: 19 },
    { opponentElo: 2100, result: "W", daysAgo: 26 },
    { opponentElo: 2200, result: "L", daysAgo: 33 },
    { opponentElo: 1950, result: "W", daysAgo: 50 },
    { opponentElo: 2050, result: "L", daysAgo: 70 },
    { opponentElo: 2000, result: "W", daysAgo: 90 },
    { opponentElo: 2150, result: "W", daysAgo: 110 },
    { opponentElo: 1900, result: "L", daysAgo: 130 },
    { opponentElo: 2000, result: "W", daysAgo: 155 },
    { opponentElo: 1950, result: "W", daysAgo: 180 },
    { opponentElo: 2050, result: "L", daysAgo: 210 },
    { opponentElo: 2000, result: "W", daysAgo: 240 },
  ],
  sinner: [
    { opponentElo: 2200, result: "W", daysAgo: 5 },
    { opponentElo: 2150, result: "W", daysAgo: 12 },
    { opponentElo: 2300, result: "W", daysAgo: 19 },
    { opponentElo: 2100, result: "L", daysAgo: 26 },
    { opponentElo: 2200, result: "W", daysAgo: 33 },
    { opponentElo: 2250, result: "W", daysAgo: 40 },
    { opponentElo: 2150, result: "W", daysAgo: 50 },
    { opponentElo: 2050, result: "W", daysAgo: 60 },
    { opponentElo: 2200, result: "L", daysAgo: 75 },
    { opponentElo: 2150, result: "W", daysAgo: 90 },
    { opponentElo: 2300, result: "W", daysAgo: 110 },
    { opponentElo: 2200, result: "L", daysAgo: 130 },
    { opponentElo: 2100, result: "W", daysAgo: 155 },
    { opponentElo: 2250, result: "W", daysAgo: 180 },
    { opponentElo: 2150, result: "W", daysAgo: 210 },
    { opponentElo: 2200, result: "L", daysAgo: 240 },
    { opponentElo: 2050, result: "W", daysAgo: 270 },
    { opponentElo: 2150, result: "W", daysAgo: 300 },
    { opponentElo: 2100, result: "W", daysAgo: 330 },
    { opponentElo: 2200, result: "L", daysAgo: 360 },
  ],
  medvedev: [
    { opponentElo: 2050, result: "W", daysAgo: 5 },
    { opponentElo: 2100, result: "W", daysAgo: 12 },
    { opponentElo: 2000, result: "L", daysAgo: 19 },
    { opponentElo: 2150, result: "W", daysAgo: 26 },
    { opponentElo: 2200, result: "W", daysAgo: 33 },
    { opponentElo: 2050, result: "L", daysAgo: 50 },
    { opponentElo: 2100, result: "W", daysAgo: 70 },
    { opponentElo: 2150, result: "W", daysAgo: 90 },
    { opponentElo: 2000, result: "L", daysAgo: 110 },
    { opponentElo: 2200, result: "W", daysAgo: 130 },
    { opponentElo: 2050, result: "W", daysAgo: 155 },
    { opponentElo: 2100, result: "L", daysAgo: 180 },
    { opponentElo: 2150, result: "W", daysAgo: 210 },
    { opponentElo: 2000, result: "W", daysAgo: 240 },
    { opponentElo: 2200, result: "L", daysAgo: 270 },
    { opponentElo: 2100, result: "W", daysAgo: 300 },
    { opponentElo: 2050, result: "W", daysAgo: 330 },
    { opponentElo: 2150, result: "L", daysAgo: 360 },
  ],
};

const ELO_K = 32;
const ELO_DENO = 400;

/**
 * Compute (or look up) a player's Elo history.
 *
 * For the 6 players present in `elo-data.json` — ATP (Alcaraz, Rublev,
 * Sinner, Medvedev) and WTA (Sabalenka, Osaka) — this returns the
 * **real** history computed offline from Jeff Sackmann's tennis_atp and
 * tennis_wta match CSVs (3-year window, 2023–2025; see
 * `scripts/fetch-tennis-data.ts` for the canonical → mirror source
 * fallback chain actually used).
 *
 * For any other player id (defensive fallback for unknown players, or
 * if `elo-data.json` is ever missing/corrupted) we use the synthetic
 * mock history below — a reverse-compute from `player.elo` using a
 * 3-iteration fixed-point approximation.
 *
 * The returned shape (`PlayerEloHistory`) is identical in both cases,
 * so the API contract for `/api/tennis/elo-history` is unchanged.
 */
export function computeEloHistory(player: Player): PlayerEloHistory {
  // --- Real Elo path -----------------------------------------------------
  if (REAL_PLAYER_IDS.has(player.id)) {
    const real = REAL_PLAYERS[player.id];
    // Defensive copy so callers can't mutate the JSON module cache.
    const history: EloHistoryPoint[] = real.history.map((p) => ({
      date: p.date,
      elo: p.elo,
    }));
    return {
      playerId: player.id,
      currentElo: real.currentElo,
      history,
    };
  }

  // --- Mock fallback (defensive — unknown player id, or elo-data.json
  //     missing/corrupted). NOT reached by any of the 6 current players.)
  const matches = PLAYER_HISTORIES[player.id] ?? [];
  if (matches.length === 0) {
    return { playerId: player.id, currentElo: player.elo, history: [] };
  }

  // Sort by daysAgo descending (oldest first)
  const sorted = [...matches].sort((a, b) => b.daysAgo - a.daysAgo);

  // Reverse-compute: start from current Elo, apply reverse Elo updates.
  // If player won at time T against opponent with Elo X:
  //   currentElo = oldElo + K * (1 - expected)
  //   → oldElo = currentElo - K * (1 - expected)
  // where expected = 1 / (1 + 10^((X - oldElo) / 400))
  // We use a fixed-point iteration to converge on the pre-match Elo.

  let elo = player.elo;
  const points: EloHistoryPoint[] = [];
  const now = Date.now();
  const DAY_MS = 86400000;

  // Walk backward from current → each match's pre-match Elo
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    // Estimate pre-match elo via 3 fixed-point iterations
    let preMatchElo = elo;
    for (let iter = 0; iter < 3; iter++) {
      const expected = 1 / (1 + Math.pow(10, (m.opponentElo - preMatchElo) / ELO_DENO));
      const delta = ELO_K * (m.result === "W" ? 1 - expected : -expected);
      preMatchElo = elo - delta;
    }
    points.unshift({
      date: new Date(now - m.daysAgo * DAY_MS).toISOString(),
      elo: Math.round(preMatchElo),
    });
    elo = preMatchElo;
  }
  // Add the current point (today)
  points.push({ date: new Date().toISOString(), elo: player.elo });

  return {
    playerId: player.id,
    currentElo: player.elo,
    history: points,
  };
}

/**
 * Get Elo history for both players in a match.
 */
export function getMatchEloHistories(playerA: Player, playerB: Player) {
  return {
    a: computeEloHistory(playerA),
    b: computeEloHistory(playerB),
  };
}
