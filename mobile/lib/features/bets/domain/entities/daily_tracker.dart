import 'package:equatable/equatable.dart';

class DailyTrackerEntry extends Equatable {
  final String date;
  final int actualCapitalCents;
  final int targetCapitalCents;
  final int dailyPnlCents;
  final int cumulBankCents;

  const DailyTrackerEntry({
    required this.date,
    required this.actualCapitalCents,
    required this.targetCapitalCents,
    required this.dailyPnlCents,
    required this.cumulBankCents,
  });

  double get actualEuros => actualCapitalCents / 100;
  double get targetEuros => targetCapitalCents / 100;
  double get pnlEuros => dailyPnlCents / 100;
  bool get isAboveTarget => actualCapitalCents >= targetCapitalCents;

  @override
  List<Object?> get props => [date, actualCapitalCents];
}
