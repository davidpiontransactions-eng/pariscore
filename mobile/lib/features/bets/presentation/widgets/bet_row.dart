import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/extensions.dart';
import '../../domain/entities/bet.dart';

class BetRow extends StatelessWidget {
  final Bet bet;
  final VoidCallback? onSettle;

  const BetRow({super.key, required this.bet, this.onSettle});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (bet.status) {
      BetStatus.won => AppColors.green,
      BetStatus.lost => AppColors.red,
      BetStatus.halfWon => AppColors.green,
      BetStatus.halfLost => AppColors.red,
      BetStatus.cashout => AppColors.amber,
      _ => AppColors.text3,
    };

    final statusLabel = switch (bet.status) {
      BetStatus.won => 'GAGNÉ',
      BetStatus.lost => 'PERDU',
      BetStatus.halfWon => '½ G',
      BetStatus.halfLost => '½ P',
      BetStatus.cashout => 'CO',
      BetStatus.voidBet => 'VOID',
      _ => 'EN COURS',
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: bet.isSettled
              ? statusColor.withOpacity(0.2)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  bet.selectionLabel,
                  style: AppTextStyles.labelLarge,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(5),
                  border:
                      Border.all(color: statusColor.withOpacity(0.4), width: 0.5),
                ),
                child: Text(
                  statusLabel,
                  style: AppTextStyles.monoBadge.copyWith(color: statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              if (bet.homeTeam != null)
                Expanded(
                  child: Text(
                    '${bet.homeTeam} vs ${bet.awayTeam ?? '?'}',
                    style: AppTextStyles.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                )
              else
                Expanded(
                  child: Text(bet.market, style: AppTextStyles.bodySmall),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Tag(label: bet.odds.odds2),
              _Tag(label: '${bet.stakeEuros.toStringAsFixed(2)}€'),
              if (bet.bookmaker != null)
                _Tag(label: bet.bookmaker!.toUpperCase()),
              if (bet.plEuros != null)
                Text(
                  '${bet.plEuros! >= 0 ? '+' : ''}${bet.plEuros!.toStringAsFixed(2)}€',
                  style: AppTextStyles.monoMedium.copyWith(
                    color: bet.plEuros! >= 0 ? AppColors.green : AppColors.red,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              Text(
                bet.createdAt.ddmm,
                style: AppTextStyles.monoBadge.copyWith(color: AppColors.text3),
              ),
              if (!bet.isSettled && onSettle != null) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onSettle,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.green.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: AppColors.green.withOpacity(0.4), width: 0.5),
                    ),
                    child: Text('Régler',
                        style: AppTextStyles.monoBadge.copyWith(color: AppColors.green)),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;

  const _Tag({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.bg3,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Text(label, style: AppTextStyles.monoBadge.copyWith(color: AppColors.text2)),
    );
  }
}
