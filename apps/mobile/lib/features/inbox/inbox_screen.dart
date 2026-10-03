import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/widgets.dart';
import '../tasks/task_sheet.dart';

const _icons = {
  'task.assigned': '📌',
  'task.proposed': '🤝',
  'task.proposal.accepted': '✅',
  'task.proposal.declined': '🙅',
  'task.proposal.countered': '📅',
  'task.status': '🔄',
  'comment.mention': '💬',
  'comment.reply': '↩️',
  'workspace.joined': '👋',
};

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final list = ref.watch(notificationsProvider);

    Future<void> open(AppNotification n) async {
      if (n.readAt == null) {
        await ref.read(apiProvider).post('/notifications/${n.id}/read');
        ref.invalidate(notificationsProvider);
        ref.invalidate(unreadCountProvider);
      }
      final taskId = n.payload['taskId'] as String?;
      if (taskId != null && context.mounted) showTask(context, taskId);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('inbox.title')),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(apiProvider).post('/notifications/read-all');
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: Text(s.t('inbox.markAll')),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: () => ref.refresh(notificationsProvider.future),
        child: list.when(
          loading: () => const Loading(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
          data: (items) => items.isEmpty
              ? ListView(
                  children: [EmptyState(emoji: '🌿', text: s.t('inbox.empty'))],
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 4, 14, 120),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final n = items[i];
                    final note = (n.payload['note'] ?? n.payload['excerpt']) as String?;
                    return Panel(
                      onTap: () => open(n),
                      padding: const EdgeInsets.all(14),
                      aurora: n.readAt == null ? LumiColors.lumi : null,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              LumiAvatar(name: n.actor?.name ?? 'Lumi', size: 40),
                              PositionedDirectional(
                                end: -4,
                                bottom: -4,
                                child: Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(color: p.panel, shape: BoxShape.circle),
                                  child: Text(_icons[n.type] ?? '🔔', style: const TextStyle(fontSize: 11)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text.rich(
                                  TextSpan(
                                    children: [
                                      TextSpan(
                                        text: '${n.actor?.name ?? ''} ',
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                      TextSpan(text: s.t('notif.${n.type}', {'title': n.payload['title'] ?? '', 'status': n.payload['status'] ?? ''})),
                                    ],
                                  ),
                                  style: const TextStyle(height: 1.5),
                                ),
                                if (note != null) ...[
                                  const SizedBox(height: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(10)),
                                    child: Text(
                                      '“$note”',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 12, color: p.ink2),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 6),
                                Text('${n.payload['key'] ?? ''}  ${timeAgo(n.createdAt, s)}', style: TextStyle(fontSize: 11, color: p.muted)),
                              ],
                            ),
                          ),
                          if (n.readAt == null)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(top: 6),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: LumiColors.lumi,
                                boxShadow: [BoxShadow(color: LumiColors.lumi.withValues(alpha: .6), blurRadius: 8)],
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
