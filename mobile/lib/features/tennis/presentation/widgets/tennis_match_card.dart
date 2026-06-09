import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/tennis_match.dart';

class TennisMatchCard extends StatelessWidget {
  const TennisMatchCard({super.key, required this.match, this.onTap});

  final TennisMatch match;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bg2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: match.isLive
                ? AppColors.blue.withOpacity(0.35)
                : AppColors.border,
            width: match.isLive ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tournament + surface
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${match.tournament} · ${match.tour}',
                    style:
                        AppTextStyles.monoSmall.copyWith(color: AppColors.text3),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _SurfaceChip(surface: match.surface),
              ],
            ),
            const SizedBox(height: 12),
            // Player 1
            _PlayerRow(
              player: match.player1,
              sets: match.sets.map((s) => s.p1Games).toList(),
              isServing: match.servingPlayer == 1,
            ),
            const SizedBox(height: 6),
            // Player 2
            _PlayerRow(
              player: match.player2,
              sets: match.sets.map((s) => s.p2Games).toList(),
              isServing: match.servingPlayer == 2,
            ),
            // Edge badge
            if (match.edge?.edge != null) ...[
              const SizedBox(height: 12),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 12),
              _EdgeRow(edge: match.edge!),
            ],
            // WOM
            if (match.betfairWom != null) ...[
              const SizedBox(height: 12),
              _TennisWomBar(wom: match.betfairWom!),
            ],
          ],
        ),
      ),
    );
  }
}

class _SurfaceChip extends StatelessWidget {
  const _SurfaceChip({required this.surface});

  final String surface;

  Color get _color => switch (surface.toLowerCase()) {
        'clay' => const Color(0xFFE07B54),
        'grass' => AppColors.green,
        'hard' => AppColors.blue,
        _ => AppColors.text3,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: _color.withOpacity(0.3), width: 0.5),
      ),
      child: Text(
        surface.toUpperCase(),
        style: AppTextStyles.monoBadge.copyWith(color: _color),
      ),
    );
  }
}

class _PlayerRow extends StatelessWidget {
  const _PlayerRow({
    required this.player,
    required this.sets,
    required this.isServing,
  });

  final TennisPlayer player;
  final List<int> sets;
  final bool isServing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (isServing)
          Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.only(right: 6),
            decoration: const BoxDecoration(
              color: AppColors.green,
              shape: BoxShape.circle,
            ),
          )
        else
          const SizedBox(width: 12),
        Expanded(
          child: Text(
            player.name,
            style: AppTextStyles.labelLarge,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        ...sets.map(
          (g) => Container(
            width: 24,
            alignment: Alignment.center,
            child: Text(
              '$g',
              style: AppTextStyles.monoMedium.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _EdgeRow extends StatelessWidget {
  const _EdgeRow({required this.edge});

  final TennisEdge edge;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (edge.p1WinProb != null)
          Text(
            '${(edge.p1WinProb! * 100).toStringAsFixed(0)}% / '
            '${((1 - edge.p1WinProb!) * 100).toStringAsFixed(0)}%',
            style: AppTextStyles.monoSmall,
          ),
        const Spacer(),
        if (edge.edge != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.blue.withOpacity(0.12),
              borderRadius: BorderRadius.circular(6),
              border:
                  Border.all(color: AppColors.blue.withOpacity(0.35)),
            ),
            child: Text(
              '+${edge.edge!.toStringAsFixed(1)}%',
              style: AppTextStyles.monoBadge.copyWith(
                color: AppColors.blue,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
      ],
    );
  }
}

class _TennisWomBar extends StatelessWidget {
  const _TennisWomBar({required this.wom});

  final WomData wom;

  @override
  Widget build(BuildContext context) {
    final total = wom.p1 + wom.p2;
    final p1Frac = total > 0 ? wom.p1 / total : 0.5;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bg3,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // P1 %
              Text(
                'P1 ${wom.p1.toStringAsFixed(1)}%',
                style: AppTextStyles.monoBadge.copyWith(
                  color: AppColors.blue,
                ),
              ),
              const Spacer(),
              Text(
                'WOM',
                style: AppTextStyles.monoBadge.copyWith(
                  color: AppColors.text3,
                ),
              ),
              const Spacer(),
              // P2 %
              Text(
                'P2 ${wom.p2.toStringAsFixed(1)}%',
                style: AppTextStyles.monoBadge.copyWith(
                  color: AppColors.amber,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Row(
              children: [
                Expanded(
                  flex: (p1Frac * 100).round().clamp(1, 99),
                  child: Container(height: 6, color: AppColors.blue),
                ),
                Expanded(
                  flex: ((1 - p1Frac) * 100).round().clamp(1, 99),
                  child: Container(height: 6, color: AppColors.amber),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
