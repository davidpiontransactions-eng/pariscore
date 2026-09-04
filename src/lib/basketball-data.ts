/**
 * Types partagés pour le basketball multi-ligues.
 * Couvre NBA, WNBA, EuroLeague, EuroCup et ligues domestiques européennes.
 * Source : basketballService.js (NBA/WNBA) + euroleague_api (EuroLeague/EuroCup).
 */

export type BasketballLeagueId = "nba" | "wnba" | "euroleague" | "eurocup" | "lnb" | "acb" | "lba" | "bsl" | "bbl" | "aba" | "greek" | "fiba";

export type BasketballLeagueInfo = {
  id: BasketballLeagueId;
  name: string;
  country: string;
  countryCode: string;
  season: string;
  pace: number;        // possessions par 48 min (baseline ligue)
  threePointLine: number; // distance ligne 3pts en mètres
  quarterMinutes: number; // durée quartier en minutes
  foulLimit: number;   // limite fautes personnelles
  usesFibaRules: boolean;
};

export type FourFactors = {
  efg_home: number | null;
  efg_away: number | null;
  tov_home: number | null;
  tov_away: number | null;
  orb_home: number | null;
  orb_away: number | null;
  ft_home: number | null;
  ft_away: number | null;
  off_rating_home: number | null;
  off_rating_away: number | null;
  def_rating_home: number | null;
  def_rating_away: number | null;
  net_rating_home: number | null;
  net_rating_away: number | null;
  pace_home: number | null;
  pace_away: number | null;
  p_home: number;
  complete: boolean;
};

export type WinProb = {
  p_home: number;
  p_away: number;
  home_rating: number;
  away_rating: number;
  edge_elo: number;
  source: string;
  backtest: unknown;
};

export type BlendResult = {
  p_home: number;
  p_away: number;
  n_models: number;
};

export type SpreadUQD = {
  exp_margin: number;
  margin_ic90: [number, number];
  p_home_cover: number | null;
  ats_pick: string | null;
  total_ic90: [number, number] | null;
  p_over: number | null;
  ou_lean: string | null;
};

export type TotalResult = {
  expected_total?: number;
  exp_home?: number;
  exp_away?: number;
  defense_modeled: boolean;
  league_avg?: number;
  combined_offense?: number;
  home_avg_pts?: number;
  away_avg_pts?: number;
};

export type InjuryImpact = {
  n_out: number;
  stars_out: string[];
  penalty_pts: number;
  out_list: string[];
};

export type RestInfo = {
  rest_days: number;
  b2b: boolean;
  penalty_pts: number;
};

export type KellyResult = {
  side: string;
  fraction: number;
  capped: number;
  note: string;
  ev: number | null;
};

export type ConsensusResult = {
  mean_p_home: number;
  stddev: number;
  range: [number, number];
  label: string;
  crosses_fifty: boolean;
  contrarian: { name: string; p: number; dist: number } | null;
  n_models: number;
};

export type ValueResult = {
  fair_home: number;
  fair_away: number;
  vig_pct: number;
  ev_home: number | null;
  ev_away: number | null;
  edge_home: number | null;
  edge_away: number | null;
};

export type BasketballTeam = {
  id: string;
  name: string;
  abbr: string;
  logo: string | null;
  color: string | null;
  score: number | null;
  record: string | null;
  avg_pts: number | null;
  efg_pct: number | null;
  ft_rate: number | null;
  tov_pct: number | null;
  orb_pct: number | null;
  off_rating: number | null;
  def_rating: number | null;
  net_rating: number | null;
  pace: number | null;
};

export type BasketballOdds = {
  provider: string | null;
  details: string | null;
  spread: number | null;
  over_under: number | null;
  ml_home: number | null;
  ml_away: number | null;
};

export type BasketballMatch = {
  id: string;
  date: string;
  name: string;
  status: string;
  status_detail: string;
  series: string | null;
  league: BasketballLeagueId;
  home: BasketballTeam;
  away: BasketballTeam;
  odds: BasketballOdds | null;
  predictions: {
    win_prob: WinProb | null;
    blended: BlendResult | null;
    pythagorean: { p_home: number; pyth_home: number; pyth_away: number } | null;
    four_factors: FourFactors | null;
    srs: { p_home: number; exp_margin: number } | null;
    recent_form: { p_home: number; home_l10: number; away_l10: number } | null;
    adjusted: { p_home: number; p_away: number; base_margin: number; adj_margin: number; delta_pts: number } | null;
    injuries: { home: InjuryImpact; away: InjuryImpact };
    rest: { home: RestInfo | null; away: RestInfo | null };
    line_movement: { spread?: { open: number; close: number; move: number; toward: string }; total?: { open: number; close: number; move: number; toward: string } } | null;
    kelly: KellyResult | null;
    models_panel: { name: string; p: number }[];
    consensus: ConsensusResult | null;
    total: TotalResult | null;
    total_edge: { line: number; model?: number; diff?: number; lean: string | null; status: string; combined_offense?: number } | null;
    spread_uqd: SpreadUQD | null;
    value: ValueResult | null;
  };
  note: string;
};

/** Match normalisé pour l'UI (forme allégée). */
export type BasketballMatchUI = {
  id: string;
  league: BasketballLeagueId;
  scheduledAt: string;
  status: string;
  home: { abbr: string; name: string; score: number | null; record: string | null };
  away: { abbr: string; name: string; score: number | null; record: string | null };
  pHome: number | null;
  pAway: number | null;
  edgeElo: number | null;
  fourFactors: {
    efg: [number | null, number | null];
    tov: [number | null, number | null];
    orb: [number | null, number | null];
    ft: [number | null, number | null];
    offRating: [number | null, number | null];
    defRating: [number | null, number | null];
    pace: [number | null, number | null];
  } | null;
};

/** Top bet candidat. */
export type BasketballTopBet = {
  matchId: string;
  match: string;
  market: string;
  selection: string;
  edge_pp: number;
  ev?: number;
  cover_pct?: number;
  prob_pct?: number;
  basis: string;
};
