// BSD Tennis API v2 — service unifié pour tous les endpoints
// Base: https://sports.bzzoiro.com/tennis/api/v2/

import { AppError } from "./api-error";

const BSD_BASE = "https://sports.bzzoiro.com/tennis";

function getKey(): string {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new AppError("CONFIG", "BSD_API_KEY not configured", 503);
  return key;
}

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

async function bsdFetch<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
  const key = getKey();
  const url = `${BSD_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: options?.signal ?? AbortSignal.timeout(15000),
  });
  if (res.status === 402) throw new AppError("BSD_PAYMENT", "Sports Addon required (402)", 402);
  if (res.status === 429) throw new AppError("BSD_RATE_LIMIT", "Rate limited (429)", 429);
  if (!res.ok) throw new AppError("BSD_ERROR", `BSD HTTP ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

// ─── Types BSD bruts (calqués sur la doc API v2) ──────────────────────

export type BSDTournament = {
  id: number;
  name: string;
  circuit: "ATP" | "WTA";
  category: string;
  surface: "hard" | "clay" | "grass" | "carpet";
  location: string;
  country: string;
  start_date: string;
  end_date: string;
  winner_points: number;
  active: boolean;
};

export type BSDPlayer = {
  id: number;
  name: string;
  country: string;
  gender: "M" | "F";
  height: number | null;
  weight: number | null;
  plays: "right" | "left" | null;
  turned_pro: number | null;
  current_ranking: {
    position: number;
    points: number;
    type: "ATP" | "WTA";
  } | null;
};

export type BSDMatch = {
  id: number;
  tournament: { id?: number; name: string; surface: string };
  player1: { id: number; name: string; current_ranking: { position: number; type: string } | null };
  player2: { id: number; name: string; current_ranking: { position: number; type: string } | null };
  status: "scheduled" | "live" | "interrupted" | "finished" | "cancelled" | "postponed" | "walkover" | "retired";
  round_name: string | null;
  match_date: string | null;
  player1_sets: number;
  player2_sets: number;
  sets_detail: Array<{ p1: number; p2: number }> | null;
  p1_aces: number | null;
  p2_aces: number | null;
  p1_double_faults: number | null;
  p2_double_faults: number | null;
  p1_first_serve_pct: number | null;
  p2_first_serve_pct: number | null;
  p1_first_serve_won_pct: number | null;
  p2_first_serve_won_pct: number | null;
  p1_second_serve_won_pct: number | null;
  p2_second_serve_won_pct: number | null;
  p1_break_points_saved_pct: number | null;
  p2_break_points_saved_pct: number | null;
  odds_player1: number | null;
  odds_player2: number | null;
  point_by_point_available: boolean;
};

export type BSDLiveMatch = BSDMatch & {
  current_set: number;
  current_game_p1: number;
  current_game_p2: number;
  current_point: string;
  is_serving_p1: boolean;
};

export type BSDPointByPoint = {
  match_id: number;
  available: boolean;
  sets: Array<{
    set: number;
    duration_seconds: number;
    games: Array<{
      game: number;
      server: "player1" | "player2";
      winner: "player1" | "player2";
      break: boolean;
      player1_games: number;
      player2_games: number;
      points: Array<{
        player1_score: string;
        player2_score: string;
        winner: "player1" | "player2" | null;
      }>;
    }>;
  }>;
};

export type BSDOddsBookmaker = {
  bookmaker: string;
  bookmaker_slug: string;
  odds_player1: number;
  odds_player2: number;
  movement_player1: "SHORTENING" | "DRIFTING" | "STABLE" | null;
  movement_player2: "SHORTENING" | "DRIFTING" | "STABLE" | null;
  updated_at: string;
};

export type BSDOdds = {
  match_id: number;
  match_date: string;
  player1_name: string;
  player2_name: string;
  bookmakers_count: number;
  source: "multi" | "consensus";
  bookmakers: BSDOddsBookmaker[];
};

export type BSDH2H = {
  match_id: number;
  player1: { id: number; name: string };
  player2: { id: number; name: string };
  h2h: {
    total_matches: number;
    player1_wins: number;
    player2_wins: number;
    by_surface: Record<string, { total: number; player1_wins: number }>;
  };
  player1_last5: BSDMatch[];
  player2_last5: BSDMatch[];
};

export type BSDPrediction = {
  id: number;
  match: number;
  match_date: string;
  player1_name: string;
  player2_name: string;
  prob_player1_wins: number;
  prob_player2_wins: number;
  predicted_winner: 1 | 2;
  confidence: number;
  expected_total_sets: number;
  prob_over_2_5_sets: number;
  expected_total_games: number;
  prob_over_20_5_games: number;
  prob_over_21_5_games: number;
  prob_over_22_5_games: number;
  prob_player1_wins_first_set: number;
  actual_winner: 1 | 2 | null;
  was_winner_correct: boolean | null;
};

