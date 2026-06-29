import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  // Poppins — headings, logo, strong numbers (charter --font-display)
  static TextStyle get displayLarge => GoogleFonts.poppins(
        fontWeight: FontWeight.w800,
        fontSize: 32,
        color: AppColors.text,
        letterSpacing: -0.5,
        height: 1.2,
      );

  static TextStyle get displayMedium => GoogleFonts.poppins(
        fontWeight: FontWeight.w700,
        fontSize: 24,
        color: AppColors.text,
        height: 1.3,
      );

  static TextStyle get headlineLarge => GoogleFonts.poppins(
        fontWeight: FontWeight.w700,
        fontSize: 20,
        color: AppColors.text,
      );

  static TextStyle get headlineMedium => GoogleFonts.poppins(
        fontWeight: FontWeight.w700,
        fontSize: 16,
        color: AppColors.text,
      );

  // Inter — body, UI labels (charter --font-body)
  static TextStyle get bodyLarge => GoogleFonts.inter(
        fontWeight: FontWeight.w400,
        fontSize: 16,
        color: AppColors.text,
      );

  static TextStyle get bodyMedium => GoogleFonts.inter(
        fontWeight: FontWeight.w400,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get bodySmall => GoogleFonts.inter(
        fontWeight: FontWeight.w400,
        fontSize: 12,
        color: AppColors.text2,
      );

  static TextStyle get labelLarge => GoogleFonts.inter(
        fontWeight: FontWeight.w600,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get labelMedium => GoogleFonts.inter(
        fontWeight: FontWeight.w600,
        fontSize: 12,
        color: AppColors.text,
      );

  // JetBrains Mono — odds, stats, codes, badges (charter extension)
  // NOTE: DM Mono conservé pour la lisibilité numérique, mais limité aux chiffres/cotes
  static TextStyle get monoLarge => GoogleFonts.jetBrainsMono(
        fontWeight: FontWeight.w500,
        fontSize: 18,
        color: AppColors.text,
      );

  static TextStyle get monoMedium => GoogleFonts.jetBrainsMono(
        fontWeight: FontWeight.w400,
        fontSize: 14,
        color: AppColors.text,
      );

  static TextStyle get monoSmall => GoogleFonts.jetBrainsMono(
        fontWeight: FontWeight.w400,
        fontSize: 11,
        color: AppColors.text2,
      );

  static TextStyle get monoBadge => GoogleFonts.jetBrainsMono(
        fontWeight: FontWeight.w500,
        fontSize: 10,
        letterSpacing: 0.5,
      );
}
