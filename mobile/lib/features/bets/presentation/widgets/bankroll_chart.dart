import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/daily_tracker.dart';

class BankrollChart extends StatelessWidget {
  final List<DailyTrackerEntry> data;

  const BankrollChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();

    final minY = data
            .map((e) => e.actualEuros < e.targetEuros ? e.actualEuros : e.targetEuros)
            .reduce((a, b) => a < b ? a : b) *
        0.97;
    final maxY = data
            .map((e) => e.actualEuros > e.targetEuros ? e.actualEuros : e.targetEuros)
            .reduce((a, b) => a > b ? a : b) *
        1.03;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 12),
            child: Row(
              children: [
                Text('Capital', style: AppTextStyles.labelMedium),
                const Spacer(),
                _Legend(color: AppColors.green, label: 'Réel'),
                const SizedBox(width: 12),
                _Legend(color: AppColors.text3, label: 'Objectif'),
              ],
            ),
          ),
          SizedBox(
            height: 140,
            child: LineChart(
              LineChartData(
                minY: minY,
                maxY: maxY,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: (maxY - minY) / 4,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: AppColors.border,
                    strokeWidth: 0.5,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 44,
                      getTitlesWidget: (val, meta) => Text(
                        '${val.toStringAsFixed(0)}€',
                        style: AppTextStyles.monoBadge
                            .copyWith(color: AppColors.text3, fontSize: 9),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: data.length > 14
                          ? (data.length / 7).ceilToDouble()
                          : 1,
                      getTitlesWidget: (val, meta) {
                        final i = val.toInt();
                        if (i < 0 || i >= data.length) {
                          return const SizedBox.shrink();
                        }
                        final d = data[i].date;
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            d.substring(5), // MM-DD
                            style: AppTextStyles.monoBadge.copyWith(
                                color: AppColors.text3, fontSize: 9),
                          ),
                        );
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => AppColors.bg3,
                    getTooltipItems: (spots) => spots.map((s) {
                      final i = s.x.toInt();
                      if (i < 0 || i >= data.length) return null;
                      final entry = data[i];
                      final isActual = s.barIndex == 0;
                      return LineTooltipItem(
                        isActual
                            ? '${entry.actualEuros.toStringAsFixed(2)}€'
                            : '${entry.targetEuros.toStringAsFixed(2)}€',
                        AppTextStyles.monoBadge.copyWith(
                          color: isActual ? AppColors.green : AppColors.text3,
                        ),
                      );
                    }).toList(),
                  ),
                ),
                lineBarsData: [
                  // Actual capital line
                  LineChartBarData(
                    spots: data.asMap().entries.map((e) =>
                        FlSpot(e.key.toDouble(), e.value.actualEuros)).toList(),
                    isCurved: true,
                    color: AppColors.green,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.green.withOpacity(0.12),
                          AppColors.green.withOpacity(0.0),
                        ],
                      ),
                    ),
                  ),
                  // Target line (dashed)
                  LineChartBarData(
                    spots: data.asMap().entries.map((e) =>
                        FlSpot(e.key.toDouble(), e.value.targetEuros)).toList(),
                    isCurved: false,
                    color: AppColors.text3,
                    barWidth: 1,
                    dashArray: [4, 4],
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(show: false),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;

  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 12, height: 2, color: color),
        const SizedBox(width: 4),
        Text(label,
            style: AppTextStyles.monoBadge.copyWith(color: AppColors.text3)),
      ],
    );
  }
}
