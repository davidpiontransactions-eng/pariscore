// BSD Sports API fetcher — tennis matches from sports.bzzoiro.com
// Priority source: BSD > The Odds API > Mock

import type { TennisMatch, BookmakerOdd, Player, Surface, MatchStats, H2HMatch } from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";
import { findPlayerElo } from "@/lib/player-matcher";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import { resolveTournamentCategory, resolveTournamentPriority } from "@/lib/tournament-priority";

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

  // R5 hotfix : résolution catégorie + priorité tournoi pour le tri par prestige
  const tournamentName = b.tournament?.name ?? "Tennis";

  return {
    id: `bsd-${b.id ?? index}`,
    tournament: tournamentName,
    tournamentCategory: resolveTournamentCategory(tournamentName),
    tournamentPriority: resolveTournamentPriority(tournamentName),
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

// ─── Live matches (BSD /api/v2/matches/live/) ───────────────────────────────

export type LiveMatchItem = {
  id: string;
  playerA: { name: string };
  playerB: { name: string };
  setsDetail: Array<{ p1: number; p2: number }>;
  currentGame: { p1: number; p2: number };
  currentPoint: { p1: number; p2: number };
  currentSet: number; // 0-indexed (0 = set 1)
  server: "A" | "B";
  liveProbA: number;
  liveProbB: number;
  isLive: boolean;
  /** Nom du tournoi BSD (R7.3) — ex: "Segovia, Spain", "UTR PTT Waco Men 02".
   *  Extrait depuis m.tournament.name pour remplacer le fallback "Live" des
   *  cartes synthétiques. */
  tournamentName?: string;
  /** Round BSD (R7.3) — ex: "Round of 32", "Final". Extrait depuis m.round_name. */
  roundName?: string;
};

/**
 * Fetch live tennis matches directly from the BSD live endpoint.
 * Returns normalized match objects with scores, sets, server, and live probabilities.
 */
export async function fetchBSDLiveMatches(): Promise<LiveMatchItem[]> {
  const rawData = await bsdFetch("/api/v2/matches/live/");
  const items = Array.isArray(rawData) ? rawData : [];

  return items.map((m: Record<string, any>): LiveMatchItem | null => {
    if (!m || !m.player1 || !m.player2) return null;

    const nameA = m.player1.name || m.player1.short_name || "?";
    const nameB = m.player2.name || m.player2.short_name || "?";
    const statusStr = String(m.status || "").toLowerCase();
    const finishedRx = /finish|complete|ended|cancel|walkover|retired|abandon|w_?o|post/;
    const isLive = (/progress|live|playing|in_play|inplay|set/.test(statusStr) && !finishedRx.test(statusStr))
      || (m.current_set != null && !finishedRx.test(statusStr));

    // Parse per-set game scores from sets_detail
    const setsDetail: Array<{ p1: number; p2: number }> = Array.isArray(m.sets_detail)
      ? m.sets_detail.map((s: any) => ({
          p1: s.p1 ?? s.player1 ?? 0,
          p2: s.p2 ?? s.player2 ?? 0,
        }))
      : [];

    // Current game scores
    const gameP1 = m.current_game_p1 ?? 0;
    const gameP2 = m.current_game_p2 ?? 0;

    // Parse current point string like "15-30" or "40-AV"
    let pointP1 = 0;
    let pointP2 = 0;
    if (m.current_point) {
      const parts = String(m.current_point).split(/[-–—]/);
      const ptVal = (s: string): number => {
        const v = s.trim().toUpperCase();
        if (v === "0" || v === "LOVE") return 0;
        if (v === "15") return 1;
        if (v === "30") return 2;
        if (v === "40" || v === "AV" || v === "AD" || v === "ADV") return 3;
        return 0;
      };
      pointP1 = parts[0] ? ptVal(parts[0]) : 0;
      pointP2 = parts[1] ? ptVal(parts[1]) : 0;
    }

    // Determine server
    const server: "A" | "B" = m.is_serving_p1 === true ? "A" : m.is_serving_p1 === false ? "B" : "A";

    // Live probabilities from odds when available
    let liveProbA = 50;
    let liveProbB = 50;
    if (m.odds_player1 != null && m.odds_player2 != null && m.odds_player1 > 0 && m.odds_player2 > 0) {
      const invA = 1 / m.odds_player1;
      const invB = 1 / m.odds_player2;
      const total = invA + invB;
      if (total > 0) {
        liveProbA = Math.round((invA / total) * 100);
        liveProbB = Math.round((invB / total) * 100);
      }
    }

    // current_set is 1-based from BSD → convert to 0-indexed
    const rawCurrentSet = m.current_set != null ? parseInt(String(m.current_set), 10) : NaN;
    const currentSet = !isNaN(rawCurrentSet) && rawCurrentSet > 0 ? rawCurrentSet - 1 : (setsDetail.length > 0 ? setsDetail.length - 1 : 0);

    // R7.3 : extrait nom tournoi + round depuis BSD (m.tournament.name, m.round_name).
    // Évite le fallback "Live" / "En direct" sur les cartes synthétiques.
    const tournamentName =
      (m.tournament && (m.tournament.name || m.tournament.short_name)) || undefined;
    const roundName =
      m.round_name || m.round || undefined;

    return {
      id: `bsd-${m.id}`,
      playerA: { name: nameA },
      playerB: { name: nameB },
      setsDetail,
      currentGame: { p1: gameP1, p2: gameP2 },
      currentPoint: { p1: pointP1, p2: pointP2 },
      currentSet,
      server,
      liveProbA,
      liveProbB,
      isLive,
      tournamentName,
      roundName,
    };
  }).filter((m: LiveMatchItem | null): m is LiveMatchItem => m !== null);
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
