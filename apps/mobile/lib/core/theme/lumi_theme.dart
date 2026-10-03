import 'package:flutter/material.dart';

import 'lumi_colors.dart';

/// Meem's space glyph is narrow; widen word spacing slightly (inherited by every Text via DefaultTextStyle).
TextTheme _openSpacing(TextTheme t) {
  TextStyle? w(TextStyle? s) => s?.copyWith(wordSpacing: 1.5);
  return t.copyWith(
    displayLarge: w(t.displayLarge),
    displayMedium: w(t.displayMedium),
    displaySmall: w(t.displaySmall),
    headlineLarge: w(t.headlineLarge),
    headlineMedium: w(t.headlineMedium),
    headlineSmall: w(t.headlineSmall),
    titleLarge: w(t.titleLarge),
    titleMedium: w(t.titleMedium),
    titleSmall: w(t.titleSmall),
    bodyLarge: w(t.bodyLarge),
    bodyMedium: w(t.bodyMedium),
    bodySmall: w(t.bodySmall),
    labelLarge: w(t.labelLarge),
    labelMedium: w(t.labelMedium),
    labelSmall: w(t.labelSmall),
  );
}

abstract final class LumiTheme {
  static ThemeData light() => _build(Brightness.light, LumiPalette.light);
  static ThemeData dark() => _build(Brightness.dark, LumiPalette.dark);

  static ThemeData _build(Brightness brightness, LumiPalette p) {
    final scheme = ColorScheme.fromSeed(
      seedColor: LumiColors.lumi,
      brightness: brightness,
      primary: p.ink,
      onPrimary: p.onInk,
      secondary: LumiColors.lumi,
      surface: p.panel,
      onSurface: p.ink,
    );
    final base = ThemeData(brightness: brightness, fontFamily: 'Meem', useMaterial3: true);

    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: p.canvas,
      extensions: [p],
      textTheme: _openSpacing(base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink, fontFamily: 'Meem')),
      splashFactory: InkSparkle.splashFactory,
      dividerColor: p.line,
      appBarTheme: AppBarTheme(
        backgroundColor: p.canvas,
        foregroundColor: p.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: 'Meem', fontSize: 20, fontWeight: FontWeight.w600, color: p.ink),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.ink,
          foregroundColor: p.onInk,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontFamily: 'Meem', fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: p.ink2, shape: const StadiumBorder()),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.sunken,
        hintStyle: TextStyle(color: p.muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LumiRadius.inner),
          borderSide: BorderSide(color: p.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LumiRadius.inner),
          borderSide: BorderSide(color: p.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(LumiRadius.inner),
          borderSide: const BorderSide(color: LumiColors.lumi, width: 1.5),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.panel,
        showDragHandle: true,
        dragHandleColor: p.line,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(LumiRadius.frame))),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: p.ink,
        contentTextStyle: TextStyle(fontFamily: 'Meem', color: p.onInk),
        shape: const StadiumBorder(),
      ),
    );
  }
}
