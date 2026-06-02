import 'package:equatable/equatable.dart';

class WcOverview extends Equatable {
  final List<WcGroup> groups;
  final List<WcScheduleMatch> upcoming;

  const WcOverview({required this.groups, required this.upcoming});

  @override
  List<Object?> get props => [groups, upcoming];
}

class WcGroup extends Equatable {
  final String name;
  final List<WcTeamStanding> teams;

  const WcGroup({required this.name, required this.teams});

  @override
  List<Object?> get props => [name];
}

class WcTeamStanding extends Equatable {
  final String team;
  final String? flag;
  final int played;
  final int won;
  final int drawn;
  final int lost;
  final int gf;
  final int ga;
  final int pts;

  const WcTeamStanding({
    required this.team,
    this.flag,
    required this.played,
    required this.won,
    required this.drawn,
    required this.lost,
    required this.gf,
    required this.ga,
    required this.pts,
  });

  int get gd => gf - ga;

  @override
  List<Object?> get props => [team, pts, gd];
}

class WcScheduleMatch extends Equatable {
  final String id;
  final String homeTeam;
  final String awayTeam;
  final String? homeFlag;
  final String? awayFlag;
  final String? date;
  final String? time;
  final String status;
  final int? homeScore;
  final int? awayScore;
  final String? phase;
  final String? venue;

  const WcScheduleMatch({
    required this.id,
    required this.homeTeam,
    required this.awayTeam,
    this.homeFlag,
    this.awayFlag,
    this.date,
    this.time,
    required this.status,
    this.homeScore,
    this.awayScore,
    this.phase,
    this.venue,
  });

  bool get isLive => status.toLowerCase().contains('live') ||
      status.toLowerCase().contains('progress');
  bool get isFinished => status.toLowerCase().contains('finish') ||
      status.toLowerCase() == 'ft';

  @override
  List<Object?> get props => [id, homeTeam, awayTeam, status];
}
