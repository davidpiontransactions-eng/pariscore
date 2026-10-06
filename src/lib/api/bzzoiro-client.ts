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
  /** Fix Bzzoiro 2026-09 : peut être null (flux agrégé interne mort le 21/08). */
  updated_at?: string | null;
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

  /** Cotes multi-bookmakers (consensus — inclus live, Football API) */
  odds(matchId: number) {
    return bsdFetch<FootballOdds>(`${FOOTBALL_BASE}/events/${matchId}/odds/`);
  },

  /** Vue comparison per-bookmaker (Unlimited) — mêmes lignes, in-play = rows séparées */
  oddsComparison(matchId: number) {
    return bsdFetch<FootballOdds>(`${FOOTBALL_BASE}/events/${matchId}/odds/comparison/`);
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

// ─── Basketball (BSD) ────────────────────────────────────────────────────
//
// Base : https://sports.bzzoiro.com/basketball/api/v2
// Auth : identique (Token). Les LOGOS sont sur un hôte SANS auth.
//
// ⚠️ OSINT 2026-10-06 : BSD est un agrégateur à base propre
// (Django REST Framework, `No BasketballEvent matches the given query.`),
// pas un proxy. `allow: OPTIONS, GET` = DRF. Donc les identifiants sont
// les SIENS (entiers internes), pas ceux d'un fournisseur amont.

const BASKETBALL_BASE = "https://sports.bzzoiro.com/basketball/api/v2";
const BASKETBALL_IMG = "https://sports.bzzoiro.com/img/basketball";

export type BsdBasketballTeamRef = {
  id: number;
  name: string;
  short_name: string;
  country_code: string;
};

export type BsdBasketballEvent = {
  id: number;
  league: { id: number; name: string; country: string };
  home_team: BsdBasketballTeamRef;
  away_team: BsdBasketballTeamRef;
  event_date: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  home_score: number | null;
  away_score: number | null;
  round_number: number | null;
  prediction: BsdBasketballRawPrediction | null;
};

/**
 * Prédiction telle que renvoyée par BSD.
 *
 * ⚠️ `prob_over_*` sont des seuils NBA (205 / 215 / 225). Sur un match
 * EuroCup à ~160 points (mesuré : `prob_over_215 = 0.0246` quand le
 * `pregame` de la même source annonce 156/165), ils sont FAUX par
 * construction — même défaut que `Over 215.5` appliqué à l'EuroLeague.
 * Ils sont donc retirés par `sanitizeBasketballPrediction`.
 */
export type BsdBasketballRawPrediction = {
  prob_home_win: number;
  prob_away_win: number;
  prob_over_205?: number;
  prob_over_215?: number;
  prob_over_225?: number;
  prob_favorite_wins?: number;
  predicted_winner_id?: number | null;
  predicted_winner_name?: string | null;
  confidence?: string;
  confidence_score?: number;
  elo_home?: number;
  elo_away?: number;
  model_version?: string;
  is_correct?: boolean | null;
};

/**
 * Prédiction EXPOSÉE à l'app : sans dimension, donc utilisable.
 *
 * `prob_favorite_wins` est écarté avec les `prob_over_*` : c'est une
 * grandeur dérivée d'un seuil implicite, pas une probabilité d'équipe
 * identifiable. Le garder exposerait un chiffre dont on ne peut pas dire
 * ce qu'il mesure.
 */
//
export type BsdBasketballPrediction = {
  probHomeWin: number;
  probAwayWin: number;
  eloHome: number | null;
  eloAway: number | null;
  confidence: string | null;
  confidenceScore: number | null;
  predictedWinnerId: number | null;
  predictedWinnerName: string | null;
  modelVersion: string | null;
  /** Champs retirés et pourquoi — auditable côté serveur. */
  rejectedFields: string[];
};

/**
 * Retire les champs non dimensionnels d'une prédiction BSD.
 *
 * Fonction pure et exportée pour être testée sans réseau : c'est la garde
 * qui empêche `prob_over_215` de réapparaître un jour dans l'UI.
 */
export function sanitizeBasketballPrediction(
  raw: BsdBasketballRawPrediction | null | undefined,
): BsdBasketballPrediction | null {
  if (!raw) return null;

  const rejected: string[] = [];
  for (const k of ["prob_over_205", "prob_over_215", "prob_over_225", "prob_favorite_wins"]) {
    if (raw[k] != null) rejected.push(k);
  }

  return {
    probHomeWin: raw.prob_home_win,
    probAwayWin: raw.prob_away_win,
    eloHome: raw.elo_home ?? null,
    eloAway: raw.elo_away ?? null,
    confidence: raw.confidence ?? null,
    confidenceScore: raw.confidence_score ?? null,
    predictedWinnerId: raw.predicted_winner_id ?? null,
    predictedWinnerName: raw.predicted_winner_name ?? null,
    modelVersion: raw.model_version ?? null,
    rejectedFields: rejected,
  };
}

export type BsdBasketballPregame = {
  event_id: number;
  home_coach: { id: number; name: string } | null;
  away_coach: { id: number; name: string } | null;
  venue: { id: number; name: string; city: string; country: string; capacity: number | null } | null;
  home_standing: BsdBasketballStandingRow | null;
  away_standing: BsdBasketballStandingRow | null;
  streaks: { general: Array<{ name: string; team: string; value: string }>; h2h: unknown[] };
  featured_players: unknown[];
};

export type BsdBasketballStandingRow = {
  position: number;
  matches: number;
  wins: number;
  losses: number;
  scores_for: number;
  scores_against: number;
  percentage: number;
};

/** GET /events/ — `date_from`/`date_to` en YYYY-MM-DD. */
export async function getBasketballEvents(params?: {
  date_from?: string;
  date_to?: string;
  league?: number;
  team?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ count: number; results: BsdBasketballEvent[] }> {
  return bsdFetch(`${BASKETBALL_BASE}/events/${qs(params)}`);
}

/** GET /events/live/ — cache 30 s côté BSD. */
export async function getBasketballLive(): Promise<BsdBasketballEvent[]> {
  return bsdFetch<BsdBasketballEvent[]>(`${BASKETBALL_BASE}/events/live/`);
}

/** GET /events/{id}/pregame/ — coach, salle, classements, séries des 10. */
export async function getBasketballPregame(eventId: number): Promise<BsdBasketballPregame> {
  return bsdFetch<BsdBasketballPregame>(`${BASKETBALL_BASE}/events/${eventId}/pregame/`);
}

export type BsdBasketbookmakerPrice = {
  bookmaker: string;
  bookmaker_slug: string;
  odds_home: number | null;
  odds_away: number | null;
  movement_home: string | null;
  movement_away: string | null;
  updated_at: string | null;
};

export type BsdBasketballOdds = {
  event_id: number;
  event_date: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  /** `multi` = prix par bookmaker, `consensus` = prix unique stocké, `none` = personne n'a coté. */
  source: string;
  bookmakers_count: number;
  bookmakers: BsdBasketbookmakerPrice[];
  /** Marchés additionnels (AH, OU, WINNER) — non transformés. */
  markets?: unknown[];
};

/**
 * GET /events/{id}/odds/
 *
 * Renvoie `null` quand aucune cote n'existe (404) — un cas NORMAL pour un
 * match jeune, pas une erreur à remonter. Le cron distingue donc « pas de
 * cotes » de « appel échoué ».
 */
export async function getBasketballOdds(eventId: number): Promise<BsdBasketballOdds | null> {
  try {
    return await bsdFetch<BsdBasketballOdds>(`${BASKETBALL_BASE}/events/${eventId}/odds/`);
  } catch {
    return null;
  }
}

/**
 * GET /predictions/?league=&days= — UN appel pour toute une ligue.
 *
 * ⚠️ Le champ `prediction` n'existe PAS sur `/events/` (le listing) : mesuré
 * le 2026-10-06, le listing n'expose ni `prediction` ni `officials`, alors que
 * le détail `/events/{id}/` les porte. Le cron lisait donc `ev.prediction`
 * sur le listing → toujours `undefined` → 0 prédiction sur 17 matchs, alors
 * que BSD en a. Plutôt que N appels de détail, un seul appel ici.
 */
export type BsdBasketballPredictionRow = BsdBasketballRawPrediction & {
  event_id: number;
  event_date?: string;
  league?: { id: number; name: string };
};

export async function getBasketballPredictions(params?: {
  league?: number;
  days?: number;
  limit?: number;
  offset?: number;
}): Promise<{ count: number; results: BsdBasketballPredictionRow[] }> {
  return bsdFetch(`${BASKETBALL_BASE}/predictions/${qs(params)}`);
}

/** GET /standings/?league= */
export async function getBasketballStandings(
  leagueId: number,
): Promise<{ league: { id: number; name: string }; standings: Array<{ team: BsdBasketballTeamRef } & BsdBasketballStandingRow> }> {
  return bsdFetch(`${BASKETBALL_BASE}/standings/?league=${leagueId}`);
}

/** Types d'images supportés : `team`, `league`, `player`, `manager`, `venue`. */
export type BsdBasketballImageKind = "team" | "league" | "player" | "manager" | "venue";

/**
 * URL d'un blason BSD — SANS authentification.
 *
 * Contrat documenté et vérifié le 2026-10-06 : `200` = image (PNG/WebP),
 * `204` = id valide SANS image, `404` = type inconnu. Le `204` est un cas
 * normal, pas une erreur : d'où `logoAvailable` plus loin.
 */
export function basketballImageUrl(kind: BsdBasketballImageKind, id: number | null | undefined): string | null {
  // `id > 0` et non `id != null` : BSD numérote ses entités à partir de 1,
  // donc `0` est un id INVALIDE, pas un id valide. Sans ce garde, `0` —
  // valeur de repli classique après un `?? 0` — produirait une URL qui
  // répond 204 et donc une image cassée à chaque rendu.
  if (id == null || !Number.isFinite(id) || id <= 0) return null;
  return `${BASKETBALL_IMG}/${kind}/${Math.floor(id)}/`;
}

/**
 * État d'une image BSD, tel qu'il doit être PROUVÉ avant d'afficher.
 *
 * On ne « suppose » pas qu'une URL marche : sans vérification, un 204 donne
 * une image cassée — exactement ce que produit un `<img>` sans `onError`.
 */
export type BsdImageProbe =
  | { status: "available"; url: string }
  | { status: "absent"; url: string }
  // `url` peut être `null` ICI (id invalide) mais reste une string quand la
  // requête a été tentée : d'où le type union, pas `url: null` strict.
  | { status: "unknown"; url: string | null };

/** Vérifie une image. `HEAD` d'abord (léger), `GET` en secours. */
export async function probeBasketballImage(
  kind: BsdBasketballImageKind,
  id: number | null | undefined,
): Promise<BsdImageProbe> {
  const url = basketballImageUrl(kind, id);
  if (!url) return { status: "unknown", url: null };
  try {
    let res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000) });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    }
    if (res.status === 200) return { status: "available", url };
    if (res.status === 204 || res.status === 404) return { status: "absent", url };
    return { status: "unknown", url };
  } catch {
    return { status: "unknown", url };
  }
}

// ─── Nettoyage cache ─────────────────────────────────────────────────────

export function clearBsdCache(): void {
  cache.clear();
}
