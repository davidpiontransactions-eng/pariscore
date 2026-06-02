import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/bet.dart';
import '../cubit/bets_cubit.dart';

class SettleBetSheet extends StatefulWidget {
  final Bet bet;

  const SettleBetSheet({super.key, required this.bet});

  @override
  State<SettleBetSheet> createState() => _SettleBetSheetState();
}

class _SettleBetSheetState extends State<SettleBetSheet> {
  String _outcome = 'won';
  final _cashoutCtrl = TextEditingController();
  bool _submitting = false;

  static const _outcomes = [
    ('won', 'Gagné', AppColors.green),
    ('lost', 'Perdu', AppColors.red),
    ('void', 'Void/Annulé', AppColors.text3),
    ('half_won', '½ Gagné', AppColors.green),
    ('half_lost', '½ Perdu', AppColors.red),
    ('cashout', 'Cashout', AppColors.amber),
  ];

  @override
  void dispose() {
    _cashoutCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 16 + bottomPad),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Régler le pari', style: AppTextStyles.headlineMedium),
          const SizedBox(height: 4),
          Text(
            widget.bet.selectionLabel,
            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.text2),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text('Cote: ', style: AppTextStyles.monoSmall),
              Text(widget.bet.odds.toStringAsFixed(2),
                  style: AppTextStyles.monoMedium),
              const SizedBox(width: 12),
              Text('Mise: ', style: AppTextStyles.monoSmall),
              Text('${widget.bet.stakeEuros.toStringAsFixed(2)}€',
                  style: AppTextStyles.monoMedium),
            ],
          ),
          const SizedBox(height: 20),
          Text('Résultat', style: AppTextStyles.labelMedium),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _outcomes.map((o) {
              final isSelected = _outcome == o.$1;
              return GestureDetector(
                onTap: () => setState(() => _outcome = o.$1),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? o.$3.withOpacity(0.15) : AppColors.bg3,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? o.$3.withOpacity(0.6)
                          : AppColors.border,
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Text(
                    o.$2,
                    style: AppTextStyles.labelMedium
                        .copyWith(color: isSelected ? o.$3 : AppColors.text2),
                  ),
                ),
              );
            }).toList(),
          ),
          if (_outcome == 'cashout') ...[
            const SizedBox(height: 16),
            TextFormField(
              controller: _cashoutCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
              style: AppTextStyles.monoMedium,
              decoration: const InputDecoration(
                labelText: 'Montant cashout (€)',
                suffixText: '€',
              ),
            ),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 20, width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.bg),
                  )
                : const Text('Confirmer'),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final cashout = _outcome == 'cashout'
        ? double.tryParse(_cashoutCtrl.text)
        : null;
    await context.read<BetsCubit>().settleBet(
          widget.bet.id,
          _outcome,
          cashoutAmount: cashout,
        );
    if (mounted) Navigator.of(context).pop();
  }
}
