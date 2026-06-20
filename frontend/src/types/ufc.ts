/** Types UFC/MMA — extension du type system Pariscore.
 *  Module indépendant du fichier index.ts (tennis).
 *  Utilise une union discriminante `sport` pour cohabiter. */

// ── Enums ──

export type Stance = 'orthodox' | 'southpaw' | 'switch';

export type WeightClass =
  | 'strawweight' | 'flyweight' | 'bantamweight'
  | 'featherweight' | 'lightweight' | 'welterweight'
  | 'middleweight' | 'light_heavyweight' | 'heavyweight';

export type FightMethod =
  | 'ko_tko' | 'submission' | 'decision_unanimous'
  | 'decision_split' | 'decision_majority' | 'draw' | 'no_contest';

export type FightRound = 1 | 2 | 3 | 4 | 5;

export type FighterStyle = 'striker' | 'grappler' | 'brawler' | 'all_rounder';

export type Advantage = 'a' | 'b' | 'neutral';

export type ValueRecommendation = 'bet_a' | 'bet_b' | 'no_bet';

export type Sport = 'tennis' | 'ufc';

// ── Interfaces UFC ──

export interface UFCFighterFeatures {
  fighter_id: string;
  fighter_name: string;
  nickname?: string;
  nationality?: string;
  record: string;             // "15-2-0"
  stance: Stance;
  age: number;
  height_cm: number;
  reach_cm: number;
  weight_class: WeightClass;
  fighter_style: FighterStyle;

  // EWMA features
  ewma_sig_str_landed_S: number;
  ewma_sig_str_landed_M: number;
  ewma_sig_str_landed_L: number;
  ewma_td_avg_S: number;
  ewma_td_avg_M: number;
  ewma_td_defense_S: number;
  ewma_sub_attempts_S: number;
  ewma_ctrl_time_sec_S: number;

  // True Talent
  true_talent_rating: number;
  opponent_strength_sos: number;

  // Contexte
  days_since_last_fight: number;
  is_short_notice: boolean;
  camp_changed: boolean;
  weight_cut_concern: boolean;
}

export interface UFCMatchFeatures {
  sport: 'ufc';
  fight_id: string;
  event_name: string;
  event_date: string;
  weight_class: WeightClass;
  is_title_fight: boolean;
  is_main_event: boolean;
  is_interim: boolean;
  rounds: FightRound;

  fighter_a: UFCFighterFeatures;
  fighter_b: UFCFighterFeatures;

  // H2H
  h2h_fights: number;
  h2h_wins_a: number;

  // Odds
  opening_odds_a: number;
  opening_odds_b: number;

  // Composées
  reach_advantage_a: number;
  age_difference_a: number;
  stance_advantage: number;
  weight_class_avg_finish_rate: number;
}

export interface UFCKeyFactor {
  label: string;
  fighter_a_value: number | string;
  fighter_b_value: number | string;
  advantage: Advantage;
  weight: number;
  icon: string;
}

export interface ValueAlert {
  market_prob: number;
  model_prob: number;
  ratio: number;
  kelly_fraction: number;
  expected_value: number;
  recommendation: ValueRecommendation;
}

export interface UFCPrediction {
  fight_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  fighter_a_name: string;
  fighter_b_name: string;
  weight_class: WeightClass;
  is_title_fight: boolean;
  prob_a: number;
  prob_b: number;
  confidence: number;
  predicted_method?: FightMethod;
  predicted_round?: FightRound;
  key_factors: UFCKeyFactor[];
  value_alert?: ValueAlert;
  model_version: string;
  timestamp: string;
}

export interface UFCEvent {
  event_id: string;
  event_name: string;
  event_date: string;
  venue?: string;
  location?: string;
}

export interface UFCEventWithFights extends UFCEvent {
  fights: UFCMatchFeatures[];
}

// ── Routing ──

export interface SportRoute {
  sport: Sport;
  label: string;
  icon: string;
  path: string;
}

export const SPORT_ROUTES: SportRoute[] = [
  { sport: 'tennis', label: 'Top 10 ATP', icon: 'TennisBall', path: '/tennis' },
  { sport: 'ufc', label: 'UFC MMA', icon: 'Swords', path: '/mma' },
];
