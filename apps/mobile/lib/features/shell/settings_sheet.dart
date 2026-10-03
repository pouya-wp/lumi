import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

Future<void> showSettings(BuildContext context) => showModalBottomSheet(useRootNavigator: true, context: context, builder: (_) => const _Settings());

class _Settings extends ConsumerWidget {
  const _Settings();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final session = ref.watch(sessionProvider).valueOrNull;
    final mode = ref.watch(themeModeProvider);
    final p = context.palette;
    if (session == null) return const SizedBox.shrink();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                LumiAvatar(name: session.user.name, size: 48),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(session.user.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(
                        session.user.email,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(color: p.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            SegmentedButton<ThemeMode>(
              segments: [
                ButtonSegment(value: ThemeMode.light, icon: const Icon(Icons.light_mode_outlined), label: Text(s.t('common.light'))),
                ButtonSegment(value: ThemeMode.dark, icon: const Icon(Icons.dark_mode_outlined), label: Text(s.t('common.dark'))),
                const ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined)),
              ],
              selected: {mode},
              onSelectionChanged: (v) => ref.read(themeModeProvider.notifier).state = v.first,
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'fa', label: Text('فارسی')),
                ButtonSegment(value: 'en', label: Text('English')),
              ],
              selected: {ref.watch(localeProvider)},
              onSelectionChanged: (v) => ref.read(localeProvider.notifier).state = v.first,
            ),
            if (session.workspaces.length > 1) ...[
              const SizedBox(height: 14),
              for (final w in session.workspaces)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: p.ink,
                    child: Text(w.name.characters.first, style: TextStyle(color: p.onInk)),
                  ),
                  title: Text(w.name),
                  trailing: w.id == session.workspaceId ? const Icon(Icons.check_rounded, color: LumiColors.lumi) : null,
                  onTap: () {
                    ref.read(sessionProvider.notifier).switchWorkspace(w.id);
                    Navigator.pop(context);
                  },
                ),
            ],
            const SizedBox(height: 10),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.group_outlined),
              title: Text(s.t('nav2.team')),
              onTap: () {
                Navigator.pop(context);
                context.push('/team');
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.logout_rounded, color: LumiColors.danger),
              title: Text(s.t('auth.logout'), style: const TextStyle(color: LumiColors.danger)),
              onTap: () {
                Navigator.pop(context);
                ref.read(sessionProvider.notifier).signOut();
              },
            ),
          ],
        ),
      ),
    );
  }
}
