import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/realtime.dart';
import '../../core/theme/lumi_colors.dart';
import '../tasks/quick_add_sheet.dart';

/// Tab scaffold with a floating glass bottom bar: the active tab is an ink pill, the center button glows.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(realtimeProvider);
    final s = ref.watch(stringsProvider);
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    final p = context.palette;

    Widget tab(int index, IconData icon, IconData active, String label, {int badge = 0}) {
      final selected = shell.currentIndex == index;
      return Expanded(
        flex: selected ? 7 : 4,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => shell.goBranch(index, initialLocation: index == shell.currentIndex),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            height: 46,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(color: selected ? p.ink : Colors.transparent, borderRadius: BorderRadius.circular(99)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Badge(
                  isLabelVisible: badge > 0,
                  backgroundColor: LumiColors.warn,
                  smallSize: 8,
                  child: Icon(selected ? active : icon, size: 21, color: selected ? p.onInk : p.ink2),
                ),
                if (selected) ...[
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      overflow: TextOverflow.fade,
                      softWrap: false,
                      style: TextStyle(color: p.onInk, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      extendBody: true,
      body: shell,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: p.panel.withValues(alpha: .78),
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: p.line),
              ),
              child: Row(
                children: [
                  tab(0, Icons.space_dashboard_outlined, Icons.space_dashboard_rounded, s.t('nav2.home')),
                  tab(1, Icons.check_circle_outline_rounded, Icons.check_circle_rounded, s.t('nav2.myTasks')),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: GestureDetector(
                      onTap: () => showQuickAdd(context),
                      child: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: LumiColors.lumi,
                          boxShadow: [BoxShadow(color: LumiColors.lumi.withValues(alpha: .55), blurRadius: 20, offset: const Offset(0, 8), spreadRadius: -6)],
                        ),
                        child: const Icon(Icons.add_rounded, color: Colors.white, size: 26),
                      ),
                    ),
                  ),
                  tab(2, Icons.folder_outlined, Icons.folder_rounded, s.t('nav2.projects')),
                  tab(3, Icons.inbox_outlined, Icons.inbox_rounded, s.t('nav2.inbox'), badge: unread),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
