/**
 * Contrat de types du domaine Baseball (MLB & KBO).
 * Source de vérité unique : zéro `any`, zéro faux bouchon.
 */

export type League = "MLB" | "KBO";
export type LeagueFilter = "ALL" | League;
export type Handedness = "LHP" | "RHP";
export type GameStatus = "scheduled" | "live" | "final";
export type DataSource = "mlb-statsapi-live" | "curated";
export type OverUnderSide = "over" | "under";

export interface TeamRecord {
  id: string;
  league: League;
  code: string;
  name: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  logoPath: string;
  woba: number;
  wrcPlus: number;
  opsVsLhp: number;
  opsVsRhp: number;
  parkFactor: number;
  bullpenEra: number;
  bullpenIpLast3: number;
}

export interface PitcherRecord {
  id: string;
  league: League;
  teamId: string;
  name: string;
  throws: Handedness;
  era: number;
  whip: number;
  fip: number;
  xEra: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
  wins: number;
  losses: number;
  inningsPitched: number;
  opsAgainst: number;
  starterIpAvg: number;
  source: DataSource;
  season: number;
}

export interface BaseballGameRecord {
  id: string;
  league: League;
  gamePk: number;
  gameDateIso: string; // UTC
  venueName: string;
  dayNight: "D" | "N";
  homeTeamId: string;
  awayTeamId: string;
  homePitcherId: string | null;
  awayPitcherId: string | null;
  status: GameStatus;
  homeRuns: number | null;
  awayRuns: number | null;
}

export interface QuickPrediction {
  totalLine: number;
  overProb: number; // 0..1
  underProb: number; // 0..1
  confidence: number; // 0..1 (max(over, under))
  recommendation: OverUnderSide | null; // null si < seuil 65 %
  expectedTotal: number;
  homeWinProb: number;
}

export interface BaseballMatch {
  game: BaseballGameRecord;
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
  homePitcher: PitcherRecord | null;
  awayPitcher: PitcherRecord | null;
  quick: QuickPrediction | null;
}

export interface SchedulePayload {
  date: string;
  league: LeagueFilter;
  matches: BaseballMatch[];
  degraded: boolean;
  fetchedAt: string;
}

export interface PythagorasResult {
  exponent: number;
  expectedHomeRuns: number;
  expectedAwayRuns: number;
  homeWinProb: number;
}

export interface MonteCarloResult {
  iterations: number;
  homeWinProb: number;
  awayWinProb: number;
  expectedTotal: number;
  stdDevTotal: number;
  marginHomeWinsBy2Plus: number; // P(marge ≥ 2)
  marginAwayWinsBy2Plus: number;
  f5: {
    homeWinProb: number;
    awayWinProb: number;
    expectedTotal: number;
  };
}

export interface TotalMarket {
  line: number;
  overProb: number;
  underProb: number;
  confidence: number;
  recommendation: OverUnderSide | null;
  expectedTotal: number;
}

export interface MoneylineMarket {
  homeProb: number;
  awayProb: number;
  homeAmerican: number;
  awayAmerican: number;
}

export interface RunLineMarket {
  homeMinusOneAndHalfProb: number; // -1.5 home
  awayPlusOneAndHalfProb: number; // +1.5 away
}

export interface FirstFiveMarket {
  homeWinProb: number;
  awayWinProb: number;
  totalLine: number;
  overProb: number;
  underProb: number;
  confidence: number;
  expectedTotal: number;
}

export interface BaseballPrediction {
  modelVersion: string;
  seed: number;
  pythagorean: PythagorasResult;
  monteCarlo: MonteCarloResult;
  moneyline: MoneylineMarket;
  total: TotalMarket;
  runLine: RunLineMarket;
  firstFive: FirstFiveMarket;
}

export interface MatchupContext {
  homeParkFactor: number;
  homeParkLabel: "favorable over" | "favorable under" | "neutre";
  homePlatoon: { opsVsStarterHand: number; opsVsLhp: number; opsVsRhp: number };
  awayPlatoon: { opsVsStarterHand: number; opsVsLhp: number; opsVsRhp: number };
  homeBullpen: { era: number; ipLast3: number; fatigueIndex: number };
  awayBullpen: { era: number; ipLast3: number; fatigueIndex: number };
}

export interface BaseballMatchDetail {
  game: BaseballGameRecord;
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
  homePitcher: PitcherRecord | null;
  awayPitcher: PitcherRecord | null;
  matchupContext: MatchupContext;
  prediction: BaseballPrediction | null;
  predictionBlockedReason: string | null;
  dataSources: {
    schedule: DataSource;
    pitchers: DataSource;
    teams: "curated";
  };
  cachedAt: string;
}

/** Réponse de l'API détail. */
export interface MatchDetailPayload {
  detail: BaseballMatchDetail;
}
