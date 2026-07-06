// Real-API matches fetcher for The Odds API.
//
// Fetches upcoming ATP + WTA singles matches from The Odds API
// (https://the-odds-api.com), enriches them with:
//   - Elo ratings + history from `elo-data.json` (fuzzy name match)
//   - Form (last 6 W/L) extracted from the Elo history
//   - H2H history synthesized as a UI placeholder (no direct H2H data
//     is shipped in elo-data.json — the prediction engine uses the
//     per-player form as the H2H proxy)
//   - Multi-bookmaker odds (vig-removed implied probabilities)
//   - Real prediction via `predict()` (Elo + form + H2H)
//
// Returns up to 10 matches to keep the response size reasonable
// (The Odds API free tier = 500 req/month — we cache aggressively).
//
// If the API call fails or returns an empty list, throws an Error so
// the caller can fall back to the mock matches.

import {
  type TennisMatch,
  type BookmakerOdd,
  type Player,
  type Surface,
  type H2HMatch,
} from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";
import {
  findPlayerElo,
  extractFormFromHistory,
  type PlayerEloMatch,
} from "@/lib/player-matcher";
import { resolvePlayerPhoto } from "@/lib/player-photos";

const DEFAULT_ELO = 1500;
const MAX_MATCHES = 10;
const FETCH_TIMEOUT_MS = 8000;

const ATP_URL =
  "https://api.the-odds-api.com/v4/sports/tennis_atp_singles/odds/?apiKey=KEY&regions=eu&oddsFormat=decimal";
const WTA_URL =
  "https://api.the-odds-api.com/v4/sports/tennis_wta_singles/odds/?apiKey=KEY&regions=eu&oddsFormat=decimal";

// Player A (favorite) = emerald dark; Player B = violet (per spec).
const COLOR_FAVORI = "#1B4332";
const COLOR_CHALLENGER = "#5C2D91";

/**
 * Fetch upcoming ATP + WTA matches from The Odds API, enrich them with
 * our Elo/form/H2H data, and return up to 10 `TennisMatch` objects.
 *
 * @throws Error if the API call fails, returns 429, or returns an
 *   empty list. The caller (`/api/tennis/prematch/route.ts`) catches
 *   this and falls back to the mock MATCHES with `source: "mock"`.
 */
