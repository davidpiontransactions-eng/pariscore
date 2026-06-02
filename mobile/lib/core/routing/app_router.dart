import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/ai_scout/presentation/pages/ai_scout_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/football/domain/entities/match.dart';
import '../../features/football/presentation/pages/football_page.dart';
import '../../features/football/presentation/pages/match_detail_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/live/presentation/pages/live_page.dart';
import '../../features/tennis/presentation/pages/tennis_page.dart';

class AppRouter {
  AppRouter._();

  static const String home = '/';
  static const String login = '/login';
  static const String football = '/football';
  static const String tennis = '/tennis';
  static const String live = '/live';
  static const String aiScout = '/ai-scout';
  static const String matchDetail = '/match/:id';
  static const String profile = '/profile';

  static String matchDetailPath(String id) => '/match/$id';

  static final GoRouter router = GoRouter(
    initialLocation: football,
    debugLogDiagnostics: false,
    routes: [
      // Shell — bottom nav wraps main tabs
      ShellRoute(
        builder: (context, state, child) => HomePage(child: child),
        routes: [
          GoRoute(
            path: football,
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: FootballPage()),
          ),
          GoRoute(
            path: tennis,
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: TennisPage()),
          ),
          GoRoute(
            path: live,
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: LivePage()),
          ),
          GoRoute(
            path: aiScout,
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: AiScoutPage()),
          ),
        ],
      ),
      // Full-screen routes outside shell
      GoRoute(
        path: home,
        redirect: (_, __) => football,
      ),
      GoRoute(
        path: login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: matchDetail,
        builder: (context, state) {
          final match = state.extra as Match?;
          if (match == null) return const _NotFoundPage();
          return MatchDetailPage(match: match);
        },
      ),
    ],
  );
}

class _NotFoundPage extends StatelessWidget {
  const _NotFoundPage();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('Match introuvable')),
    );
  }
}
