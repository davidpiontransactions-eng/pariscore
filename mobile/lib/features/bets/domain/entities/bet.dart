import 'package:equatable/equatable.dart';

enum BetStatus { pending, won, lost, voidBet, halfWon, halfLost, cashout }

class Bet extends Equatable {
  final int id;
  final String? matchId;
  final String? homeTeam;
  final String? awayTeam;
  final String? league;
  final DateTime? commenceTime;
  final String market;
  final String selectionLabel;
  final double odds;
  final int stakeCents; // stored as cents, display /100
  final String? bookmaker;
  final BetStatus status;
  final double? edgePct;
  final double? modelProb;
  final double? kellyFraction;
  final String? sport;
  final String? strategy;
  final String? notes;
  final double? settledOdds;
  final DateTime createdAt;

  const Bet({
    required this.id,
    this.matchId,
    this.homeTeam,
    this.awayTeam,
    this.league,
    this.commenceTime,
    required this.market,
    required this.selectionLabel,
    required this.odds,
    required this.stakeCents,
    this.bookmaker,
    required this.status,
    this.edgePct,
    this.modelProb,
    this.kellyFraction,
    this.sport,
    this.strategy,
    this.notes,
    this.settledOdds,
    required this.createdAt,
  });

  double get stakeEuros => stakeCents / 100;

  double get potentialReturn => stakeEuros * odds;

  double? get plEuros {
    if (status == BetStatus.won) return (odds - 1) * stakeEuros;
    if (status == BetStatus.lost) return -stakeEuros;
    if (status == BetStatus.halfWon) return ((odds - 1) * stakeEuros) / 2;
    if (status == BetStatus.halfLost) return -stakeEuros / 2;
    return null;
  }

  bool get isSettled => status != BetStatus.pending;

  @override
  List<Object?> get props => [id, market, selectionLabel, odds, stakeCents];
}

class BankrollSummary extends Equatable {
  final int totalBets;
  final int won;
  final int lost;
  final int pending;
  final double winRatePct;
  final double roiPct;
  final int plCents;
  final int currentBankrollCents;

  const BankrollSummary({
    required this.totalBets,
    required this.won,
    required this.lost,
    required this.pending,
    required this.winRatePct,
    required this.roiPct,
    required this.plCents,
    required this.currentBankrollCents,
  });

  double get plEuros => plCents / 100;
  double get currentBankrollEuros => currentBankrollCents / 100;

  @override
  List<Object?> get props => [totalBets, winRatePct, roiPct, plCents];
}
