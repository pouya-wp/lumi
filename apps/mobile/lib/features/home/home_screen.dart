import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';

import '../../core/theme/lumi_colors.dart';

/// Today screen: scene header with greeting, then bento widgets.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final f = Jalali.now().formatter;
    final date = '${f.wN} ${f.d} ${f.mN} ${f.yyyy}';

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SceneHeader(date: date),
            const SizedBox(height: 16),
            const _TodayCard(),
            const SizedBox(height: 12),
            const Row(
              children: [
                Expanded(child: _FocusCard()),
                SizedBox(width: 12),
                Expanded(
                  child: _PastelTile(emoji: '🎯', title: 'اهداف', subtitle: '۳ از ۵', colors: LumiColors.goals),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Row(
              children: [
                Expanded(
                  child: _PastelTile(emoji: '📅', title: 'تقویم', subtitle: '۲ جلسه', colors: LumiColors.calendar),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: _PastelTile(emoji: '📝', title: 'یادداشت', subtitle: '۴ جدید', colors: LumiColors.notes),
                ),
              ],
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        icon: const Icon(Icons.auto_awesome),
        label: const Text('برنامه امروزم رو بچین'),
      ),
    );
  }
}

class _SceneHeader extends StatelessWidget {
  const _SceneHeader({required this.date});

  final String date;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LumiRadius.xl),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF4F8BFF), Color(0xFFBFE3FF)],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(date, style: text.bodyMedium?.copyWith(color: Colors.white70)),
              const SizedBox(height: 4),
              Text(
                'صبح بخیر 👋',
                style: text.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const PositionedDirectional(end: 0, top: -4, child: _Sticker(label: 'AI ✦')),
        ],
      ),
    );
  }
}

class _Sticker extends StatelessWidget {
  const _Sticker({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -6 * math.pi / 180,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: LumiColors.notes.bg,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [BoxShadow(color: Color(0x590E1330), blurRadius: 16, offset: Offset(0, 6))],
        ),
        child: Text(label, style: TextStyle(color: LumiColors.notes.accent, fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard();

  static const _tasks = [
    ('طراحی صفحه داشبورد', LumiColors.urgent, true),
    ('جلسه اسپرینت ساعت ۱۰', LumiColors.high, false),
    ('بررسی PR احراز هویت', LumiColors.medium, false),
  ];

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('امروز', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            for (final (title, color, done) in _tasks)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  done ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: done ? LumiColors.primary : LumiColors.low,
                ),
                title: Text(
                  title,
                  style: TextStyle(decoration: done ? TextDecoration.lineThrough : null),
                ),
                trailing: CircleAvatar(radius: 4, backgroundColor: color),
              ),
          ],
        ),
      ),
    );
  }
}

class _FocusCard extends StatelessWidget {
  const _FocusCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LumiRadius.lg),
        gradient: const LinearGradient(colors: [LumiColors.night1, LumiColors.night2]),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('تمرکز 🍅', style: TextStyle(color: Colors.white70)),
          Spacer(),
          Text('24:17', style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _PastelTile extends StatelessWidget {
  const _PastelTile({required this.emoji, required this.title, required this.subtitle, required this.colors});

  final String emoji;
  final String title;
  final String subtitle;
  final ({Color bg, Color accent}) colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(LumiRadius.lg)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 28)),
          const Spacer(),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: LumiColors.ink)),
          Text(subtitle, style: TextStyle(color: colors.accent)),
        ],
      ),
    );
  }
}
