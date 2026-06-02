import 'package:equatable/equatable.dart';

class TennisMatch extends Equatable {
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
  });

  @override
  List<Object?> get props => [id, player1, player2, status];
}

class TennisPlayer extends Equatable {
  final String name;
  final String? country;
  final double? eloRating;
  final double? winProb;

  const TennisPlayer({
    required this.name,
    this.country,
    this.eloRating,
    this.winProb,
  });

  @override
  List<Object?> get props => [name, country];
}

class TennisSet extends Equatable {
  final int p1Games;
  final int p2Games;
  final int? p1Tiebreak;
  final int? p2Tiebreak;

  const TennisSet({
    required this.p1Games,
    required this.p2Games,
    this.p1Tiebreak,
    this.p2Tiebreak,
  });

  @override
  List<Object?> get props => [p1Games, p2Games];
}

class TennisEdge extends Equatable {
  final double? p1WinProb;
  final double? p2WinProb;
  final double? edge;
  final String? recommendation;

  const TennisEdge({
    this.p1WinProb,
    this.p2WinProb,
    this.edge,
    this.recommendation,
  });

  @override
  List<Object?> get props => [p1WinProb, p2WinProb, edge];
}
