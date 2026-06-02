import '../../domain/entities/tennis_match.dart';

class TennisMatchModel extends TennisMatch {
  const TennisMatchModel({
    required super.id,
    required super.tour,
    required super.tournament,
    required super.surface,
    required super.player1,
    required super.player2,
    required super.sets,
    required super.status,
    super.isLive,
    super.servingPlayer,
    super.edge,
  });

  factory TennisMatchModel.fromJson(Map<String, dynamic> j) {
    final p1Raw = j['player1'] as Map<String, dynamic>? ?? {};
    final p2Raw = j['player2'] as Map<String, dynamic>? ?? {};

    return TennisMatchModel(
      id: j['id']?.toString() ?? '',
      tour: j['tour'] as String? ?? '',
      tournament: j['tournament'] as String? ?? '',
      surface: j['surface'] as String? ?? '',
      status: j['status'] as String? ?? '',
      isLive: j['is_live'] == true || j['status'] == 'live',
      servingPlayer: _toInt(j['serving_player']),
      player1: _parsePlayer(p1Raw),
      player2: _parsePlayer(p2Raw),
      sets: _parseSets(j['sets']),
      edge: _parseEdge(j),
    );
  }

  static TennisPlayer _parsePlayer(Map<String, dynamic> p) => TennisPlayer(
        name: p['name'] as String? ?? '',
        country: p['country'] as String?,
        eloRating: _toDouble(p['elo']),
        winProb: _toDouble(p['win_prob']),
      );

  static List<TennisSet> _parseSets(dynamic raw) {
    if (raw == null) return [];
    final list = raw as List<dynamic>;
    return list.map((s) {
      final m = s as Map<String, dynamic>;
      return TennisSet(
        p1Games: _toInt(m['p1']) ?? 0,
        p2Games: _toInt(m['p2']) ?? 0,
        p1Tiebreak: _toInt(m['p1_tb']),
        p2Tiebreak: _toInt(m['p2_tb']),
      );
    }).toList();
  }

  static TennisEdge? _parseEdge(Map<String, dynamic> j) {
    final edge = _toDouble(j['edge']);
    if (edge == null) return null;
    return TennisEdge(
      p1WinProb: _toDouble(j['p1_win_prob']),
      p2WinProb: _toDouble(j['p2_win_prob']),
      edge: edge,
      recommendation: j['recommendation'] as String?,
    );
  }

  static double? _toDouble(dynamic v) =>
      v == null ? null : double.tryParse(v.toString());

  static int? _toInt(dynamic v) =>
      v == null ? null : int.tryParse(v.toString());
}
