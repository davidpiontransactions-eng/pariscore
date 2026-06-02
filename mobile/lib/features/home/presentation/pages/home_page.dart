import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_colors.dart';

class HomePage extends StatelessWidget {
  final Widget child;

  const HomePage({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNav(location: location),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final String location;

  const _BottomNav({required this.location});

  int get _index {
    if (location.startsWith(AppRouter.live)) return 1;
    if (location.startsWith(AppRouter.tennis)) return 2;
    if (location.startsWith(AppRouter.aiScout)) return 3;
    if (location.startsWith(AppRouter.bets)) return 4;
    if (location.startsWith(AppRouter.profile)) return 5;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg2,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: NavigationBar(
        backgroundColor: AppColors.bg2,
        indicatorColor: AppColors.green.withOpacity(0.12),
        selectedIndex: _index,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go(AppRouter.football);
            case 1: context.go(AppRouter.live);
            case 2: context.go(AppRouter.tennis);
            case 3: context.go(AppRouter.aiScout);
            case 4: context.go(AppRouter.bets);
            case 5: context.go(AppRouter.profile);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.sports_soccer_outlined, color: AppColors.text3),
            selectedIcon: Icon(Icons.sports_soccer, color: AppColors.green),
            label: 'Football',
          ),
          NavigationDestination(
            icon: Icon(Icons.fiber_manual_record_outlined, color: AppColors.text3),
            selectedIcon: Icon(Icons.fiber_manual_record, color: AppColors.red),
            label: 'Live',
          ),
          NavigationDestination(
            icon: Icon(Icons.sports_tennis_outlined, color: AppColors.text3),
            selectedIcon: Icon(Icons.sports_tennis, color: AppColors.blue),
            label: 'Tennis',
          ),
          NavigationDestination(
            icon: Icon(Icons.psychology_outlined, color: AppColors.text3),
            selectedIcon: Icon(Icons.psychology, color: AppColors.amber),
            label: 'IA Scout',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined, color: AppColors.text3),
            selectedIcon: Icon(Icons.receipt_long, color: AppColors.green),
            label: 'Paris',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline, color: AppColors.text3),
            selectedIcon: Icon(Icons.person, color: AppColors.text),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
