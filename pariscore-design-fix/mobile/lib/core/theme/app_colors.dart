import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Background layers — ALIGNED with tokens.css (Pariscore charter official)
  static const Color bg = Color(0xFF0B0E17);     // charter --color-bg-primary
  static const Color bg2 = Color(0xFF0E121E);    // charter --color-bg-secondary
  static const Color bg3 = Color(0xFF131722);    // charter --color-card
  static const Color bg4 = Color(0xFF161C2A);    // charter --color-card-hover

  // Accent — charter values
  static const Color green = Color(0xFF00E676);  // charter --color-accent-green
  static const Color red = Color(0xFFFF1744);    // charter --color-danger
  static const Color amber = Color(0xFFFF6D2E);  // charter --color-live
  static const Color blue = Color(0xFF0077FF);   // charter --color-accent-blue

  // Text — charter values
  static const Color text = Color(0xFFFFFFFF);   // charter --color-text-primary
  static const Color text2 = Color(0xFF94A3B8);  // charter --color-text-secondary
  static const Color text3 = Color(0xFF707E94);  // charter --color-text-tertiary

  // Borders — charter values
  static const Color border = Color(0xFF1A1F2E);        // derived from rgba(255,255,255,0.05) on #0b0e17
  static const Color borderLight = Color(0xFF1F2533);   // derived from rgba(255,255,255,0.08) on #0b0e17

  // Semantic overlays (10% opacity — same as web *-bg-soft tokens)
  static Color greenOverlay(double opacity) => green.withOpacity(opacity);
  static Color redOverlay(double opacity) => red.withOpacity(opacity);
  static Color amberOverlay(double opacity) => amber.withOpacity(opacity);

  // Convenience
  static const Color success = green;
  static const Color warning = amber;
  static const Color error = red;
  static const Color info = blue;

  // NEW — charter extensions
  static const Color onAccent = Color(0xFF0B0E17);  // charter --color-on-accent
  static const Color live = amber;                  // alias for charter --color-live
  static const Color danger = red;                  // alias for charter --color-danger
  static const Color accent = green;                // alias for charter --color-accent-green

  // NEW — soft backgrounds for badges/banners
  static Color greenBgSoft = green.withOpacity(0.10);
  static Color redBgSoft = red.withOpacity(0.10);
  static Color amberBgSoft = amber.withOpacity(0.10);
  static Color blueBgSoft = blue.withOpacity(0.10);

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
