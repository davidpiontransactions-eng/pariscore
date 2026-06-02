import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/football/presentation/pages/football_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/live/presentation/pages/live_page.dart';
import '../../features/tennis/presentation/pages/tennis_page.dart';

class AppRouter {
  AppRouter._();

  // Route names — use these with context.go()
  static const String home = '/';
  static const String login = '/login';
  static const String football = '/football';
  static const String tennis = '/tennis';
  static const String live = '/live';
  static const String matchDetail = '/match/:id';
  static const String tennisMatch = '/tennis/match/:id';
  static const String aiScout = '/ai-scout';
  static const String profile = '/profile';

  static String matchDetailPath(String id) => '/match/$id';
  static String tennisMatchPath(String id) => '/tennis/match/$id';

  static final GoRouter router = GoRouter(
    initialLocation: football,
    debugLogDiagnostics: false,
    routes: [
      // Shell wraps football / tennis / live with bottom nav
      ShellRoute(
        builder: (context, state, child) => HomePage(child: child),
        routes: [
          GoRoute(
            path: football,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: FootballPage(),
            ),
          ),
          GoRoute(
            path: tennis,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: TennisPage(),
            ),
          ),
          GoRoute(
            path: live,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LivePage(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: home,
        redirect: (_, __) => football,
      ),
      GoRoute(
        path: login,
        builder: (context, state) => const LoginPage(),
      ),
    ],
  );
}
