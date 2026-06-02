import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../cubit/bets_cubit.dart';

class AddBetSheet extends StatefulWidget {
  const AddBetSheet({super.key});

  @override
  State<AddBetSheet> createState() => _AddBetSheetState();
}

class _AddBetSheetState extends State<AddBetSheet> {
  final _formKey = GlobalKey<FormState>();
  final _selectionCtrl = TextEditingController();
  final _oddsCtrl = TextEditingController();
  final _stakeCtrl = TextEditingController();
  final _marketCtrl = TextEditingController(text: '1X2');
  final _bookmakerCtrl = TextEditingController();
  String _sport = 'football';
  bool _submitting = false;

  static const _sports = ['football', 'tennis', 'cs2', 'other'];
  static const _markets = ['1X2', 'Over 2.5', 'BTTS', 'Over 1.5', 'Over 3.5', 'DNB', 'AH', 'Other'];

  @override
  void dispose() {
    _selectionCtrl.dispose();
    _oddsCtrl.dispose();
    _stakeCtrl.dispose();
    _marketCtrl.dispose();
    _bookmakerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 16 + bottomPad),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
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
              Text('Nouveau pari', style: AppTextStyles.headlineMedium),
              const SizedBox(height: 20),

              // Selection
              TextFormField(
                controller: _selectionCtrl,
                style: AppTextStyles.bodyMedium,
                decoration: const InputDecoration(labelText: 'Sélection (ex: PSG gagne)'),
                validator: (v) => (v?.isNotEmpty == true) ? null : 'Requis',
              ),
              const SizedBox(height: 12),

              // Market dropdown
              DropdownButtonFormField<String>(
                value: _marketCtrl.text.isEmpty ? '1X2' : _marketCtrl.text,
                dropdownColor: AppColors.bg3,
                style: AppTextStyles.bodyMedium,
                decoration: const InputDecoration(labelText: 'Marché'),
                items: _markets.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                onChanged: (v) => _marketCtrl.text = v ?? '1X2',
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _oddsCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                      style: AppTextStyles.monoMedium,
                      decoration: const InputDecoration(labelText: 'Cote'),
                      validator: (v) {
                        final d = double.tryParse(v ?? '');
                        return (d != null && d >= 1.01) ? null : 'Cote >= 1.01';
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _stakeCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                      style: AppTextStyles.monoMedium,
                      decoration: const InputDecoration(labelText: 'Mise (€)', suffixText: '€'),
                      validator: (v) {
                        final d = double.tryParse(v ?? '');
                        return (d != null && d > 0) ? null : '> 0';
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _bookmakerCtrl,
                      style: AppTextStyles.bodyMedium,
                      decoration: const InputDecoration(labelText: 'Bookmaker'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _sport,
                      dropdownColor: AppColors.bg3,
                      style: AppTextStyles.bodyMedium,
                      decoration: const InputDecoration(labelText: 'Sport'),
                      items: _sports.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                      onChanged: (v) => setState(() => _sport = v ?? 'football'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bg),
                      )
                    : const Text('Enregistrer le pari'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_formKey.currentState?.validate() != true) return;
    setState(() => _submitting = true);

    await context.read<BetsCubit>().createBet({
      'selection_label': _selectionCtrl.text.trim(),
      'market': _marketCtrl.text,
      'odds': double.parse(_oddsCtrl.text),
      'stake': double.parse(_stakeCtrl.text),
      'bookmaker': _bookmakerCtrl.text.trim().isEmpty ? null : _bookmakerCtrl.text.trim(),
      'sport': _sport,
    });

    if (mounted) Navigator.of(context).pop();
  }
}
