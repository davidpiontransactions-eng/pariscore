import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/ai_scout/presentation/pages/ai_scout_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/bets/presentation/pages/bets_page.dart';
import '../../features/football/domain/entities/match.dart';
import '../../features/football/presentation/pages/football_page.dart';
import '../../features/football/presentation/pages/match_detail_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/live/presentation/pages/live_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/tennis/presentation/pages/tennis_page.dart';

class AppRouter {
  AppRouter._();

  static const String home = '/';
  static const String login = '/login';
  static const String football = '/football';
  static const String tennis = '/tennis';
  static const String live = '/live';
  static const String aiScout = '/ai-scout';
  static const String bets = '/bets';
  static const String profile = '/profile';
  static const String matchDetail = '/match/:id';

  static String matchDetailPath(String id) => '/match/$id';

  static final GoRouter router = GoRouter(
    initialLocation: football,
    debugLogDiagnostics: false,
    routes: [
      // Shell — bottom nav
      ShellRoute(
        builder: (context, state, child) => HomePage(child: child),
        routes: [
          GoRoute(
            path: football,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: FootballPage()),
          ),
          GoRoute(
            path: tennis,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: TennisPage()),
          ),
          GoRoute(
            path: live,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: LivePage()),
          ),
          GoRoute(
            path: aiScout,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: AiScoutPage()),
          ),
          GoRoute(
            path: bets,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: BetsPage()),
          ),
          GoRoute(
            path: profile,
            pageBuilder: (_, __) =>
                const NoTransitionPage(child: ProfilePage()),
          ),
        ],
      ),
      GoRoute(path: home, redirect: (_, __) => football),
      GoRoute(
        path: login,
        builder: (_, __) => const LoginPage(),
      ),
      GoRoute(
        path: matchDetail,
        builder: (context, state) {
          final match = state.extra as Match?;
          if (match == null) {
            return const Scaffold(
              body: Center(child: Text('Match introuvable')),
            );
          }
          return MatchDetailPage(match: match);
        },
      ),
    ],
  );
}
