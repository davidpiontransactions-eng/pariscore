import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../injection_container.dart';
import '../cubit/tennis_cubit.dart';
import '../widgets/tennis_match_card.dart';

class TennisPage extends StatelessWidget {
  const TennisPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<TennisCubit>()..loadMatches(),
      child: const _TennisView(),
    );
  }
}

class _TennisView extends StatelessWidget {
  const _TennisView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tennis'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: () => context.read<TennisCubit>().loadMatches(),
          ),
        ],
      ),
      body: BlocBuilder<TennisCubit, TennisState>(
        builder: (context, state) {
          return switch (state) {
            TennisLoading() => const Center(
                child: CircularProgressIndicator(color: AppColors.blue),
              ),
            TennisError(:final message) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.wifi_off_outlined,
                        size: 48, color: AppColors.text3),
                    const SizedBox(height: 12),
                    Text(message, style: AppTextStyles.bodyMedium),
                    TextButton(
                      onPressed: () =>
                          context.read<TennisCubit>().loadMatches(),
                      child: const Text('Réessayer'),
                    ),
                  ],
                ),
              ),
            TennisLoaded(:final matches) => matches.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.sports_tennis_outlined,
                            size: 48, color: AppColors.text3),
                        SizedBox(height: 12),
                        Text('Aucun match en cours',
                            style: AppTextStyles.bodyMedium),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: matches.length,
                    itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: 1),
                        duration:
                            Duration(milliseconds: 300 + index * 40),
                        curve: Curves.easeOut,
                        builder: (context, v, child) => Opacity(
                          opacity: v,
                          child: Transform.translate(
                            offset: Offset(0, 16 * (1 - v)),
                            child: child,
                          ),
                        ),
                        child: TennisMatchCard(match: matches[index]),
                      ),
                    ),
                  ),
            _ => const SizedBox.shrink(),
          };
        },
      ),
    );
  }
}
