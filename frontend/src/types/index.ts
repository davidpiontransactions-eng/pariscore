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
  // Informational only — not used by ML model
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
  player_a: { name: string; seed?: number; id?: string };
  player_b: { name: string; seed?: number; id?: string };
  surface: 'Hard' | 'Clay' | 'Grass';
  tournament: string;
  date: string;
  features: FeatureVector;
  bookmaker_odds?: { a: number; b: number };
}

/* ── Fiche Joueur (Player Profile) ── */

export interface PlayerYearStats {
  year: number;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  aces: number;
  doubleFaults: number;
  firstServeIn: number;
  firstServeWon: number;
  secondServeWon: number;
  servePointsWon: number;
  returnPointsWon: number;
  breakPointsSaved: number;
  dominanceRatio: number;
  titles: number;
  prizeMoney: string;
}

export interface SurfaceSplit {
  surface: 'Hard' | 'Clay' | 'Grass';
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  servePointsWon: number;
  returnPointsWon: number;
  dominanceRatio: number;
}

export interface EWMAValues {
  shortTerm: { srv: number; ret: number };   // α=0.18
  longTerm: { srv: number; ret: number };     // α=0.05
}

export interface PlayerProfileData {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  hand: 'Droitier' | 'Gaucher';
  backhand: 'Une main' | 'Deux mains';
  height: number;           // cm
  weight: number;           // kg
  photoUrl: string;         // Chemin vers la photo (ex: /players/djokovic.jpg)
  country: string;
  countryCode: string;
  rank: number;
  peakRank: number;
  peakRankDate: string;
  atpPoints: number;
  eloRating: number;
  turnedPro: number;
  coach: string;
  titles: number;

  // Stats carrière
  career: PlayerYearStats;
  yearlyStats: PlayerYearStats[];
  surfaceSplits: SurfaceSplit[];

  // EWMA (issu du pipeline Pariscore)
  ewma: EWMAValues;

  // Métriques dérivées
  dominanceRatio: number;
  serveEdge: number;
  clutchFactor: number;
  pressureIndex: number;
}

export interface PlayerContext {
  playerA: PlayerProfileData;
  playerB: PlayerProfileData;
}

/* ── TennisExplorer (Matches en direct / a venir) ── */

export interface TournamentMatchOdds {
  player_a: number | null;
  player_b: number | null;
}

export interface TournamentMatch {
  id: string;
  round: string;
  player_a_name: string;
  player_b_name: string;
  player_a_slug: string;
  player_b_slug: string;
  score?: string;
  odds: TournamentMatchOdds;
  status: 'scheduled' | 'live' | 'completed';
  time?: string;
  court?: string;
}

export interface TournamentRound {
  name: string;
  matches: TournamentMatch[];
}

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  surface: 'Hard' | 'Clay' | 'Grass' | 'Carpet';
  category: string;
  year?: number;
  location?: string;
  prize_money?: string;
  draw_size?: number;
  rounds?: TournamentRound[];
  current_round?: string;
}

/* ── Draw Bracket ── */

export interface DrawMatch {
  id: string;
  position: number;
  player_a_name: string;
  player_b_name: string;
  player_a_slug: string;
  player_b_slug: string;
  score?: string;
  odds?: TournamentMatchOdds;
  winner?: 'a' | 'b';
  children: [DrawMatch | null, DrawMatch | null];
}

export interface DrawData {
  tournamentId: string;
  rounds: DrawMatch[][];
}
