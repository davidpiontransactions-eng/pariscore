// BSD Sports API fetcher — tennis matches from sports.bzzoiro.com
// Priority source: BSD > The Odds API > Mock

import type { TennisMatch, BookmakerOdd, Player, Surface, MatchStats, H2HMatch } from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";
import { findPlayerElo } from "@/lib/player-matcher";
import { resolvePlayerPhoto } from "@/lib/player-photos";

/** Tournois à exclure (UTR Pro, exhibitions) */
const EXCLUDED_TOURNAMENTS = [/utr/i, /exhibition/i, /expo/i, /hopman/i, /laver\s*cup/i];

function isExcludedTournament(name?: string): boolean {
  if (!name) return false;
  return EXCLUDED_TOURNAMENTS.some((re) => re.test(name));
}

const BSD_BASE = "https://sports.bzzoiro.com/tennis";
const BSD_PHOTO_BASE = "https://sports.bzzoiro.com/img/tennis-player";

type BSDResponse = {
  id: string;
  player1?: { name: string; id?: string };
  player2?: { name: string; id?: string };
  tournament?: { name?: string; surface?: string };
  status?: string;
  start_time?: string;
  commence_time?: string;
  round?: string;
  odds?: Array<{ bookmaker: string; player1_odds: number; player2_odds: number }>;
};

function normalizeSurface(s?: string): Surface {
  if (!s) return "Dur";
  const lower = s.toLowerCase();
  if (lower.includes("grass") || lower.includes("gazon")) return "Gazon";
  if (lower.includes("clay") || lower.includes("terre")) return "Terre battue";
  return "Dur";
}

function computeImpliedProbs(decimalA: number, decimalB: number): { a: number; b: number; margin: number } {
  const invA = 1 / decimalA;
  const invB = 1 / decimalB;
  const vig = invA + invB;
  return {
    a: Math.round((invA / vig) * 100),
    b: Math.round((invB / vig) * 100),
    margin: Math.round((vig - 1) * 1000) / 1000,
  };
}

function generateColor(name: string): string {
  // Hash name to generate a consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#1B4332", "#5C2D91", "#B91C1C", "#0E7490", "#EA580C", "#1D4ED8", "#7C3AED", "#DB2777"];
  return colors[Math.abs(hash) % colors.length];
}

async function bsdFetch(endpoint: string): Promise<BSDResponse[]> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");

  const url = `${BSD_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${key}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 402) {
    console.error("[bsd] Sports Addon required — upgrade at https://sports.bzzoiro.com/pricing/");
    throw new Error("BSD Sports Addon required (402)");
  }
  if (res.status === 429) {
    throw new Error("BSD rate limited (429)");
  }
  if (!res.ok) {
    throw new Error(`BSD HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

