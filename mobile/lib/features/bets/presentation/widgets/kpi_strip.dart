import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/bet.dart';

class KpiStrip extends StatelessWidget {
  final BankrollSummary summary;

  const KpiStrip({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    final plPositive = summary.plCents >= 0;
    final plColor = plPositive ? AppColors.green : AppColors.red;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Kpi(
                label: 'P&L',
                value:
                    '${plPositive ? '+' : ''}${summary.plEuros.toStringAsFixed(2)}€',
                color: plColor,
                large: true,
              ),
              _Kpi(
                label: 'ROI',
                value:
                    '${summary.roiPct >= 0 ? '+' : ''}${summary.roiPct.toStringAsFixed(1)}%',
                color: summary.roiPct >= 0 ? AppColors.green : AppColors.red,
                large: true,
              ),
              _Kpi(
                label: 'Win Rate',
                value: '${summary.winRatePct.toStringAsFixed(0)}%',
                color: AppColors.text,
                large: true,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Kpi(
                  label: 'Total',
                  value: '${summary.totalBets}',
                  color: AppColors.text2),
              _Kpi(
                  label: 'Gagnés',
                  value: '${summary.won}',
                  color: AppColors.green),
              _Kpi(
                  label: 'Perdus',
                  value: '${summary.lost}',
                  color: AppColors.red),
              _Kpi(
                  label: 'En cours',
                  value: '${summary.pending}',
                  color: AppColors.amber),
            ],
          ),
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool large;

  const _Kpi({
    required this.label,
    required this.value,
    required this.color,
    this.large = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(label,
            style:
                AppTextStyles.monoBadge.copyWith(color: AppColors.text3)),
        const SizedBox(height: 4),
        Text(
          value,
          style: large
              ? AppTextStyles.monoLarge
                  .copyWith(color: color, fontWeight: FontWeight.w700)
              : AppTextStyles.monoMedium.copyWith(color: color),
        ),
      ],
    );
  }
}
