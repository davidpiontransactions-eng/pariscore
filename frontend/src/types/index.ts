/** Types Pariscore — correspond au schéma Pydantic du backend */

export interface FeatureVector {
  match_id?: string;
  player_a_id?: string;
  player_b_id?: string;
  player_a_name?: string;
  player_b_name?: string;

  // Noyau dur (noms exacts du modèle)
  serve_edge_A?: number;
  serve_edge_B?: number;
  clutch_A?: number;
  clutch_B?: number;
  h2h_context_score?: number;
  age_30_A?: number;
  age_30_B?: number;
  atp_points_6m_A?: number;
  atp_points_6m_B?: number;

  // EWMA différentiel A − B
  srv_pts_won_pct_S_DIFF?: number;
  ret_pts_won_pct_S_DIFF?: number;

  // EWMA individuels requis par le modèle
  srv_pts_won_S_A?: number;
  srv_pts_won_S_B?: number;
  ret_pts_won_S_A?: number;
  ret_pts_won_S_B?: number;

  // Angles morts
  motivation_A?: number;
  motivation_B?: number;
  fatigue_A?: number;
  fatigue_B?: number;
  public_advantage?: number;
}

export interface KeyFactor {
  name: string;
  value?: number | null;
  value_A?: number | null;
  value_B?: number | null;
  weight: number;
}

export interface MatchPrediction {
  match_id: string;
  player_a_id: string;
  player_b_id: string;
  player_a_name?: string;
  player_b_name?: string;
  prob_a: number;
  prob_b: number;
  confidence?: number;
  key_factors: KeyFactor[];
  model_version: string;
  timestamp: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  model_loaded: boolean;
  version: string;
}

export interface MatchDemo {
  id: string;
  player_a: { name: string; seed?: number };
  player_b: { name: string; seed?: number };
  surface: 'Hard' | 'Clay' | 'Grass';
  tournament: string;
  date: string;
  features: FeatureVector;
  bookmaker_odds?: { a: number; b: number };
}
