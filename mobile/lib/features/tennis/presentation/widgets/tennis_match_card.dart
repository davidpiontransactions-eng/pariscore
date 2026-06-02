import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/tennis_match.dart';

class TennisMatchCard extends StatelessWidget {
  final TennisMatch match;
  final VoidCallback? onTap;

  const TennisMatchCard({super.key, required this.match, this.onTap});

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
              Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 12),
              _EdgeRow(edge: match.edge!),
            ],
          ],
        ),
      ),
    );
  }
}

class _SurfaceChip extends StatelessWidget {
  final String surface;

  const _SurfaceChip({required this.surface});

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
  final TennisPlayer player;
  final List<int> sets;
  final bool isServing;

  const _PlayerRow({
    required this.player,
    required this.sets,
    required this.isServing,
  });

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
  final TennisEdge edge;

  const _EdgeRow({required this.edge});

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
