import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/wc_entities.dart';
import '../cubit/wc_cubit.dart';
import '../widgets/group_table.dart';

class WorldCupPage extends StatelessWidget {
  const WorldCupPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<WcCubit>()..load(),
      child: const _WcView(),
    );
  }
}

class _WcView extends StatelessWidget {
  const _WcView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('🏆', style: TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Text('Coupe du Monde 2026', style: AppTextStyles.headlineMedium),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: () => context.read<WcCubit>().load(),
          ),
        ],
      ),
      body: BlocBuilder<WcCubit, WcState>(
        builder: (context, state) {
          return switch (state) {
            WcLoading() => const Center(
                child: CircularProgressIndicator(color: AppColors.green),
              ),
            WcError(:final message) => _ErrorView(
                message: message,
                onRetry: () => context.read<WcCubit>().load(),
              ),
            WcLoaded(:final overview) => RefreshIndicator(
                color: AppColors.green,
                backgroundColor: AppColors.bg2,
                onRefresh: () => context.read<WcCubit>().load(),
                child: _WcContent(overview: overview),
              ),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }
}

class _WcContent extends StatelessWidget {
  final WcOverview overview;

  const _WcContent({required this.overview});

  @override
  Widget build(BuildContext context) {
    if (overview.groups.isEmpty && overview.upcoming.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          Center(
            child: Column(
              children: [
                const Icon(Icons.emoji_events_outlined,
                    size: 48, color: AppColors.text3),
                const SizedBox(height: 12),
                Text('Données indisponibles',
                    style: AppTextStyles.bodyMedium),
                const SizedBox(height: 4),
                Text('La Coupe du Monde commence le 11 juin 2026',
                    style: AppTextStyles.bodySmall),
              ],
            ),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        // Upcoming matches
        if (overview.upcoming.isNotEmpty) ...[
          Text('Prochains matchs', style: AppTextStyles.labelLarge),
          const SizedBox(height: 10),
          ...overview.upcoming.take(5).map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _WcMatchRow(match: m),
              )),
          const SizedBox(height: 20),
        ],
        // Groups
        if (overview.groups.isNotEmpty) ...[
          Text('Classement des groupes', style: AppTextStyles.labelLarge),
          const SizedBox(height: 10),
          ...overview.groups.asMap().entries.map((e) =>
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: Duration(milliseconds: 250 + e.key * 50),
                curve: Curves.easeOut,
                builder: (_, v, child) => Opacity(
                  opacity: v,
                  child: Transform.translate(
                    offset: Offset(0, 12 * (1 - v)),
                    child: child,
                  ),
                ),
                child: GroupTable(group: e.value),
              )),
        ],
      ],
    );
  }
}

class _WcMatchRow extends StatelessWidget {
  final WcScheduleMatch match;

  const _WcMatchRow({required this.match});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: match.isLive
              ? AppColors.green.withOpacity(0.35)
              : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(match.homeTeam,
                style: AppTextStyles.bodyMedium,
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: match.isFinished || match.isLive
                ? Text('${match.homeScore ?? 0} - ${match.awayScore ?? 0}',
                    style: AppTextStyles.monoLarge
                        .copyWith(fontWeight: FontWeight.w700))
                : Column(
                    children: [
                      Text(match.time ?? '–',
                          style: AppTextStyles.monoSmall),
                      if (match.date != null)
                        Text(match.date!.length >= 5
                            ? match.date!.substring(5)
                            : match.date!,
                            style: AppTextStyles.monoBadge
                                .copyWith(color: AppColors.text3)),
                    ],
                  ),
          ),
          Expanded(
            child: Text(match.awayTeam,
                style: AppTextStyles.bodyMedium,
                overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
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
          const Icon(Icons.emoji_events_outlined,
              size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          Text(message, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 16),
          TextButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}
