class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://pariscore.fr';

  // Auth
  static const String login = '/api/v1/auth/login';
  static const String register = '/api/v1/auth/register';
  static const String me = '/api/v1/auth/me';

  // Football
  static const String matches = '/api/v1/matches';
  static const String matchDetails = '/api/v1/match-details';
  static const String leagues = '/api/v1/leagues';
  static const String aiScout = '/api/v1/ai-scout';
  static const String insights = '/api/v1/insights';

  // Tennis
  static const String tennisLive = '/tennis/api/v2/matches/live';
  static const String tennisGlicko2 = '/api/v1/tennis/glicko2/stats';
  static const String tennisTop = '/api/v1/tennis/glicko2/top';
  static const String tennisMomentum = '/api/v1/tennis/momentum';

  // Live (SSE)
  static const String liveSse = '/api/v1/live';
  static const String livePredictions = '/api/v1/live/predictions';

  // Bets & Bankroll
  static const String bets = '/api/v1/bets';
  static const String bankrollSummary = '/api/v1/bankroll/summary';
  static const String bankrollPlan = '/api/v1/bankroll/plan';
  static const String betsKelly = '/api/v1/bets/kelly';

  // Status
  static const String status = '/api/v1/status';

  // Cache TTLs (seconds)
  static const int matchesTtl = 300;
  static const int tennisTtl = 60;
  static const int aiScoutTtl = 21600;
  static const int leaguesTtl = 86400;
}
