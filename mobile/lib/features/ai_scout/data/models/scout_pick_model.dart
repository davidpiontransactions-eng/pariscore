import '../../domain/entities/scout_pick.dart';

class ScoutPickModel extends ScoutPick {
  const ScoutPickModel({
    required super.type,
    required super.label,
    required super.analysis,
    super.edge,
    super.odds,
    super.league,
  });

  factory ScoutPickModel.fromJson(Map<String, dynamic> j) => ScoutPickModel(
        type: j['type'] as String? ?? 'combined',
        label: j['label'] as String? ?? '',
        analysis: j['analysis'] as String? ?? j['text'] as String? ?? '',
        edge: _toDouble(j['edge']),
        odds: _toDouble(j['odds']),
        league: j['league'] as String?,
      );

  static double? _toDouble(dynamic v) =>
      v == null ? null : double.tryParse(v.toString());
}
