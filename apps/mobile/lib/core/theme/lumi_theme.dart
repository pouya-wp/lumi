import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'lumi_colors.dart';

abstract final class LumiTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: LumiColors.primary,
      brightness: brightness,
      primary: isDark ? LumiColors.primaryDark : LumiColors.primary,
      surface: isDark ? LumiColors.surfaceDark : LumiColors.surface,
      onSurface: isDark ? const Color(0xFFF2F4FF) : LumiColors.ink,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      textTheme: GoogleFonts.vazirmatnTextTheme(ThemeData(brightness: brightness).textTheme),
      cardTheme: CardThemeData(
        elevation: 0,
        color: isDark ? LumiColors.surfaceRaisedDark : LumiColors.surfaceRaised,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LumiRadius.lg)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LumiRadius.md)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}