export async function fetchRealMatches(apiKey: string): Promise<TennisMatch[]> {
  if (!apiKey) {
    throw new Error("ODDS_API_KEY is not set");
  }

  // Fetch ATP and WTA in parallel — each request is independent and
  // costs 1 credit against the 500/month quota (2 credits per call).
  const [atpRes, wtaRes] = await Promise.allSettled([
    fetchOddsApi(ATP_URL, apiKey),
    fetchOddsApi(WTA_URL, apiKey),
  ]);

  // If both failed, throw — caller falls back to mock.
  if (atpRes.status === "rejected" && wtaRes.status === "rejected") {
    throw new Error(
      `Both ATP and WTA fetches failed: ATP=${atpRes.reason?.message}, WTA=${wtaRes.reason?.message}`
    );
  }

  const raw: OddsApiMatch[] = [];
  if (atpRes.status === "fulfilled") raw.push(...atpRes.value);
  if (wtaRes.status === "fulfilled") raw.push(...wtaRes.value);

  if (raw.length === 0) {
    throw new Error("The Odds API returned 0 matches for both ATP and WTA");
  }

  // De-duplicate by match id (The Odds API ids are stable per event).
  const seen = new Set<string>();
  const deduped = raw.filter((m) => {
    if (!m.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  // Sort by commence_time ascending (soonest first) — gives the user
  // the most immediately relevant matches.
  deduped.sort((a, b) =>
    (a.commence_time ?? "").localeCompare(b.commence_time ?? "")
  );

  // Build enriched TennisMatch objects. Skip any match where neither
  // player is in our Elo data (we'd have nothing real to predict with)
  // — but keep matches where only one player is known (we use the
  // default Elo 1500 for the unknown player).
  const matches: TennisMatch[] = [];
  for (const apiMatch of deduped) {
    if (matches.length >= MAX_MATCHES) break;
    const enriched = enrichMatch(apiMatch);
    if (enriched) matches.push(enriched);
  }

  if (matches.length === 0) {
    throw new Error("No enrichable matches (all had invalid player names)");
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchOddsApi(
  urlTemplate: string,
  apiKey: string
): Promise<OddsApiMatch[]> {
  const url = urlTemplate.replace(
    "apiKey=KEY",
    `apiKey=${encodeURIComponent(apiKey)}`
  );
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      // Next.js fetch cache — also caches at the runtime layer for
      // 5min (matches our route's CACHE_TTL).
      next: { revalidate: 300 },
    });
    if (res.status === 429) {
      throw new Error("The Odds API rate limit (429) — quota exhausted");
    }
    if (res.status === 401) {
      throw new Error("The Odds API unauthorized (401) — bad API key");
    }
    if (!res.ok) {
      throw new Error(`The Odds API HTTP ${res.status}`);
    }
    const data = (await res.json()) as OddsApiMatch[];
    if (!Array.isArray(data)) {
      throw new Error("The Odds API returned non-array payload");
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Per-match enrichment
// ---------------------------------------------------------------------------

function enrichMatch(apiMatch: OddsApiMatch): TennisMatch | null {
  if (!apiMatch.bookmakers || apiMatch.bookmakers.length === 0) return null;

  // Pick the first bookmaker with a valid h2h market to identify the
  // player names — all bookmakers should list the same players.
  const refBookmaker = apiMatch.bookmakers.find((bm) => {
    const market =
      bm.markets?.find((mk) => mk.key === "h2h") ?? bm.markets?.[0];
    return market && market.outcomes && market.outcomes.length >= 2;
  });
  if (!refBookmaker) return null;
  const refMarket =
    refBookmaker.markets?.find((mk) => mk.key === "h2h") ??
    refBookmaker.markets?.[0];
  if (!refMarket || !refMarket.outcomes || refMarket.outcomes.length < 2) {
    return null;
  }

  // The Odds API lists players in arbitrary order — keep API order:
  // first outcome = "player A" (favori color), second = "player B"
  // (challenger color) per the task spec. The favorite swap happens
  // below after the prediction is computed.
  const [outcomeA, outcomeB] = refMarket.outcomes;
  const nameA = outcomeA.name;
  const nameB = outcomeB.name;
  if (!nameA || !nameB || nameA === nameB) return null;

  // Resolve Elo for both players (fuzzy match against elo-data.json).
  const eloA = findPlayerElo(nameA);
  const eloB = findPlayerElo(nameB);

  // Skip matches where NEITHER player is in our Elo data — there's
  // nothing real we can compute (default-default = 50/50 coin flip).
  if (!eloA && !eloB) return null;

  // Build Player objects (with side A = favori color, B = challenger).
  const playerA = buildPlayer(nameA, eloA, "A");
  const playerB = buildPlayer(nameB, eloB, "B");

  // Form: from Elo history (W/L inferred from Elo deltas).
  const formA = eloA ? extractFormFromHistory(eloA.history, 6) : [];
  const formB = eloB ? extractFormFromHistory(eloB.history, 6) : [];

  // H2H proxy: use player A's recent form wins/losses as the H2H tuple
  // (we don't have direct H2H data in elo-data.json — it only tracks
  // per-player Elo over time, not opponent identities).
  const h2hWonA = formA.filter((r) => r === "W").length;
  const h2hLostA = formA.filter((r) => r === "L").length;

  // Run the prediction engine.
  const inputsA: PlayerInputs = {
    id: playerA.id,
    name: playerA.name,
    elo: playerA.elo,
    surfaceElo: playerA.surfaceElo ?? playerA.elo,
    form: formA,
    h2h: { won: h2hWonA, lost: h2hLostA },
  };
  const inputsB: PlayerInputs = {
    id: playerB.id,
    name: playerB.name,
    elo: playerB.elo,
    surfaceElo: playerB.surfaceElo ?? playerB.elo,
    form: formB,
    h2h: { won: h2hLostA, lost: h2hWonA }, // mirror A
  };
  const pred = predict(inputsA, inputsB);

  // Ensure playerA is the favorite (proba > 50). The Odds API usually
  // lists the favorite first, but not always.
  let finalA = playerA;
  let finalB = playerB;
  let finalProbA = pred.probA;
  let finalProbB = pred.probB;
  if (pred.probA < pred.probB) {
    finalA = { ...playerB, color: COLOR_FAVORI };
    finalB = { ...playerA, color: COLOR_CHALLENGER };
    finalProbA = pred.probB;
    finalProbB = pred.probA;
  }

  // Multi-bookmaker odds (vig-removed implied probabilities), using
  // the FINAL (favorite-first) player names.
  const allOdds = extractAllOdds(apiMatch, finalA.name, finalB.name);

  // Infer surface from the tournament name (best-effort).
  const surface = inferSurface(apiMatch.sport_title ?? apiMatch.sport_key ?? "");

  // Tournament display name.
  const tournament = apiMatch.sport_title ?? "Tennis";

  // H2H history (synthetic placeholder — see synthesizeH2HHistory).
  const h2hHistory = synthesizeH2HHistory(finalA, finalB);

  // Stats for the card.
  const formStr = `${formA.filter((r) => r === "W").length}V-${formA.filter((r) => r === "L").length}D`;
  const h2hStr = `${h2hWonA}-${h2hLostA}`;

  return {
    id: `real-${apiMatch.id}`,
    tournament,
    round: "Match",
    scheduledAt: apiMatch.commence_time ?? new Date().toISOString(),
    playerA: finalA,
    playerB: finalB,
    probA: finalProbA,
    probB: finalProbB,
    stats: {
      form: formStr,
      eloGap: pred.eloGap,
      surface,
      h2h: h2hStr,
      ic: pred.ic,
      confidence: pred.confidence,
    },
    model: pred.model,
    modelUpdatedAt: new Date().toISOString(),
    odds: allOdds[0]
      ? {
          bookmaker: allOdds[0].bookmaker,
          decimalA: allOdds[0].decimalA,
          decimalB: allOdds[0].decimalB,
        }
      : undefined,
    allOdds,
    h2hHistory,
  };
}

function buildPlayer(
  name: string,
  elo: PlayerEloMatch | null,
  side: "A" | "B"
): Player {
  const playerId = elo?.id ?? slugify(name);
  const photoUrl = resolvePlayerPhoto(name, elo?.id);
  // Side A → favori (emerald), Side B → challenger (violet).
  // (enrichMatch swaps + reassigns colors if A is not actually the
  // favorite after the prediction runs.)
  const color = side === "A" ? COLOR_FAVORI : COLOR_CHALLENGER;

  return {
    id: playerId,
    name: elo?.name ?? name,
    shortName: shortName(elo?.name ?? name),
    rank: 0, // The Odds API doesn't expose ATP/WTA rank; 0 = unknown
    elo: elo?.elo ?? DEFAULT_ELO,
    surfaceElo: elo?.surfaceElo ?? DEFAULT_ELO,
    photoUrl,
    color,
    form: elo ? extractFormFromHistory(elo.history, 6) : [],
    country: undefined,
  };
}

// ---------------------------------------------------------------------------
// Odds extraction
// ---------------------------------------------------------------------------

function extractAllOdds(
  apiMatch: OddsApiMatch,
  nameA: string,
  nameB: string
): BookmakerOdd[] {
  const out: BookmakerOdd[] = [];
  const seen = new Set<string>();
  for (const bm of apiMatch.bookmakers ?? []) {
    // Prefer the h2h market; fall back to first market.
    const market =
      bm.markets?.find((mk) => mk.key === "h2h") ?? bm.markets?.[0];
    if (!market || !market.outcomes) continue;
    const outcomeA = market.outcomes.find((o) => o.name === nameA);
    const outcomeB = market.outcomes.find((o) => o.name === nameB);
    if (!outcomeA?.price || !outcomeB?.price) continue;
    if (outcomeA.price <= 1 || outcomeB.price <= 1) continue;
    // De-duplicate by bookmaker title (some feeds return the same
    // book under multiple keys).
    const bmTitle = bm.title ?? bm.key ?? "Unknown";
    if (seen.has(bmTitle)) continue;
    seen.add(bmTitle);

    const invA = 1 / outcomeA.price;
    const invB = 1 / outcomeB.price;
    const vig = invA + invB;
    const impliedProbA = Math.round((invA / vig) * 100);
    out.push({
      bookmaker: bmTitle,
      decimalA: outcomeA.price,
      decimalB: outcomeB.price,
      impliedProbA,
      impliedProbB: 100 - impliedProbA,
      margin: Math.round((vig - 1) * 1000) / 1000,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Surface / H2H inference helpers
// ---------------------------------------------------------------------------

function inferSurface(sportKey: string): Surface {
  // The Odds API sport_key for tennis is "tennis_atp_singles" or
  // "tennis_wta_singles" — it doesn't tell us the surface. Default
  // to "Dur" (hard court) since most tournaments are on hard courts.
  // We could refine this by parsing the tournament name, but The
  // Odds API doesn't reliably include the surface in the sport_title.
  if (/clay|terre|roland/i.test(sportKey)) return "Terre battue";
  if (/grass|gazon|wimbledon/i.test(sportKey)) return "Gazon";
  return "Dur";
}

/**
 * Synthesize a plausible H2H history as a UI placeholder.
 *
 * `elo-data.json` only tracks per-player Elo over time, not direct
 * head-to-head matchups. To keep the detail dialog functional for
 * real-API matches, we generate 5 synthetic past meetings with a
 * winner probability proportional to the Elo gap. The result is
 * deterministic per (playerA.id + playerB.id) so the same matchup
 * always shows the same history.
 *
 * NOTE: This is explicitly NOT real H2H — it's a UI placeholder.
 * The prediction engine uses the `h2h` wins/losses tuple (computed
 * from form), not this array, so it doesn't affect probabilities.
 */
function synthesizeH2HHistory(playerA: Player, playerB: Player): H2HMatch[] {
  const out: H2HMatch[] = [];
  const eloA = playerA.surfaceElo ?? playerA.elo;
  const eloB = playerB.surfaceElo ?? playerB.elo;
  const pAWin = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  // Deterministic LCG seeded by player ids hash
  let seed = hashString(playerA.id + playerB.id);
  for (let i = 0; i < 5; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const r = seed / 0x7fffffff;
    const winnerId = r < pAWin ? playerA.id : playerB.id;
    const daysAgo = (i + 1) * 60; // ~2 months apart
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
    out.push({
      date,
      tournament: "H2H (synthétique)",
      surface: "Dur",
      winnerId,
      score: winnerId === playerA.id ? "6-4, 6-3" : "6-3, 6-4",
    });
  }
  return out;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.toUpperCase();
  if (parts.length === 1) return parts[0].toUpperCase();
  // Use the last token (surname) as the short name, uppercased.
  return parts[parts.length - 1].toUpperCase();
}

// ---------------------------------------------------------------------------
// Types (The Odds API v4 odds response)
// ---------------------------------------------------------------------------

type OddsApiMatch = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number }[];
    }[];
  }[];
};
