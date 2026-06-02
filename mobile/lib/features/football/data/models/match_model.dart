import '../../domain/entities/match.dart';

class MatchModel extends Match {
  const MatchModel({
    required super.id,
    required super.sport,
    required super.league,
    required super.homeTeam,
    required super.awayTeam,
    required super.commenceTime,
    super.odds,
    super.poisson,
    super.bestEdge,
    super.xg,
    super.stats,
    super.isLive,
    super.liveScore,
    super.betfairWomBacking,
    super.betfairWomLaying,
  });

  factory MatchModel.fromJson(Map<String, dynamic> j) {
    final oddsMap = j['odds'] as Map<String, dynamic>?;
    final poissonMap = j['poisson'] as Map<String, dynamic>?;
    final edgeMap = j['best_edge'] as Map<String, dynamic>?;
    final xgMap = j['expectedGoals'] as Map<String, dynamic>?;
    final statsMap = j['stats'] as Map<String, dynamic>?;
    final liveMap = j['live_score'] as Map<String, dynamic>?;

    return MatchModel(
      id: j['id']?.toString() ?? '',
      sport: j['sport'] as String? ?? '',
      league: j['league'] as String? ?? '',
      homeTeam: j['home_team'] as String? ?? '',
      awayTeam: j['away_team'] as String? ?? '',
      commenceTime: j['commence_time'] != null
          ? DateTime.tryParse(j['commence_time'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isLive: j['is_live'] == true || j['status'] == 'live',
      odds: oddsMap != null ? _parseOdds(oddsMap) : null,
      poisson: poissonMap != null ? _parsePoisson(poissonMap) : null,
      bestEdge: edgeMap != null ? _parseEdge(edgeMap) : null,
      xg: xgMap != null ? _parseXg(xgMap) : null,
      stats: statsMap != null ? _parseStats(statsMap) : null,
      liveScore: liveMap != null ? _parseLive(liveMap) : null,
      betfairWomBacking: _toDouble(j['betfair_wom_backing']),
      betfairWomLaying: _toDouble(j['betfair_wom_laying']),
    );
  }

  static MatchOdds _parseOdds(Map<String, dynamic> m) => MatchOdds(
        home: _toDouble(m['home']),
        draw: _toDouble(m['draw']),
        away: _toDouble(m['away']),
      );

  static MatchPoisson _parsePoisson(Map<String, dynamic> m) => MatchPoisson(
        over05: _toInt(m['over05']),
        over15: _toInt(m['over15']),
        over25: _toInt(m['over25']),
        over35: _toInt(m['over35']),
        btts: _toInt(m['btts']),
        homeWin: _toInt(m['homeWin']),
        draw: _toInt(m['draw']),
        awayWin: _toInt(m['awayWin']),
      );

  static MatchEdge _parseEdge(Map<String, dynamic> m) => MatchEdge(
        label: m['label'] as String?,
        odds: _toDouble(m['odds']),
        edge: _toDouble(m['edge']),
        bookmaker: m['bk'] as String?,
      );

  static ExpectedGoals _parseXg(Map<String, dynamic> m) => ExpectedGoals(
        home: _toDouble(m['home']) ?? 0,
        away: _toDouble(m['away']) ?? 0,
      );

  static MatchStats _parseStats(Map<String, dynamic> m) => MatchStats(
        home: _parseTeam(m['home'] as Map<String, dynamic>? ?? {}),
        away: _parseTeam(m['away'] as Map<String, dynamic>? ?? {}),
        isReal: m['isReal'] == true,
      );

  static TeamStats _parseTeam(Map<String, dynamic> m) => TeamStats(
        ppg: _toDouble(m['ppg']) ?? 0,
        wins: _toDouble(m['wins']) ?? 0,
        draws: _toDouble(m['draws']) ?? 0,
        losses: _toDouble(m['losses']) ?? 0,
        avgScored: _toDouble(m['avgScored']) ?? 0,
        avgConceded: _toDouble(m['avgConceded']) ?? 0,
      );

  static LiveScore _parseLive(Map<String, dynamic> m) => LiveScore(
        homeScore: _toInt(m['home_score'] ?? m['homeScore']) ?? 0,
        awayScore: _toInt(m['away_score'] ?? m['awayScore']) ?? 0,
        minute: _toInt(m['minute']),
        period: m['period'] as String?,
      );

  static double? _toDouble(dynamic v) =>
      v == null ? null : double.tryParse(v.toString());

  static int? _toInt(dynamic v) =>
      v == null ? null : int.tryParse(v.toString());
}
