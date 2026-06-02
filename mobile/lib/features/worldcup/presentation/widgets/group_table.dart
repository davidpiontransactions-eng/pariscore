import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/wc_entities.dart';

class GroupTable extends StatelessWidget {
  final WcGroup group;

  const GroupTable({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Group title
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.bg3,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                Text('Groupe ${group.name}',
                    style: AppTextStyles.labelLarge),
                const Spacer(),
                _ColLabel('J'),
                _ColLabel('DB'),
                _ColLabel('Pts'),
              ],
            ),
          ),
          // Team rows
          ...group.teams.asMap().entries.map((e) {
            final i = e.key;
            final t = e.value;
            // top 2 qualify (green tint)
            final qualifies = i < 2;
            return Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.border,
                    width: i == group.teams.length - 1 ? 0 : 0.5,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Position badge
                  Container(
                    width: 18,
                    height: 18,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: qualifies
                          ? AppColors.green.withOpacity(0.15)
                          : AppColors.bg3,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('${i + 1}',
                        style: AppTextStyles.monoBadge.copyWith(
                          color:
                              qualifies ? AppColors.green : AppColors.text3,
                        )),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(t.team,
                        style: AppTextStyles.bodyMedium,
                        overflow: TextOverflow.ellipsis),
                  ),
                  _ColVal('${t.played}'),
                  _ColVal('${t.gd >= 0 ? '+' : ''}${t.gd}'),
                  _ColVal('${t.pts}',
                      color: AppColors.text, bold: true),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _ColLabel extends StatelessWidget {
  final String label;
  const _ColLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      child: Text(label,
          style: AppTextStyles.monoBadge.copyWith(color: AppColors.text3),
          textAlign: TextAlign.center),
    );
  }
}

class _ColVal extends StatelessWidget {
  final String value;
  final Color? color;
  final bool bold;

  const _ColVal(this.value, {this.color, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      child: Text(
        value,
        style: AppTextStyles.monoSmall.copyWith(
          color: color ?? AppColors.text2,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
