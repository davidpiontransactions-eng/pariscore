import '../../domain/entities/wc_entities.dart';

class WcOverviewModel extends WcOverview {
  const WcOverviewModel({required super.groups, required super.upcoming});

  factory WcOverviewModel.fromJson(Map<String, dynamic> j) {
    final groupsList = (j['groups'] as List<dynamic>? ?? [])
        .map((g) => _parseGroup(g as Map<String, dynamic>))
        .toList();
    final upcomingList = (j['upcoming'] as List<dynamic>? ??
            j['matches'] as List<dynamic>? ?? [])
        .map((m) => _parseMatch(m as Map<String, dynamic>))
        .toList();
    return WcOverviewModel(groups: groupsList, upcoming: upcomingList);
  }

  static WcGroup _parseGroup(Map<String, dynamic> g) => WcGroup(
        name: g['name'] as String? ?? g['group'] as String? ?? '',
        teams: (g['teams'] as List<dynamic>? ?? g['standings'] as List<dynamic>? ?? [])
            .map((t) => _parseStanding(t as Map<String, dynamic>))
            .toList(),
      );

  static WcTeamStanding _parseStanding(Map<String, dynamic> t) => WcTeamStanding(
        team: t['team'] as String? ?? t['name'] as String? ?? '',
        flag: t['flag'] as String? ?? t['country_code'] as String?,
        played: _i(t['played'] ?? t['mp']) ?? 0,
        won: _i(t['won'] ?? t['w']) ?? 0,
        drawn: _i(t['drawn'] ?? t['d']) ?? 0,
        lost: _i(t['lost'] ?? t['l']) ?? 0,
        gf: _i(t['gf'] ?? t['goals_for']) ?? 0,
        ga: _i(t['ga'] ?? t['goals_against']) ?? 0,
        pts: _i(t['pts'] ?? t['points']) ?? 0,
      );

  static WcScheduleMatch _parseMatch(Map<String, dynamic> m) => WcScheduleMatch(
        id: m['id']?.toString() ?? '',
        homeTeam: m['home_team'] as String? ?? m['home'] as String? ?? '',
        awayTeam: m['away_team'] as String? ?? m['away'] as String? ?? '',
        homeFlag: m['home_flag'] as String?,
        awayFlag: m['away_flag'] as String?,
        date: m['date'] as String? ?? m['commence_date'] as String?,
        time: m['time'] as String? ?? m['kick_off'] as String?,
        status: m['status'] as String? ?? 'scheduled',
        homeScore: _i(m['home_score'] ?? m['score_home']),
        awayScore: _i(m['away_score'] ?? m['score_away']),
        phase: m['phase'] as String? ?? m['round'] as String?,
        venue: m['venue'] as String? ?? m['stadium'] as String?,
      );

  static int? _i(dynamic v) => v == null ? null : int.tryParse(v.toString());
}
