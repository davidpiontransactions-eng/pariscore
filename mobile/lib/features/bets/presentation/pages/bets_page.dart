import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/bet.dart';
import '../../domain/entities/daily_tracker.dart';
import '../cubit/bets_cubit.dart';
import '../widgets/add_bet_sheet.dart';
import '../widgets/bankroll_chart.dart';
import '../widgets/bet_row.dart';
import '../widgets/kpi_strip.dart';
import '../widgets/settle_bet_sheet.dart';

class BetsPage extends StatelessWidget {
  const BetsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<BetsCubit>()..load(),
      child: const _BetsView(),
    );
  }
}

class _BetsView extends StatelessWidget {
  const _BetsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Mes Paris', style: AppTextStyles.headlineLarge),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: () => context.read<BetsCubit>().load(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.green,
        foregroundColor: AppColors.bg,
        icon: const Icon(Icons.add),
        label: Text('Nouveau pari', style: AppTextStyles.labelMedium),
        onPressed: () => _showAddBetSheet(context),
      ),
      body: BlocBuilder<BetsCubit, BetsState>(
        builder: (context, state) {
          return switch (state) {
            BetsLoading() => Center(
                child: CircularProgressIndicator(color: AppColors.green),
              ),
            BetsError(:final message) => _ErrorView(
                message: message,
                onRetry: () => context.read<BetsCubit>().load(),
              ),
            BetsLoaded(:final bets, :final summary, :final tracker) => _BetsList(
                bets: bets,
                summary: summary,
                tracker: tracker,
              ),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }

  void _showAddBetSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bg2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<BetsCubit>(),
        child: const AddBetSheet(),
      ),
    );
  }
}

class _BetsList extends StatelessWidget {
  final List<Bet> bets;
  final BankrollSummary? summary;
  final List<DailyTrackerEntry> tracker;

  const _BetsList({required this.bets, this.summary, this.tracker = const []});

  void _showSettleSheet(BuildContext context, Bet bet) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bg2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<BetsCubit>(),
        child: SettleBetSheet(bet: bet),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (bets.isEmpty && summary == null) return const _EmptyView();

    return CustomScrollView(
      slivers: [
        if (summary != null)
          SliverToBoxAdapter(
            child: KpiStrip(summary: summary!),
          ),
        if (tracker.isNotEmpty)
          SliverToBoxAdapter(
            child: BankrollChart(data: tracker),
          ),
        if (bets.isEmpty)
          const SliverFillRemaining(child: _EmptyView())
        else ...[
          _SectionHeader(
            title: 'Paris en cours',
            count: bets.where((b) => !b.isSettled).length,
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final pending =
                    bets.where((b) => !b.isSettled).toList();
                if (i >= pending.length) return null;
                return TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: Duration(milliseconds: 250 + i * 30),
                  curve: Curves.easeOut,
                  builder: (_, v, child) => Opacity(
                    opacity: v,
                    child: Transform.translate(
                      offset: Offset(0, 12 * (1 - v)),
                      child: child,
                    ),
                  ),
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: BetRow(
                      bet: pending[i],
                      onSettle: () => _showSettleSheet(context, pending[i]),
                    ),
                  ),
                );
              },
              childCount: bets.where((b) => !b.isSettled).length,
            ),
          ),
          _SectionHeader(
            title: 'Historique',
            count: bets.where((b) => b.isSettled).length,
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final settled = bets.where((b) => b.isSettled).toList();
                if (i >= settled.length) return null;
                return Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 4),
                  child: BetRow(bet: settled[i]),
                );
              },
              childCount: bets.where((b) => b.isSettled).length,
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 100)),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final int count;

  const _SectionHeader({required this.title, required this.count});

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Row(
          children: [
            Text(title, style: AppTextStyles.labelLarge),
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.bg3,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count', style: AppTextStyles.monoBadge),
            ),
          ],
        ),
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
          const Icon(Icons.lock_outline, size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          Text(message, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 4),
          Text('Connectez-vous pour voir vos paris',
              style: AppTextStyles.bodySmall),
          const SizedBox(height: 16),
          TextButton(
              onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.receipt_long_outlined,
              size: 48, color: AppColors.text3),
          SizedBox(height: 12),
          Text('Aucun pari enregistré',
              style: AppTextStyles.bodyMedium),
          SizedBox(height: 4),
          Text('Appuyez sur + pour saisir un pari',
              style: AppTextStyles.bodySmall),
        ],
      ),
    );
  }
}
