export interface StrategyResult {
  strategy: string;
  bankroll_initial: number;
  bankroll_final: number;
  roi_percent: number;
  sharpe_ratio: number;
  max_drawdown_percent: number;
  total_bets: number;
  win_rate: number;
  avg_odds: number;
  bankroll_history: number[];
  bet_history: BetRecord[];
  status: string;
}

export interface BetRecord {
  match_id: string;
  prob: number;
  odds: number;
  stake: number;
  result: 'win' | 'loss';
  pnl: number;
}

export interface ModelMetrics {
  accuracy: number;
  auc: number;
  brier: number;
  feature_importance: [string, number][];
  n_matches: number;
  model_version: string;
}
