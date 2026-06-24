import 'package:equatable/equatable.dart';

class TennisMatch extends Equatable {
  const TennisMatch({
    required this.id,
    required this.tour,
    required this.tournament,
    required this.surface,
    required this.player1,
    required this.player2,
    required this.sets,
    required this.status,
    this.isLive = false,
    this.servingPlayer,
    this.edge,
    this.betfairWom,
    this.dominanceRatioP1,
    this.dominanceRatioP2,
    this.pressure,
    this.intensity,
    this.odds,
  });

  final String id;
  final String tour;
  final String tournament;
  final String surface;
  final TennisPlayer player1;
  final TennisPlayer player2;
  final List<TennisSet> sets;
  final String status;
  final bool isLive;
  final int? servingPlayer;
  final TennisEdge? edge;
  final WomData? betfairWom;

  // === NOUVEAUX CHAMPS TRADING PREMIUM ===
  final double? dominanceRatioP1;
  final double? dominanceRatioP2;
  final int? pressure;
  final String? intensity; // 'serré' | 'tendu' | 'déséquilibré'
  final List<TennisOdds>? odds;

  /// DR combiné : TRUE si les deux DR sont proches (≤ 0.15 d'écart)
  bool get isTight => dominanceRatioP1 != null && dominanceRatioP2 != null
      ? (dominanceRatioP1! - dominanceRatioP2!).abs() <= 0.15
      : false;

  /// Recommandation trading automatique basée sur le DR
  String get tradingAdvice {
    if (isTight) return 'Match serré — observer avant de miser';
    if (dominanceRatioP1 == null || dominanceRatioP2 == null) return '';
    return dominanceRatioP1! > dominanceRatioP2!
        ? 'Joueuse 1 en domination — opportunité'
        : 'Joueuse 2 en domination — opportunité';
  }

  @override
  List<Object?> get props => [
        id, player1, player2, status, betfairWom,
        dominanceRatioP1, dominanceRatioP2, pressure, odds,
      ];
}

class TennisPlayer extends Equatable {
  const TennisPlayer({
    required this.name,
    this.country,
    this.eloRating,
    this.winProb,
    this.rank,       // NOUVEAU
    this.photoUrl,   // NOUVEAU
    this.eloDelta,   // NOUVEAU
  });

  final String name;
  final String? country;
  final double? eloRating;
  final double? winProb;
  final int? rank;
  final String? photoUrl;
  final int? eloDelta; // Différence ELO vs adversaire (affiché en vert/rouge)

  /// Initiales pour le fallback avatar
  String get initials => name.isNotEmpty
      ? name.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join()
      : '??';

  @override
  List<Object?> get props => [name, country, rank];
}

class TennisSet extends Equatable {
  const TennisSet({
    required this.p1Games,
    required this.p2Games,
    this.p1Tiebreak,
    this.p2Tiebreak,
  });

  final int p1Games;
  final int p2Games;
  final int? p1Tiebreak;
  final int? p2Tiebreak;

  @override
  List<Object?> get props => [p1Games, p2Games];
}

class TennisEdge extends Equatable {
  const TennisEdge({
    this.p1WinProb,
    this.p2WinProb,
    this.edge,
    this.recommendation,
  });

  final double? p1WinProb;
  final double? p2WinProb;
  final double? edge;
  final String? recommendation;

  @override
  List<Object?> get props => [p1WinProb, p2WinProb, edge];
}

class WomData extends Equatable {
  const WomData({
    required this.p1,
    required this.p2,
    required this.totalMatched,
    this.currency,
    this.marketId,
    this.ts,
  });

  final double p1;
  final double p2;
  final double totalMatched;
  final String? currency;
  final String? marketId;
  final int? ts;

  @override
  List<Object?> get props => [p1, p2, totalMatched];
}

/// NOUVEAU Modèle pour les cotes de trading
class TennisOdds extends Equatable {
  const TennisOdds({
    required this.label,
    required this.probability,
    required this.cote,
  });

  final String label;       // ex: "O 7.5", "U 12.5"
  final double probability; // ex: 82.0 (pourcentage)
  final double cote;        // ex: 1.45

  String get probabilityDisplay => '${probability.round()}%';
  String get coteDisplay => cote.toStringAsFixed(2);

  @override
  List<Object?> get props => [label, probability, cote];
}
