export type ScoreMatrix = number[][];

export type DcSelection = "1X" | "X2" | "12";
export type TopScore = { home: number; away: number; prob: number };

export type Markets = {
  homeWin: number; draw: number; awayWin: number;
  over05: number; over15: number; over25: number; over35: number;
  under15: number; under35: number;
  btts: number;
  dc: { selection: DcSelection; prob: number };
  topScores: TopScore[];
  cornersOver?: { line: number; prob: number } | null;
};

export type EloPair = { home: number; away: number };

export type EloConfig = {
  init: number;        // 1500
  k: number;           // 30
  kBig: number;        // 15 (écart > threshold)
  threshold: number;   // 400
  homeAdv: number;     // 100
  decayDays: number;   // 365 (poids 0 au-delà)
};

export const DEFAULT_ELO_CONFIG: EloConfig = {
  init: 1500, k: 30, kBig: 15, threshold: 400, homeAdv: 100, decayDays: 365,
};

export type LiveMarkets = {
  minute: number;
  scoreHome: number; scoreAway: number;
  homeWin: number; draw: number; awayWin: number;
  over15: number; over25: number; over35: number; btts: number;
  lambdaRemaining: EloPair;
};

export type EngineResult = {
  mode: "prematch" | "live";
  lambda?: EloPair;
  markets?: Markets;
  live?: LiveMarkets;
  elo?: { home: number; away: number; eloKnown: boolean };
  modelSource: "poisson" | "dixon-coles" | "blend" | "live-decay";
  errors: string[];
};

export type LiveInputs = {
  scoreHome: number; scoreAway: number; minute: number;
  redCardHome: number; redCardAway: number;
  xgCumHome: number | null; xgCumAway: number | null;
  momentum15: number | null; // [-1, +1] normalisé, + = domine domestique
};