export type BSDRanking = {
  id: number;
  position: number;
  player: { id: number; name: string; country: string };
  points: number;
  previous_position: number | null;
  previous_points: number | null;
  best_position: number | null;
  type: "ATP" | "WTA";
  date: string;
};

// ─── Fonctions publiques ──────────────────────────────────────────────

/** Tournois — paginés, filtrables par circuit/category/surface */
export async function fetchTournaments(params?: {
  circuit?: string;
  category?: string;
  surface?: string;
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<BSDTournament>> {
  const q = new URLSearchParams();
  if (params?.circuit) q.set("circuit", params.circuit);
  if (params?.category) q.set("category", params.category);
  if (params?.surface) q.set("surface", params.surface);
  if (params?.include_inactive) q.set("include_inactive", "true");
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return bsdFetch<PaginatedResponse<BSDTournament>>(`/api/v2/tournaments/${qs ? `?${qs}` : ""}`);
}

/** Détail d'un tournoi */
export async function fetchTournament(id: number): Promise<BSDTournament> {
  return bsdFetch<BSDTournament>(`/api/v2/tournaments/${id}/`);
}

/** Joueurs — paginés, filtrables par gender/country/search */
export async function fetchPlayers(params?: {
  gender?: string;
  country?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<BSDPlayer>> {
  const q = new URLSearchParams();
  if (params?.gender) q.set("gender", params.gender);
  if (params?.country) q.set("country", params.country);
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return bsdFetch<PaginatedResponse<BSDPlayer>>(`/api/v2/players/${qs ? `?${qs}` : ""}`);
}

/** Détail d'un joueur */
export async function fetchPlayer(id: number): Promise<BSDPlayer> {
  return bsdFetch<BSDPlayer>(`/api/v2/players/${id}/`);
}

/** Matchs — paginés, filtrables par date/tournoi/joueur/statut */
export async function fetchMatches(params?: {
  date_from?: string;
  date_to?: string;
  tournament?: string;
  player?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<BSDMatch>> {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.tournament) q.set("tournament", params.tournament);
  if (params?.player) q.set("player", params.player);
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return bsdFetch<PaginatedResponse<BSDMatch>>(`/api/v2/matches/${qs ? `?${qs}` : ""}`);
}

/** Détail d'un match (serve stats, sets, odds, point_by_point_available) */
export async function fetchMatch(id: number): Promise<BSDMatch> {
  return bsdFetch<BSDMatch>(`/api/v2/matches/${id}/`);
}

/** Point-by-point d'un match */
export async function fetchMatchPointByPoint(id: number): Promise<BSDPointByPoint> {
  return bsdFetch<BSDPointByPoint>(`/api/v2/matches/${id}/point-by-point/`);
}

/** Odds per-bookmaker d'un match */
export async function fetchMatchOdds(id: number): Promise<BSDOdds> {
  return bsdFetch<BSDOdds>(`/api/v2/matches/${id}/odds/`);
}

/** Head-to-head entre les deux joueurs d'un match */
export async function fetchMatchH2H(id: number): Promise<BSDH2H> {
  return bsdFetch<BSDH2H>(`/api/v2/matches/${id}/h2h/`);
}

/** Prédictions ML — paginées, upcoming par défaut */
export async function fetchPredictions(params?: {
  upcoming?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<BSDPrediction>> {
  const q = new URLSearchParams();
  if (params?.upcoming !== undefined) q.set("upcoming", String(params.upcoming));
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return bsdFetch<PaginatedResponse<BSDPrediction>>(`/api/v2/predictions/${qs ? `?${qs}` : ""}`);
}

/** Détail d'une prédiction */
export async function fetchPrediction(id: number): Promise<BSDPrediction> {
  return bsdFetch<BSDPrediction>(`/api/v2/predictions/${id}/`);
}

/** Classements ATP/WTA — snapshot courant ou historique */
export async function fetchRankings(params?: {
  type?: string;
  date?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<BSDRanking>> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.date) q.set("date", params.date);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return bsdFetch<PaginatedResponse<BSDRanking>>(`/api/v2/rankings/${qs ? `?${qs}` : ""}`);
}

/**
 * Live match list — retourne un tableau brut (pas de wrapper paginé).
 * L'endpoint BSD peut renvoyer un Array ou un objet { results }.
 */
export async function fetchLiveMatches(): Promise<BSDLiveMatch[]> {
  const raw = await bsdFetch<BSDLiveMatch[] | PaginatedResponse<BSDLiveMatch>>("/api/v2/matches/live/");
  return Array.isArray(raw) ? raw : (raw.results ?? []);
}

/** Photo joueur (endpoint public, pas d'auth — racine du domaine, pas /tennis/) */
export function getPlayerPhotoUrl(playerId: number): string {
  return `https://sports.bzzoiro.com/img/tennis-player/${playerId}/`;
}
