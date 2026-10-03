import 'package:flutter/material.dart';

/// Design tokens — source of truth: docs/DESIGN.md (mirrors packages/shared/src/tokens.ts).
@immutable
class LumiPalette extends ThemeExtension<LumiPalette> {
  const LumiPalette({
    required this.canvas,
    required this.panel,
    required this.sunken,
    required this.ink,
    required this.ink2,
    required this.muted,
    required this.line,
    required this.onInk,
    required this.successSoft,
    required this.warnSoft,
    required this.dangerSoft,
    required this.infoSoft,
  });

  final Color canvas;
  final Color panel;
  final Color sunken;
  final Color ink;
  final Color ink2;
  final Color muted;
  final Color line;
  final Color onInk;
  final Color successSoft;
  final Color warnSoft;
  final Color dangerSoft;
  final Color infoSoft;

  static const light = LumiPalette(
    canvas: Color(0xFFF1F2F4),
    panel: Color(0xFFFFFFFF),
    sunken: Color(0xFFF7F8FA),
    ink: Color(0xFF0B0C0F),
    ink2: Color(0xFF3A3D45),
    muted: Color(0xFF8A8F99),
    line: Color(0xFFE8E9EC),
    onInk: Color(0xFFFFFFFF),
    successSoft: Color(0xFFDCFCE7),
    warnSoft: Color(0xFFFFEDD5),
    dangerSoft: Color(0xFFFEE2E2),
    infoSoft: Color(0xFFE0F2FE),
  );

  static const dark = LumiPalette(
    canvas: Color(0xFF07080C),
    panel: Color(0xFF111319),
    sunken: Color(0xFF181B23),
    ink: Color(0xFFF4F5F7),
    ink2: Color(0xFFC9CCD3),
    muted: Color(0xFF7D8390),
    line: Color(0xFF22252E),
    onInk: Color(0xFF0B0C0F),
    successSoft: Color(0xFF0F2A1A),
    warnSoft: Color(0xFF2E1A0B),
    dangerSoft: Color(0xFF2E1213),
    infoSoft: Color(0xFF0B2230),
  );

  @override
  LumiPalette copyWith() => this;

  @override
  LumiPalette lerp(ThemeExtension<LumiPalette>? other, double t) {
    if (other is! LumiPalette) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return LumiPalette(
      canvas: l(canvas, other.canvas),
      panel: l(panel, other.panel),
      sunken: l(sunken, other.sunken),
      ink: l(ink, other.ink),
      ink2: l(ink2, other.ink2),
      muted: l(muted, other.muted),
      line: l(line, other.line),
      onInk: l(onInk, other.onInk),
      successSoft: l(successSoft, other.successSoft),
      warnSoft: l(warnSoft, other.warnSoft),
      dangerSoft: l(dangerSoft, other.dangerSoft),
      infoSoft: l(infoSoft, other.infoSoft),
    );
  }
}

abstract final class LumiColors {
  static const lumi = Color(0xFF4F5BFF);
  static const success = Color(0xFF16A34A);
  static const warn = Color(0xFFF97316);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF0EA5E9);
  static const violet = Color(0xFF8B5CF6);
  static const rose = Color(0xFFF43F5E);
  static const night1 = Color(0xFF0A0F3C);
  static const night2 = Color(0xFF1B1F6B);

  static Color priority(String p) => switch (p) {
    'URGENT' => danger,
    'HIGH' => warn,
    'MEDIUM' => lumi,
    'LOW' => const Color(0xFF8A8F99),
    _ => const Color(0xFFC4C7CE),
  };

  static Color parse(String? hex, [Color fallback = lumi]) {
    if (hex == null || hex.length != 7) return fallback;
    return Color(int.parse('FF${hex.substring(1)}', radix: 16));
  }
}

abstract final class LumiRadius {
  static const frame = 28.0;
  static const panel = 22.0;
  static const inner = 14.0;
}

extension LumiThemeX on BuildContext {
  LumiPalette get palette => Theme.of(this).extension<LumiPalette>()!;
  TextTheme get text => Theme.of(this).textTheme;
}
