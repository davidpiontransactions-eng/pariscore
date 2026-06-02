import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  // Syne — headings, logo, strong numbers (like web --font-display)
  static const TextStyle displayLarge = TextStyle(
    fontFamily: 'Syne',
    fontWeight: FontWeight.w800,
    fontSize: 32,
    color: AppColors.text,
    letterSpacing: -0.5,
    height: 1.2,
  );

  static const TextStyle displayMedium = TextStyle(
    fontFamily: 'Syne',
    fontWeight: FontWeight.w700,
    fontSize: 24,
    color: AppColors.text,
    height: 1.3,
  );

  static const TextStyle headlineLarge = TextStyle(
    fontFamily: 'Syne',
    fontWeight: FontWeight.w700,
    fontSize: 20,
    color: AppColors.text,
  );

  static const TextStyle headlineMedium = TextStyle(
    fontFamily: 'Syne',
    fontWeight: FontWeight.w700,
    fontSize: 16,
    color: AppColors.text,
  );

  // Instrument Sans — body, UI labels
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: 'InstrumentSans',
    fontWeight: FontWeight.w400,
    fontSize: 16,
    color: AppColors.text,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontFamily: 'InstrumentSans',
    fontWeight: FontWeight.w400,
    fontSize: 14,
    color: AppColors.text,
  );

  static const TextStyle bodySmall = TextStyle(
    fontFamily: 'InstrumentSans',
    fontWeight: FontWeight.w400,
    fontSize: 12,
    color: AppColors.text2,
  );

  static const TextStyle labelLarge = TextStyle(
    fontFamily: 'InstrumentSans',
    fontWeight: FontWeight.w600,
    fontSize: 14,
    color: AppColors.text,
  );

  static const TextStyle labelMedium = TextStyle(
    fontFamily: 'InstrumentSans',
    fontWeight: FontWeight.w600,
    fontSize: 12,
    color: AppColors.text,
  );

  // DM Mono — odds, stats, codes, badges (like web --font-mono)
  static const TextStyle monoLarge = TextStyle(
    fontFamily: 'DMMono',
    fontWeight: FontWeight.w500,
    fontSize: 18,
    color: AppColors.text,
  );

  static const TextStyle monoMedium = TextStyle(
    fontFamily: 'DMMono',
    fontWeight: FontWeight.w400,
    fontSize: 14,
    color: AppColors.text,
  );

  static const TextStyle monoSmall = TextStyle(
    fontFamily: 'DMMono',
    fontWeight: FontWeight.w400,
    fontSize: 11,
    color: AppColors.text2,
  );

  static const TextStyle monoBadge = TextStyle(
    fontFamily: 'DMMono',
    fontWeight: FontWeight.w500,
    fontSize: 10,
    letterSpacing: 0.5,
  );
}
