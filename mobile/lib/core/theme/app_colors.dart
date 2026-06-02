import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Background layers — mirrors PariScore Design System V2 CSS vars
  static const Color bg = Color(0xFF0A0D0F);
  static const Color bg2 = Color(0xFF111417);
  static const Color bg3 = Color(0xFF181C20);
  static const Color bg4 = Color(0xFF1E2328);

  // Accent
  static const Color green = Color(0xFF00E676);
  static const Color red = Color(0xFFFF4D4D);
  static const Color amber = Color(0xFFFFA726);
  static const Color blue = Color(0xFF29B6F6);

  // Text
  static const Color text = Color(0xFFE8EAED);
  static const Color text2 = Color(0xFF8D9399);
  static const Color text3 = Color(0xFF5A6068);

  // Borders
  static const Color border = Color(0xFF2A2F35);
  static const Color borderLight = Color(0xFF3A3F46);

  // Semantic overlays (18% opacity — same as web table cells)
  static Color greenOverlay(double opacity) => green.withOpacity(opacity);
  static Color redOverlay(double opacity) => red.withOpacity(opacity);
  static Color amberOverlay(double opacity) => amber.withOpacity(opacity);

  // Convenience
  static const Color success = green;
  static const Color warning = amber;
  static const Color error = red;
  static const Color info = blue;

  // Value bet tiers
  static Color edgeColor(double edge) {
    if (edge >= 8) return green;
    if (edge >= 5) return amber;
    return text3;
  }

  // Poisson probability tiers
  static Color poissonColor(int pct) {
    if (pct >= 75) return green;
    if (pct >= 50) return amber;
    return red;
  }
}
