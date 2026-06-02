import 'package:equatable/equatable.dart';

class Match extends Equatable {
  final String id;
  final String sport;
  final String league;
  final String homeTeam;
  final String awayTeam;
  final DateTime commenceTime;
  final MatchOdds? odds;
  final MatchPoisson? poisson;
  final MatchEdge? bestEdge;
  final ExpectedGoals? xg;
  final MatchStats? stats;
  final bool isLive;
  final LiveScore? liveScore;
  final double? betfairWomBacking;
  final double? betfairWomLaying;

  const Match({
    required this.id,
    required this.sport,
    required this.league,
    required this.homeTeam,
    required this.awayTeam,
    required this.commenceTime,
    this.odds,
    this.poisson,
    this.bestEdge,
    this.xg,
    this.stats,
    this.isLive = false,
    this.liveScore,
    this.betfairWomBacking,
    this.betfairWomLaying,
  });

  bool get hasValueBet => (bestEdge?.edge ?? 0) > 5.0;

  @override
  List<Object?> get props => [id, homeTeam, awayTeam, commenceTime];
}

class MatchOdds extends Equatable {
  final double? home;
  final double? draw;
  final double? away;

  const MatchOdds({this.home, this.draw, this.away});

  @override
  List<Object?> get props => [home, draw, away];
}

class MatchPoisson extends Equatable {
  final int? over05;
  final int? over15;
  final int? over25;
  final int? over35;
  final int? btts;
  final int? homeWin;
  final int? draw;
  final int? awayWin;

  const MatchPoisson({
    this.over05,
    this.over15,
    this.over25,
    this.over35,
    this.btts,
    this.homeWin,
    this.draw,
    this.awayWin,
  });

  @override
  List<Object?> get props => [over25, btts, homeWin, draw, awayWin];
}

class MatchEdge extends Equatable {
  final String? label;
  final double? odds;
  final double? edge;
  final String? bookmaker;

  const MatchEdge({this.label, this.odds, this.edge, this.bookmaker});

  @override
  List<Object?> get props => [label, odds, edge, bookmaker];
}

class ExpectedGoals extends Equatable {
  final double home;
  final double away;

  const ExpectedGoals({required this.home, required this.away});

  @override
  List<Object?> get props => [home, away];
}

class MatchStats extends Equatable {
  final TeamStats home;
  final TeamStats away;
  final bool isReal;

  const MatchStats({
    required this.home,
    required this.away,
    required this.isReal,
  });

  @override
  List<Object?> get props => [home, away, isReal];
}

class TeamStats extends Equatable {
  final double ppg;
  final double wins;
  final double draws;
  final double losses;
  final double avgScored;
  final double avgConceded;

  const TeamStats({
    required this.ppg,
    required this.wins,
    required this.draws,
    required this.losses,
    required this.avgScored,
    required this.avgConceded,
  });

  @override
  List<Object?> get props => [ppg, wins, draws, losses];
}

class LiveScore extends Equatable {
  final int homeScore;
  final int awayScore;
  final int? minute;
  final String? period;

  const LiveScore({
    required this.homeScore,
    required this.awayScore,
    this.minute,
    this.period,
  });

  @override
  List<Object?> get props => [homeScore, awayScore, minute, period];
}
