import 'package:flutter/material.dart';

/// Design tokens — source of truth: docs/DESIGN.md (mirrors packages/shared/src/tokens.ts).
abstract final class LumiColors {
  static const primary = Color(0xFF3D5AFE);
  static const primaryDark = Color(0xFF6C83FF);
  static const ink = Color(0xFF0E1330);
  static const inkMuted = Color(0xFF6B7194);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceRaised = Color(0xFFF7F8FC);
  static const surfaceDark = Color(0xFF0B0E22);
  static const surfaceRaisedDark = Color(0xFF141838);
  static const night1 = Color(0xFF0A0F3C);
  static const night2 = Color(0xFF1B1F6B);

  static const tasks = (bg: Color(0xFFEEF0FF), accent: Color(0xFF5B5BF0));
  static const calendar = (bg: Color(0xFFFFEFF1), accent: Color(0xFFF2557A));
  static const notes = (bg: Color(0xFFFFF8DB), accent: Color(0xFFE8A300));
  static const daily = (bg: Color(0xFFE6F8FB), accent: Color(0xFF14A8C8));
  static const goals = (bg: Color(0xFFE9F9EF), accent: Color(0xFF1DB46A));
  static const time = (bg: Color(0xFFFFF0E6), accent: Color(0xFFFF7A2F));

  static const urgent = Color(0xFFFF4D4F);
  static const high = Color(0xFFFF8A00);
  static const medium = primary;
  static const low = Color(0xFF9AA0C3);
}

abstract final class LumiRadius {
  static const sm = 10.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}
