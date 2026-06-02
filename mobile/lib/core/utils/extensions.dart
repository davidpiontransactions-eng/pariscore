import 'package:intl/intl.dart';

extension DateTimeX on DateTime {
  String get hhmm {
    final local = toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String get ddmm {
    final local = toLocal();
    return DateFormat('dd/MM').format(local);
  }

  bool get isToday {
    final now = DateTime.now();
    final local = toLocal();
    return local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
  }

  bool get isTomorrow {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final local = toLocal();
    return local.year == tomorrow.year &&
        local.month == tomorrow.month &&
        local.day == tomorrow.day;
  }

  String get relativeLabel {
    if (isToday) return 'Aujourd\'hui';
    if (isTomorrow) return 'Demain';
    return ddmm;
  }
}

extension DoubleX on double {
  String get odds2 => toStringAsFixed(2);
  String get edge1 => toStringAsFixed(1);
  String get pct => '${toStringAsFixed(0)}%';
}

extension IntX on int {
  String get pct => '$this%';
}

extension StringX on String {
  String get capitalize =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
}
