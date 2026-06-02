import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../cubit/matches_cubit.dart';
import '../widgets/match_card.dart';

class FootballPage extends StatelessWidget {
  const FootballPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<MatchesCubit>()..loadMatches(),
      child: const _FootballView(),
    );
  }
}

class _FootballView extends StatefulWidget {
  const _FootballView();

  @override
  State<_FootballView> createState() => _FootballViewState();
}

class _FootballViewState extends State<_FootballView> {
  String? _activeLeague;

  static const _leagues = [
    (key: null, label: 'Tous'),
    (key: 'soccer_france_ligue1', label: 'Ligue 1'),
    (key: 'soccer_epl', label: 'Premier League'),
    (key: 'soccer_spain_la_liga', label: 'La Liga'),
    (key: 'soccer_germany_bundesliga', label: 'Bundesliga'),
    (key: 'soccer_italy_serie_a', label: 'Serie A'),
    (key: 'soccer_uefa_champs_league', label: 'UCL'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(
                color: AppColors.green,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text('PARI', style: TextStyle(color: AppColors.green)),
            const Text('SCORE'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: () =>
                context.read<MatchesCubit>().loadMatches(league: _activeLeague),
            tooltip: 'Actualiser',
          ),
        ],
      ),
      body: Column(
        children: [
          _LeagueFilter(
            leagues: _leagues,
            activeKey: _activeLeague,
            onSelect: (key) {
              setState(() => _activeLeague = key);
              context.read<MatchesCubit>().filterByLeague(key);
            },
          ),
          Expanded(child: _MatchesList()),
        ],
      ),
    );
  }
}

class _LeagueFilter extends StatelessWidget {
  final List<({String? key, String label})> leagues;
  final String? activeKey;
  final ValueChanged<String?> onSelect;

  const _LeagueFilter({
    required this.leagues,
    required this.activeKey,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: leagues.length,
        itemBuilder: (context, i) {
          final l = leagues[i];
          final isActive = l.key == activeKey;
          return FilterChip(
            label: Text(l.label),
            selected: isActive,
            onSelected: (_) => onSelect(l.key),
            labelStyle: AppTextStyles.monoBadge.copyWith(
              color: isActive ? AppColors.green : AppColors.text2,
            ),
          );
        },
      ),
    );
  }
}

class _MatchesList extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MatchesCubit, MatchesState>(
      builder: (context, state) {
        return switch (state) {
          MatchesLoading() => const Center(
              child: CircularProgressIndicator(color: AppColors.green),
            ),
          MatchesError(:final message) => _ErrorView(
              message: message,
              onRetry: () => context.read<MatchesCubit>().loadMatches(),
            ),
          MatchesLoaded(:final matches) => matches.isEmpty
              ? const _EmptyView()
              : _AnimatedList(matches: matches),
          _ => const SizedBox.shrink(),
        };
      },
    );
  }
}

class _AnimatedList extends StatelessWidget {
  final List<dynamic> matches;

  const _AnimatedList({required this.matches});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: matches.length,
      itemBuilder: (context, index) {
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: Duration(milliseconds: 300 + index * 40),
          curve: Curves.easeOut,
          builder: (context, value, child) => Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(0, 16 * (1 - value)),
              child: child,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: MatchCard(
                        match: matches[index],
                        onTap: () => context.push(
                          AppRouter.matchDetailPath(matches[index].id),
                          extra: matches[index],
                        ),
                      ),
          ),
        );
      },
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_outlined, size: 48, color: AppColors.text3),
          const SizedBox(height: 16),
          Text(message, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 16),
          TextButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.sports_soccer_outlined, size: 48, color: AppColors.text3),
          SizedBox(height: 12),
          Text('Aucun match disponible', style: AppTextStyles.bodyMedium),
        ],
      ),
    );
  }
}
