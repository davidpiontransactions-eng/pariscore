import '../../domain/entities/bet.dart';

class BetModel extends Bet {
  const BetModel({
    required super.id,
    super.matchId,
    super.homeTeam,
    super.awayTeam,
    super.league,
    super.commenceTime,
    required super.market,
    required super.selectionLabel,
    required super.odds,
    required super.stakeCents,
    super.bookmaker,
    required super.status,
    super.edgePct,
    super.modelProb,
    super.kellyFraction,
    super.sport,
    super.strategy,
    super.notes,
    super.settledOdds,
    required super.createdAt,
  });

  factory BetModel.fromJson(Map<String, dynamic> j) => BetModel(
        id: j['id'] as int,
        matchId: j['match_id']?.toString(),
        homeTeam: j['home_team'] as String?,
        awayTeam: j['away_team'] as String?,
        league: j['league'] as String?,
        commenceTime: j['commence_time'] != null
            ? DateTime.tryParse(j['commence_time'].toString())
            : null,
        market: j['market'] as String? ?? '',
        selectionLabel: j['selection_label'] as String? ?? '',
        odds: _toDouble(j['odds']) ?? 1.0,
        stakeCents: j['stake_cents'] as int? ?? 0,
        bookmaker: j['bookmaker'] as String?,
        status: _parseStatus(j['status'] as String?),
        edgePct: _toDouble(j['edge_pct']),
        modelProb: _toDouble(j['model_prob']),
        kellyFraction: _toDouble(j['kelly_fraction']),
        sport: j['sport'] as String?,
        strategy: j['strategy'] as String?,
        notes: j['notes'] as String?,
        settledOdds: _toDouble(j['settled_odds']),
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );

  static BetStatus _parseStatus(String? s) => switch (s?.toLowerCase()) {
        'won' => BetStatus.won,
        'lost' => BetStatus.lost,
        'void' => BetStatus.voidBet,
        'half_won' => BetStatus.halfWon,
        'half_lost' => BetStatus.halfLost,
        'cashout' => BetStatus.cashout,
        _ => BetStatus.pending,
      };

  static double? _toDouble(dynamic v) =>
      v == null ? null : double.tryParse(v.toString());
}

class BankrollSummaryModel extends BankrollSummary {
  const BankrollSummaryModel({
    required super.totalBets,
    required super.won,
    required super.lost,
    required super.pending,
    required super.winRatePct,
    required super.roiPct,
    required super.plCents,
    required super.currentBankrollCents,
  });

  factory BankrollSummaryModel.fromJson(Map<String, dynamic> j) =>
      BankrollSummaryModel(
        totalBets: j['total_bets'] as int? ?? 0,
        won: j['won'] as int? ?? 0,
        lost: j['lost'] as int? ?? 0,
        pending: j['pending'] as int? ?? 0,
        winRatePct: _toDouble(j['win_rate_pct']) ?? 0,
        roiPct: _toDouble(j['roi_pct']) ?? 0,
        plCents: j['pl_cents'] as int? ?? 0,
        currentBankrollCents: j['current_bankroll_cents'] as int? ??
            j['bankroll_cents'] as int? ?? 0,
      );

  static double _toDouble(dynamic v) =>
      v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;
}
