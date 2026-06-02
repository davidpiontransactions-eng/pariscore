import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  // Syne — headings, logo, strong numbers
  static TextStyle get displayLarge => GoogleFonts.syne(
        fontWeight: FontWeight.w800,
        fontSize: 32,
        color: AppColors.text,
        letterSpacing: -0.5,
        height: 1.2,
      );

  static TextStyle get displayMedium => GoogleFonts.syne(
        fontWeight: FontWeight.w700,
        fontSize: 24,
        color: AppColors.text,
        height: 1.3,
      );

  static TextStyle get headlineLarge => GoogleFonts.syne(
        fontWeight: FontWeight.w700,
        fontSize: 20,
        color: AppColors.text,
      );

  static TextStyle get headlineMedium => GoogleFonts.syne(
        fontWeight: FontWeight.w700,
        fontSize: 16,
        color: AppColors.text,
      );

  // Instrument Sans — body, UI labels
  static TextStyle get bodyLarge => GoogleFonts.instrumentSans(
        fontWeight: FontWeight.w400,
        fontSize: 16,
        color: AppColors.text,
      );

  static TextStyle get bodyMedium => GoogleFonts.instrumentSans(
        fontWeight: FontWeight.w400,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get bodySmall => GoogleFonts.instrumentSans(
        fontWeight: FontWeight.w400,
        fontSize: 12,
        color: AppColors.text2,
      );

  static TextStyle get labelLarge => GoogleFonts.instrumentSans(
        fontWeight: FontWeight.w600,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get labelMedium => GoogleFonts.instrumentSans(
        fontWeight: FontWeight.w600,
        fontSize: 12,
        color: AppColors.text,
      );

  // DM Mono — odds, stats, codes, badges
  static TextStyle get monoLarge => GoogleFonts.dmMono(
        fontWeight: FontWeight.w500,
        fontSize: 18,
        color: AppColors.text,
      );

  static TextStyle get monoMedium => GoogleFonts.dmMono(
        fontWeight: FontWeight.w400,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get monoSmall => GoogleFonts.dmMono(
        fontWeight: FontWeight.w400,
        fontSize: 11,
        color: AppColors.text2,
      );

  static TextStyle get monoBadge => GoogleFonts.dmMono(
        fontWeight: FontWeight.w500,
        fontSize: 10,
        letterSpacing: 0.5,
      );
}
