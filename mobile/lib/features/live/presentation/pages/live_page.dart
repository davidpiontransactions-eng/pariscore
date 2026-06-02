import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../../../football/presentation/widgets/match_card.dart';
import '../cubit/live_cubit.dart';

class LivePage extends StatelessWidget {
  const LivePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<LiveCubit>()..connect(),
      child: const _LiveView(),
    );
  }
}

class _LiveView extends StatelessWidget {
  const _LiveView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.3, end: 1.0),
              duration: const Duration(milliseconds: 800),
              builder: (_, v, __) => Opacity(
                opacity: v,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.red,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text('Live'),
          ],
        ),
      ),
      body: BlocBuilder<LiveCubit, LiveState>(
        builder: (context, state) {
          return switch (state) {
            LiveConnecting() => const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: AppColors.red),
                    SizedBox(height: 16),
                    Text('Connexion au flux live…',
                        style: AppTextStyles.bodyMedium),
                  ],
                ),
              ),
            LiveError(:final message) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.signal_wifi_off_outlined,
                        size: 48, color: AppColors.text3),
                    const SizedBox(height: 12),
                    Text(message, style: AppTextStyles.bodyMedium),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => context.read<LiveCubit>().connect(),
                      child: const Text('Reconnecter'),
                    ),
                  ],
                ),
              ),
            LiveConnected(:final matches) => matches.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.sports_outlined,
                            size: 48, color: AppColors.text3),
                        SizedBox(height: 12),
                        Text('Aucun match en direct',
                            style: AppTextStyles.bodyMedium),
                        SizedBox(height: 4),
                        Text('Les matchs apparaîtront ici en temps réel',
                            style: AppTextStyles.bodySmall),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: matches.length,
                    itemBuilder: (context, i) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: MatchCard(match: matches[i]),
                    ),
                  ),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }
}
