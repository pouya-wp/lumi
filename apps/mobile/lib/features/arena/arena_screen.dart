import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/collab.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

/// Badge emoji, mirrored from apps/web/components/reports/badges.ts.
const badgeEmoji = {
  'first_task': '🌱',
  'ten_done': '🔟',
  'fifty_done': '🏅',
  'hundred_done': '💯',
  'streak_3': '🔥',
  'streak_7': '☄️',
  'streak_30': '🌋',
  'early_bird': '🌅',
  'night_owl': '🦉',
  'on_time_10': '⏰',
  'urgent_slayer': '🧯',
  'team_player': '🤝',
  'deep_focus': '🧘',
  'marathon': '🏃',
  'writer': '✍️',
  'chatty': '💬',
  'habit_hero': '🦸',
};

class ArenaScreen extends ConsumerWidget {
  const ArenaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final me = ref.watch(sessionProvider).valueOrNull?.user.id;
    final game = ref.watch(gameProvider);
    final levels = (s.raw('game.levels') as List?)?.cast<String>() ?? const <String>[];
    String title(int l) => levels.isEmpty ? '' : levels[math.min(levels.length - 1, l - 1)];

    return Scaffold(
      backgroundColor: LumiColors.night1,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(
          s.t('game.title'),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: game.when(
        loading: () => const Loading(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(gameProvider)),
        data: (members) {
          final mine = members.where((m) => m.user.id == me).firstOrNull ?? (members.isEmpty ? null : members.first);
          final podium = [if (members.length > 1) members[1], if (members.isNotEmpty) members[0], if (members.length > 2) members[2]];
          return RefreshIndicator(
            onRefresh: () => ref.refresh(gameProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
              children: [
                Text(s.t('game.subtitle'), style: const TextStyle(color: Colors.white60, fontSize: 13)),
                const SizedBox(height: 26),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (final m in podium)
                      Expanded(
                        child: _PodiumColumn(member: m, rank: members.indexOf(m), subtitle: title(m.level), weekLabel: s.t('game.weekXp'), n: s.n),
                      ),
                  ],
                ),
                if (mine != null) ...[
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .07),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 76,
                          height: 76,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox.expand(
                                child: CircularProgressIndicator(
                                  value: mine.progress,
                                  strokeWidth: 7,
                                  strokeCap: StrokeCap.round,
                                  backgroundColor: Colors.white12,
                                  color: LumiColors.warn,
                                ),
                              ),
                              Text(
                                s.n(mine.level),
                                style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title(mine.level),
                                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                              ),
                              Text(s.t('game.xp', {'n': mine.xp}), style: const TextStyle(color: Colors.white60)),
                              Text(s.t('game.toNext', {'n': mine.next - mine.xp}), style: const TextStyle(color: Colors.white38, fontSize: 12)),
                              const SizedBox(height: 6),
                              Text(
                                '🔥 ${s.t('game.daysStreak', {'n': mine.streak})}',
                                style: const TextStyle(color: LumiColors.warn, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    s.t('game.badgesTitle'),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: .86,
                    children: [
                      for (final key in badgeEmoji.keys)
                        _Badge(
                          emoji: badgeEmoji[key]!,
                          name: s.t('game.badges.$key.name'),
                          desc: s.t('game.badges.$key.desc'),
                          earned: mine.badges.contains(key),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PodiumColumn extends StatelessWidget {
  const _PodiumColumn({required this.member, required this.rank, required this.subtitle, required this.weekLabel, required this.n});

  final GameMember member;
  final int rank;
  final String subtitle;
  final String weekLabel;
  final String Function(Object) n;

  @override
  Widget build(BuildContext context) {
    final heights = [150.0, 108.0, 82.0];
    return Column(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: rank == 0 ? [BoxShadow(color: const Color(0xFFFACC15).withValues(alpha: .5), blurRadius: 30)] : null,
              ),
              child: LumiAvatar(name: member.user.name, size: rank == 0 ? 64 : 50),
            ),
            PositionedDirectional(end: -6, bottom: -4, child: Text(['🥇', '🥈', '🥉'][rank], style: const TextStyle(fontSize: 22))),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          member.user.name.split(' ').first,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 11)),
        const SizedBox(height: 8),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: heights[rank]),
          duration: Duration(milliseconds: 700 + rank * 150),
          curve: Curves.easeOutCubic,
          builder: (_, h, __) => Container(
            height: h,
            margin: const EdgeInsets.symmetric(horizontal: 5),
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              gradient: rank == 0
                  ? LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [LumiColors.lumi, LumiColors.lumi.withValues(alpha: .25)])
                  : null,
              color: rank == 0 ? null : Colors.white.withValues(alpha: .09),
            ),
            child: Column(
              children: [
                Text(
                  n(member.weekXp),
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                ),
                Text(weekLabel, style: const TextStyle(color: Colors.white60, fontSize: 10)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.emoji, required this.name, required this.desc, required this.earned});

  final String emoji;
  final String name;
  final String desc;
  final bool earned;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: desc,
      triggerMode: TooltipTriggerMode.tap,
      child: Opacity(
        opacity: earned ? 1 : .4,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: earned ? .1 : .04),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: earned ? Colors.white24 : Colors.white10),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(earned ? emoji : '🔒', style: const TextStyle(fontSize: 30)),
              const SizedBox(height: 6),
              Text(
                name,
                textAlign: TextAlign.center,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