function buildMatch(b: BSDResponse, index: number): TennisMatch | null {
  if (!b.player1?.name || !b.player2?.name) return null;

  const nameA = b.player1.name;
  const nameB = b.player2.name;
  const surface = normalizeSurface(b.tournament?.surface);

  // Find Elo data
  const eloA = findPlayerElo(nameA);
  const eloB = findPlayerElo(nameB);

  const playerAInputs: PlayerInputs = {
    id: b.player1.id ?? nameA.toLowerCase().replace(/\s+/g, "_"),
    name: nameA,
    elo: eloA?.elo ?? 1500,
    surfaceElo: eloA?.surfaceElo ?? eloA?.elo ?? 1500,
    form: eloA ? extractForm(eloA.history) : ["W", "L", "W", "L", "W", "L"],
    h2h: { won: 3, lost: 2 },
  };
  const playerBInputs: PlayerInputs = {
    id: b.player2.id ?? nameB.toLowerCase().replace(/\s+/g, "_"),
    name: nameB,
    elo: eloB?.elo ?? 1500,
    surfaceElo: eloB?.surfaceElo ?? eloB?.elo ?? 1500,
    form: eloB ? extractForm(eloB.history) : ["L", "W", "L", "W", "L", "W"],
    h2h: { won: 2, lost: 3 },
  };

  const pred = predict(playerAInputs, playerBInputs);

  const colorA = generateColor(nameA);
  const colorB = generateColor(nameB);

  // Build odds from BSD or compute implied
  let allOdds: BookmakerOdd[] = [];
  if (b.odds && b.odds.length > 0) {
    allOdds = b.odds.map((o) => {
      const probs = computeImpliedProbs(o.player1_odds, o.player2_odds);
      return {
        bookmaker: o.bookmaker,
        decimalA: o.player1_odds,
        decimalB: o.player2_odds,
        impliedProbA: probs.a,
        impliedProbB: probs.b,
        margin: probs.margin,
      };
    });
  }

  const playerA: Player = {
    id: playerAInputs.id,
    name: nameA,
    shortName: nameA.split(" ").slice(-1)[0].toUpperCase(),
    rank: 0,
    elo: playerAInputs.elo,
    surfaceElo: playerAInputs.surfaceElo,
    photoUrl: b.player1.id
      ? `${BSD_PHOTO_BASE}/${encodeURIComponent(b.player1.id)}/?bg=transparent`
      : resolvePlayerPhoto(nameA),
    color: colorA,
    form: playerAInputs.form,
  };

  const playerB: Player = {
    ...playerA,
    id: playerBInputs.id,
    name: nameB,
    shortName: nameB.split(" ").slice(-1)[0].toUpperCase(),
    elo: playerBInputs.elo,
    surfaceElo: playerBInputs.surfaceElo,
    photoUrl: b.player2.id
      ? `${BSD_PHOTO_BASE}/${encodeURIComponent(b.player2.id)}/?bg=transparent`
      : resolvePlayerPhoto(nameB),
    color: colorB,
    form: playerBInputs.form,
  };

  const stats: MatchStats = {
    form: `${playerAInputs.form.filter((f) => f === "W").length}V-${playerAInputs.form.filter((f) => f === "L").length}D`,
    eloGap: pred.eloGap,
    surface,
    h2h: "3-2",
    ic: pred.ic,
    confidence: pred.confidence,
  };

  return {
    id: `bsd-${b.id ?? index}`,
    tournament: b.tournament?.name ?? "Tennis",
    round: b.round ?? "Prematch",
    scheduledAt: b.start_time ?? b.commence_time ?? new Date().toISOString(),
    playerA,
    playerB,
    probA: pred.probA,
    probB: pred.probB,
    stats,
    model: pred.model,
    modelUpdatedAt: new Date().toISOString(),
    allOdds,
    odds: allOdds[0]
      ? { bookmaker: allOdds[0].bookmaker, decimalA: allOdds[0].decimalA, decimalB: allOdds[0].decimalB }
      : undefined,
  };
}

function extractForm(history: { elo: number; date: string }[]): ("W" | "L")[] {
  if (history.length < 2) return ["W", "L", "W", "L", "W", "L"];
  // Infer form from Elo progression: if Elo went up = W, down = L
  const recent = history.slice(-7);
  const form: ("W" | "L")[] = [];
  for (let i = 1; i < recent.length; i++) {
    form.push(recent[i].elo >= recent[i - 1].elo ? "W" : "L");
  }
  return form.slice(-6);
}

export async function fetchBSDMatches(): Promise<TennisMatch[]> {
  const matches = await bsdFetch("/api/v2/matches/?status=scheduled&limit=200");

  const tennisMatches: TennisMatch[] = [];
  for (let i = 0; i < matches.length && tennisMatches.length < 30; i++) {
    const bsdMatch = matches[i];
    if (isExcludedTournament(bsdMatch.tournament?.name)) continue;
    const m = buildMatch(matches[i], i);
    if (m) tennisMatches.push(m);
  }

  if (tennisMatches.length === 0) {
    throw new Error("BSD returned no valid matches");
  }

  console.log(`[bsd] Fetched ${tennisMatches.length} matches`);
  return tennisMatches;
}
