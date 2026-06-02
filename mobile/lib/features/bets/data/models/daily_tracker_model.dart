import '../../domain/entities/daily_tracker.dart';

class DailyTrackerEntryModel extends DailyTrackerEntry {
  const DailyTrackerEntryModel({
    required super.date,
    required super.actualCapitalCents,
    required super.targetCapitalCents,
    required super.dailyPnlCents,
    required super.cumulBankCents,
  });

  factory DailyTrackerEntryModel.fromJson(Map<String, dynamic> j) =>
      DailyTrackerEntryModel(
        date: j['date'] as String? ?? '',
        actualCapitalCents: j['actual_capital_cents'] as int? ?? 0,
        targetCapitalCents: j['target_capital_cents'] as int? ?? 0,
        dailyPnlCents: j['daily_pnl_cents'] as int? ?? 0,
        cumulBankCents: j['cumul_bank_cents'] as int? ?? 0,
      );
}
