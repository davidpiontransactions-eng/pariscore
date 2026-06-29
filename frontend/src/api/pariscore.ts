import type { HealthStatus, MatchPrediction, FeatureVector } from '../types';
import type { StrategyResult } from '../types/dashboard';
import type { UFCMatchFeatures } from '../types/ufc';
import type { Tournament, TournamentMatch } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

export async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function predictMatch(
  features: Record<string, number | null>,
  signal?: AbortSignal
): Promise<MatchPrediction> {
  const body = { ...features };
  if (!body.player_a_name) delete body.player_a_name;
  if (!body.player_b_name) delete body.player_b_name;
  const res = await fetch(`${BASE}/predict/pre-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Prediction failed: ${res.status}`);
  }
  return res.json();
}

// --- Tennis / ATP ---

// --- Recent / Upcoming Matches ---

export interface RecentMatch {
  match_id: string;
  player_a_name: string;
  player_b_name: string;
  tourney_name: string;
  surface: string;
  round: string;
  tourney_date: string;
  prob_a: number;
  prob_b: number;
  confidence: number;
  features: Record<string, number | null>;
  target?: number;
  correct?: boolean;
  status?: string;
}

export interface RecentMatchesResponse {
  matches: RecentMatch[];
  total: number;
  source: string;
}

export async function fetchRecentMatches(): Promise<RecentMatchesResponse> {
  const res = await fetch(`${BASE}/matches/recent`);
  if (!res.ok) throw new Error(`Recent matches failed: ${res.status}`);
  return res.json();
}

export async function fetchUpcomingMatches(): Promise<RecentMatchesResponse> {
  const res = await fetch(`${BASE}/matches/upcoming`);
  if (!res.ok) throw new Error(`Upcoming matches failed: ${res.status}`);
  return res.json();
}

// --- Tennis / ATP ---

export async function fetchTennisTournaments(): Promise<Tournament[]> {
  const res = await fetch(`${BASE}/tennis/tournaments`);
  if (!res.ok) throw new Error(`Tennis API error: ${res.status}`);
  const data = await res.json();
  return data.tournaments ?? [];
}

export async function fetchTennisTournament(slug: string): Promise<Tournament> {
  const res = await fetch(`${BASE}/tennis/tournaments/${slug}`);
  if (!res.ok) throw new Error(`Tennis tournament error: ${res.status}`);
  return res.json();
}

export async function fetchTennisDraw(slug: string): Promise<any> {
  const res = await fetch(`${BASE}/tennis/tournaments/${slug}/draw`);
  if (!res.ok) throw new Error(`Tennis draw error: ${res.status}`);
  return res.json();
}

// --- UFC / MMA ---

/** Adapte UFCMatchFeatures (neste) -> format plat attendu par le backend UFCFightFeatures. */
function adaptUFCMatchFeatures(fight: UFCMatchFeatures): Record<string, unknown> {
  const a = fight.fighter_a;
  const b = fight.fighter_b;

  return {
    fight_id: fight.fight_id,
    fighter_a_id: a.fighter_id,
    fighter_b_id: b.fighter_id,
    fighter_a_name: a.fighter_name,
    fighter_b_name: b.fighter_name,
    weight_class: fight.weight_class,
    is_title_fight: fight.is_title_fight,
    rounds: fight.rounds,

    // True Talent
    true_talent_a: a.true_talent_rating,
    true_talent_b: b.true_talent_rating,
    opponent_strength_a: a.opponent_strength_sos,
    opponent_strength_b: b.opponent_strength_sos,

    // EWMA differentiels (A - B)
    ewma_strike_diff_S: a.ewma_sig_str_landed_S - b.ewma_sig_str_landed_S,
    ewma_td_diff_S: a.ewma_td_avg_S - (b.ewma_td_defense_S ?? 0.5),
    ewma_defense_diff_S: (a.ewma_td_defense_S ?? 0.5) - b.ewma_td_avg_S,

    // Contexte
    reach_advantage_a: fight.reach_advantage_a,
    age_difference_a: fight.age_difference_a,
    days_since_last_a: a.days_since_last_fight,
    days_since_last_b: b.days_since_last_fight,
    is_short_notice_a: a.is_short_notice,
    is_short_notice_b: b.is_short_notice,
    stance_advantage: fight.stance_advantage,
    weight_class_avg_finish_rate: fight.weight_class_avg_finish_rate,

    // Cotes ouverture -> probabilites implicites
    opening_odds_implied_prob_a: 1 / fight.opening_odds_a,
    opening_odds_implied_prob_b: 1 / fight.opening_odds_b,

    // Angles morts
    camp_changed_a: a.camp_changed,
    camp_changed_b: b.camp_changed,
    weight_cut_concern_a: a.weight_cut_concern,
    weight_cut_concern_b: b.weight_cut_concern,
    same_opponent_rematch: false,

    // Streak (non disponible dans les donnees actuelles)
    fighter_a_streak: null,
    fighter_b_streak: null,
  };
}

export async function predictUFCMatch(fight: UFCMatchFeatures): Promise<any> {
  const body = adaptUFCMatchFeatures(fight);
  const res = await fetch(`${BASE}/predict/pre-match/mma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`UFC prediction failed: ${res.status}`);
  return res.json();
}

export async function simulateStrategy(params: {
  strategy: string;
  threshold?: number;
  bankroll?: number;
  min_odds?: number;
  max_odds?: number;
}): Promise<StrategyResult> {
  const res = await fetch(`${BASE}/strategy/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Strategy simulation failed: ${res.status}`);
  return res.json();
}