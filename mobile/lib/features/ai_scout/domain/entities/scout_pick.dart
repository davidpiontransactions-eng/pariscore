import 'package:equatable/equatable.dart';

class ScoutPick extends Equatable {
  final String type; // 'combined', 'confident', 'outsider'
  final String label;
  final String analysis;
  final double? edge;
  final double? odds;
  final String? league;

  const ScoutPick({
    required this.type,
    required this.label,
    required this.analysis,
    this.edge,
    this.odds,
    this.league,
  });

  String get emoji => switch (type) {
        'combined' => '🎯',
        'confident' => '💎',
        'outsider' => '🎲',
        _ => '⚡',
      };

  String get typeLabel => switch (type) {
        'combined' => 'Combiné du jour',
        'confident' => 'Grosse confiance',
        'outsider' => 'Outsider',
        _ => type,
      };

  @override
  List<Object?> get props => [type, label, edge];
}
