/**
 * Client unifié Bzzoiro Sports Data (BSD) — Football + Tennis
 *
 * Base URLs:
 *   Football: https://sports.bzzoiro.com/api/v2/
 *   Tennis:   https://sports.bzzoiro.com/tennis/api/v2/
 *
 * Auth: Authorization: Token <BSD_API_KEY>
 */

// ─── Config ───────────────────────────────────────────────────────────────

const FOOTBALL_BASE = "https://sports.bzzoiro.com/api/v2";
const TENNIS_BASE = "https://sports.bzzoiro.com/tennis/api/v2";
const TIMEOUT_MS = 15_000;

function getToken(): string {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");
  return key;
}

// ─── Fetch interne avec cache edge 5s + retry 429 ────────────────────────

type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5_000; // edge cache 5s

async function bsdFetch<T>(
  url: string,
  opts?: { signal?: AbortSignal; retries?: number },
): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.data as T;

  const token = getToken();
  const retries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      signal: opts?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 429 && attempt < retries) {
      const wait = Math.min(1000 * 2 ** attempt, 5000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (res.status === 402) throw new Error("BSD Sports Addon required (402)");
    if (!res.ok) throw new Error(`BSD HTTP ${res.status}: ${url}`);

    const data = (await res.json()) as T;
    cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  throw new Error(`BSD max retries exceeded: ${url}`);
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ─── Types Football ───────────────────────────────────────────────────────

export type FootballEvent = {
  id: number;
  league: { id: number; name: string; country: string; logo?: string };
  home: { id: number; name: string; short_name: string; logo?: string };
  away: { id: number; name: string; short_name: string; logo?: string };
  utc_date: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  minute?: number;
  home_score?: number;
  away_score?: number;
  halftime_score?: { home: number; away: number };
  statistics?: FootballMatchStats;
};

export type FootballMatchStats = {
  possession: { home: number; away: number };
  shots_on_target: { home: number; away: number };
  shots_total: { home: number; away: number };
  corners: { home: number; away: number };
  yellow_cards: { home: number; away: number };
  red_cards: { home: number; away: number };
  expected_goals?: { home: number; away: number };
};

export type FootballH2H = {
  match_id: number;
  total_matches: number;
  home_wins: number;
  draws: number;
  away_wins: number;
  recent_matches: FootballEvent[];
};

export type FootballOdds = {
  match_id: number;
  bookmakers: Array<{
    name: string;
    markets: Array<{
      name: string;
      outcomes: Array<{ name: string; odds: number }>;
    }>;
  }>;
};

export type FootballPrediction = {
  id: number;
  match: number;
  home_prob: number;
  draw_prob: number;
  away_prob: number;
  btts_prob?: number;
  over25_prob?: number;
  predicted_winner: "home" | "draw" | "away";
  confidence: number;
};

export type FootballLineup = {
  match_id: number;
  team: "home" | "away";
  formation?: string;
  players: Array<{
    id: number;
    name: string;
    position: string;
    shirt_number?: number;
    rating?: number;
  }>;
};

// ─── Types Tennis ─────────────────────────────────────────────────────────

export type TennisMatch = {
  id: number;
  tournament: { id?: number; name: string; surface: string } | null;
  player1: { id: number; name: string; current_ranking: { position: number; type: string } | null } | null;
  player2: { id: number; name: string; current_ranking: { position: number; type: string } | null } | null;
  status: "scheduled" | "live" | "finished" | "cancelled" | "postponed" | "walkover" | "retired";
  round_name: string | null;
  match_date: string | null;
  player1_sets: number;
  player2_sets: number;
  sets_detail: string | null;
  odds_player1: number | null;
  odds_player2: number | null;
};

export type TennisH2H = {
  match_id: number;
  player1: { id: number; name: string };
  player2: { id: number; name: string };
  h2h: {
    total_matches: number;
    player1_wins: number;
    player2_wins: number;
  };
  player1_last5: TennisMatch[];
  player2_last5: TennisMatch[];
};

export type TennisOdds = {
  match_id: number;
  bookmakers: Array<{
    bookmaker: string;
    odds_player1: number;
    odds_player2: number;
    movement_player1: string | null;
    movement_player2: string | null;
  }>;
};

export type TennisPrediction = {
  id: number;
  match: number;
  prob_player1_wins: number;
  prob_player2_wins: number;
  predicted_winner: 1 | 2;
  confidence: number;
};

export type TennisRanking = {
  id: number;
  position: number;
  player: { id: number; name: string; country: string };
  points: number;
  type: "ATP" | "WTA";
};

// ─── Pagination ───────────────────────────────────────────────────────────

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// ─── Football API ─────────────────────────────────────────────────────────

export const football = {
  /** Événements du jour */
  events(params?: { league?: number; date?: string; limit?: number; offset?: number }) {
    return bsdFetch<PaginatedResponse<FootballEvent>>(
      `${FOOTBALL_BASE}/events/${qs(params)}`,
    );
  },

  /** Événements live */
  live() {
    return bsdFetch<FootballEvent[]>(`${FOOTBALL_BASE}/events/live/`);
  },

  /** Détail événement */
  event(id: number) {
    return bsdFetch<FootballEvent>(`${FOOTBALL_BASE}/events/${id}/`);
  },

  /** H2H entre deux équipes */
  h2h(matchId: number) {
    return bsdFetch<FootballH2H>(`${FOOTBALL_BASE}/events/${matchId}/h2h/`);
  },

  /** Cotes multi-bookmakers */
  odds(matchId: number) {
    return bsdFetch<FootballOdds>(`${FOOTBALL_BASE}/events/${matchId}/odds/`);
  },

  /** Prédictions ML */
  predictions(params?: { upcoming?: boolean; match?: number; limit?: number }) {
    return bsdFetch<PaginatedResponse<FootballPrediction>>(
      `${FOOTBALL_BASE}/predictions/${qs(params)}`,
    );
  },

  /** Compositions d'équipe */
  lineups(matchId: number) {
    return bsdFetch<FootballLineup[]>(`${FOOTBALL_BASE}/events/${matchId}/lineups/`);
  },

  /** Statistiques match */
  statistics(matchId: number) {
    return bsdFetch<FootballMatchStats>(`${FOOTBALL_BASE}/events/${matchId}/statistics/`);
  },

  /** Couverture (in/out season) */
  coverage() {
    return bsdFetch<unknown>(`${FOOTBALL_BASE.replace("/api/v2", "")}/api/v2/coverage/`);
  },
};

// ─── Tennis API ───────────────────────────────────────────────────────────

export const tennis = {
  /** Matchs à venir */
  matches(params?: {
    date_from?: string;
    date_to?: string;
    tournament?: string;
    player?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return bsdFetch<PaginatedResponse<TennisMatch>>(
      `${TENNIS_BASE}/matches/${qs(params)}`,
    );
  },

  /** Matchs live */
  live() {
    return bsdFetch<TennisMatch[]>(`${TENNIS_BASE}/matches/live/`);
  },

  /** Détail match */
  match(id: number) {
    return bsdFetch<TennisMatch>(`${TENNIS_BASE}/matches/${id}/`);
  },

  /** H2H */
  h2h(matchId: number) {
    return bsdFetch<TennisH2H>(`${TENNIS_BASE}/matches/${matchId}/h2h/`);
  },

  /** Cotes */
  odds(matchId: number) {
    return bsdFetch<TennisOdds>(`${TENNIS_BASE}/matches/${matchId}/odds/`);
  },

  /** Prédictions */
  predictions(params?: { upcoming?: boolean; match?: number; limit?: number }) {
    return bsdFetch<PaginatedResponse<TennisPrediction>>(
      `${TENNIS_BASE}/predictions/${qs(params)}`,
    );
  },

  /** Classements */
  rankings(params?: { type?: string; limit?: number }) {
    return bsdFetch<PaginatedResponse<TennisRanking>>(
      `${TENNIS_BASE}/rankings/${qs(params)}`,
    );
  },

  /** Joueurs */
  players(params?: { search?: string; gender?: string; limit?: number }) {
    return bsdFetch<PaginatedResponse<{ id: number; name: string; country_code: string; current_ranking: { position: number; type: string } | null }>>(
      `${TENNIS_BASE}/players/${qs(params)}`,
    );
  },

  /** Tournois */
  tournaments(params?: { circuit?: string; surface?: string; limit?: number }) {
    return bsdFetch<PaginatedResponse<{ id: number; name: string; circuit: string; surface: string }>>(
      `${TENNIS_BASE}/tournaments/${qs(params)}`,
    );
  },
};

// ─── Unifié: Live multi-sports ────────────────────────────────────────────

export type UnifiedLiveEvent = {
  source: "bsd";
  sport: "football" | "tennis";
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
  minute?: number;
  scheduledAt?: string;
  oddsHome?: number;
  oddsDraw?: number;
  oddsAway?: number;
};

/** Récupère le live multi-sports (football + tennis) */
export async function fetchUnifiedLive(): Promise<UnifiedLiveEvent[]> {
  const [footballLive, tennisLive] = await Promise.allSettled([
    football.live(),
    tennis.live(),
  ]);

  const events: UnifiedLiveEvent[] = [];

  if (footballLive.status === "fulfilled") {
    for (const e of footballLive.value) {
      events.push({
        source: "bsd",
        sport: "football",
        id: `bsd-fb-${e.id}`,
        league: e.league?.name ?? "",
        homeTeam: e.home?.name ?? "",
        awayTeam: e.away?.name ?? "",
        homeScore: e.home_score,
        awayScore: e.away_score,
        status: e.status,
        minute: e.minute,
        scheduledAt: e.utc_date,
      });
    }
  }

  if (tennisLive.status === "fulfilled") {
    for (const m of tennisLive.value) {
      events.push({
        source: "bsd",
        sport: "tennis",
        id: `bsd-tn-${m.id}`,
        league: m.tournament?.name ?? "",
        homeTeam: m.player1?.name ?? "",
        awayTeam: m.player2?.name ?? "",
        homeScore: m.player1_sets,
        awayScore: m.player2_sets,
        status: m.status,
        scheduledAt: m.match_date ?? undefined,
        oddsHome: m.odds_player1 ?? undefined,
        oddsAway: m.odds_player2 ?? undefined,
      });
    }
  }

  return events;
}

// ─── Nettoyage cache ─────────────────────────────────────────────────────

export function clearBsdCache(): void {
  cache.clear();
}
