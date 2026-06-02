import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/scout_pick.dart';
import '../cubit/scout_cubit.dart';

class AiScoutPage extends StatelessWidget {
  const AiScoutPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ScoutCubit>()..load(),
      child: const _AiScoutView(),
    );
  }
}

class _AiScoutView extends StatelessWidget {
  const _AiScoutView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [AppColors.green, AppColors.blue],
              ).createShader(bounds),
              child: Text('IA',
                  style: AppTextStyles.headlineLarge.copyWith(color: Colors.white)),
            ),
            const SizedBox(width: 6),
            Text('Scout', style: AppTextStyles.headlineLarge),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: () => context.read<ScoutCubit>().load(),
          ),
        ],
      ),
      body: BlocBuilder<ScoutCubit, ScoutState>(
        builder: (context, state) {
          return switch (state) {
            ScoutLoading() => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: AppColors.green),
                    SizedBox(height: 16),
                    Text('Gemini analyse les matchs…',
                        style: AppTextStyles.bodyMedium),
                    SizedBox(height: 4),
                    Text('Peut prendre quelques secondes',
                        style: AppTextStyles.bodySmall),
                  ],
                ),
              ),
            ScoutError(:final message) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.psychology_outlined,
                        size: 48, color: AppColors.text3),
                    const SizedBox(height: 12),
                    Text(message, style: AppTextStyles.bodyMedium),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => context.read<ScoutCubit>().load(),
                      child: const Text('Réessayer'),
                    ),
                  ],
                ),
              ),
            ScoutLoaded(:final picks) => picks.isEmpty
                ? const _EmptyView()
                : _PicksList(picks: picks),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }
}

class _PicksList extends StatelessWidget {
  final List<ScoutPick> picks;

  const _PicksList({required this.picks});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      itemCount: picks.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) return const _ScoutHeader();
        final pick = picks[index - 1];
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: Duration(milliseconds: 350 + index * 80),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(
            opacity: v,
            child: Transform.translate(
              offset: Offset(0, 20 * (1 - v)),
              child: child,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _PickCard(pick: pick),
          ),
        );
      },
    );
  }
}

class _ScoutHeader extends StatelessWidget {
  const _ScoutHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.green.withOpacity(0.08),
            AppColors.blue.withOpacity(0.06),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.green.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.psychology_outlined,
              color: AppColors.green, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Analyse Gemini',
                    style: AppTextStyles.labelLarge
                        .copyWith(color: AppColors.green)),
                Text(
                  'Sélection des meilleures opportunités du jour basée sur Edge + Poisson',
                  style: AppTextStyles.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PickCard extends StatelessWidget {
  final ScoutPick pick;

  const _PickCard({required this.pick});

  @override
  Widget build(BuildContext context) {
    final color = switch (pick.type) {
      'combined' => AppColors.green,
      'confident' => AppColors.blue,
      'outsider' => AppColors.amber,
      _ => AppColors.text2,
    };

    return Container(
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.08),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                Text(pick.emoji,
                    style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Text(pick.typeLabel,
                    style: AppTextStyles.labelLarge
                        .copyWith(color: color)),
                const Spacer(),
                if (pick.odds != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: color.withOpacity(0.4), width: 0.5),
                    ),
                    child: Text(
                      pick.odds!.toStringAsFixed(2),
                      style: AppTextStyles.monoBadge.copyWith(color: color),
                    ),
                  ),
              ],
            ),
          ),
          // Analysis text
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              pick.analysis,
              style: AppTextStyles.bodyMedium
                  .copyWith(height: 1.6, color: AppColors.text),
            ),
          ),
          // League + edge footer
          if (pick.league != null || pick.edge != null)
            Padding(
              padding:
                  const EdgeInsets.only(left: 16, right: 16, bottom: 14),
              child: Row(
                children: [
                  if (pick.league != null)
                    Text(pick.league!,
                        style: AppTextStyles.monoSmall
                            .copyWith(color: AppColors.text3)),
                  const Spacer(),
                  if (pick.edge != null)
                    Text(
                      'Edge +${pick.edge!.toStringAsFixed(1)}%',
                      style: AppTextStyles.monoBadge
                          .copyWith(color: AppColors.green),
                    ),
                ],
              ),
            ),
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
          Icon(Icons.psychology_outlined, size: 48, color: AppColors.text3),
          SizedBox(height: 12),
          Text('Aucune sélection disponible', style: AppTextStyles.bodyMedium),
          SizedBox(height: 4),
          Text('Les analyses se rechargent toutes les 6h',
              style: AppTextStyles.bodySmall),
        ],
      ),
    );
  }
}
