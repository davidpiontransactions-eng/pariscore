// Types du module Bet Manager — alignés sur prisma/schema.prisma

export type BetStatus = "pending" | "won" | "lost" | "void" | "cashout";

export type BetType = "single" | "combo" | "system" | "back" | "lay" | "dutch";

export type BetLeg = {
  id: string;
  matchLabel: string;
  market?: string | null;
  pick?: string | null;
  odds: number;
  order: number;
};

export type Bet = {
  id: string;
  bankrollId: string;
  betType: BetType;
  sport: string;
  competition?: string | null;
  matchLabel?: string | null;
  market?: string | null;
  pick?: string | null;
  stake: number;
  odds: number;
  status: BetStatus;
  payout?: number | null;
  profit?: number | null;
  cashoutAt?: string | null;
  bookmaker?: string | null;
  tipster?: string | null;
  category?: string | null;
  tags?: string | null;
  closingOdd?: number | null;
  placedAt: string;
  settledAt?: string | null;
  note?: string | null;
  legs: BetLeg[];
};

export type Bankroll = {
  id: string;
  name: string;
  currency: string;
  initial: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BankrollStats = {
  initial: number;
  current: number;
  profit: number;
  roi: number; // profit / staked * 100 (void exclus)
  yield: number; // profit / total staked * 100 (même chose ici, gardé pour la clarté)
  winRate: number; // won / (won + lost) * 100
  totalBets: number;
  settledCount: number;
  pendingCount: number;
  wonCount: number;
  lostCount: number;
  voidCount: number;
  cashoutCount: number;
  totalStaked: number; // mises risquées (void exclus)
  totalReturned: number;
  avgOdds: number;
  avgStake: number;
  bestStreak: number;
  worstStreak: number;
  currentStreak: number; // positif = gains consécutifs, négatif = pertes
  maxDrawdown: number; // % de drawdown max sur l'historique
  variance: number; // variance des P/L unitaires
  stdev: number; // écart-type des P/L
};

export type GroupStats = {
  key: string;
  label: string;
  bets: number;
  won: number;
  lost: number;
  pending: number;
  settled: number;
  staked: number;
  profit: number;
  roi: number;
  winRate: number;
};

export type CapitalPoint = {
  key: string; // "YYYY-MM" ou "YYYY-MM-DD"
  bankroll: number;
  profit: number;
};