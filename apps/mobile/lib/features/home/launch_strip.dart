import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';

/// Horizontal row of colorful shortcuts to the secondary spaces (calendar, chat, docs, focus, AI, arena).
class LaunchStrip extends ConsumerWidget {
  const LaunchStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final chatUnread = ref.watch(channelsProvider).valueOrNull?.fold<int>(0, (a, c) => a + c.unread) ?? 0;
    final items = [
      ('/calendar', '📅', s.t('mobile.launch.calendar'), const Color(0xFFF43F5E), 0),
      ('/chat', '💬', s.t('mobile.launch.chat'), LumiColors.lumi, chatUnread),
      ('/docs', '📄', s.t('mobile.launch.docs'), LumiColors.violet, 0),
      ('/focus', '🍅', s.t('mobile.launch.focus'), LumiColors.warn, 0),
      ('/ai', '✨', s.t('mobile.launch.ai'), LumiColors.info, 0),
      ('/arena', '🏆', s.t('mobile.launch.arena'), LumiColors.success, 0),
    ];
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final (path, emoji, label, color, badge) = items[i];
          return GestureDetector(
            onTap: () => context.push(path),
            child: SizedBox(
              width: 70,
              child: Column(
                children: [
                  Badge(
                    isLabelVisible: badge > 0,
                    label: Text(s.n(badge)),
                    backgroundColor: LumiColors.warn,
                    child: Container(
                      width: 60,
                      height: 60,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Color.alphaBlend(color.withValues(alpha: .14), p.panel),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: color.withValues(alpha: .25)),
                      ),
                      child: Text(emoji, style: const TextStyle(fontSize: 26)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: p.ink2),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
