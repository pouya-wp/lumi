import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models/collab.dart';
import 'models/models.dart';
import 'providers.dart';

typedef _J = Map<String, dynamic>;

List<Task> _tasks(List<dynamic> list) => [for (final t in list) Task.fromJson(t as _J)];

final dashboardProvider = FutureProvider.autoDispose<Dashboard>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  return Dashboard.fromJson(await ref.watch(apiProvider).get<_J>('/workspaces/$wid/dashboard'));
});

final myTasksProvider = FutureProvider.autoDispose.family<List<Task>, String>((ref, scope) async {
  final wid = ref.watch(workspaceIdProvider);
  return _tasks(await ref.watch(apiProvider).get<List<dynamic>>('/me/tasks', query: {'workspaceId': wid, 'scope': scope}));
});

final projectsProvider = FutureProvider.autoDispose<List<Project>>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  final list = await ref.watch(apiProvider).get<List<dynamic>>('/workspaces/$wid/projects');
  return [for (final p in list) Project.fromJson(p as _J)];
});

final projectProvider = FutureProvider.autoDispose.family<Project, String>((ref, id) async {
  return Project.fromJson(await ref.watch(apiProvider).get<_J>('/projects/$id'));
});

final projectTasksProvider = FutureProvider.autoDispose.family<List<Task>, String>((ref, projectId) async {
  return _tasks(await ref.watch(apiProvider).get<List<dynamic>>('/projects/$projectId/tasks'));
});

final taskProvider = FutureProvider.autoDispose.family<Task, String>((ref, id) async {
  return Task.fromJson(await ref.watch(apiProvider).get<_J>('/tasks/$id'));
});

final commentsProvider = FutureProvider.autoDispose.family<List<Comment>, String>((ref, taskId) async {
  final list = await ref.watch(apiProvider).get<List<dynamic>>('/tasks/$taskId/comments');
  return [for (final c in list) Comment.fromJson(c as _J)];
});

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final list = await ref.watch(apiProvider).get<List<dynamic>>('/notifications');
  return [for (final n in list) AppNotification.fromJson(n as _J)];
});

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  return (await ref.watch(apiProvider).get<_J>('/notifications/unread-count'))['count'] as int;
});

final membersProvider = FutureProvider.autoDispose<List<UserBrief>>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  final ws = await ref.watch(apiProvider).get<_J>('/workspaces/$wid');
  return [for (final m in ws['members'] as List) UserBrief.fromJson(m as _J)];
});

/// Refreshes every view that can show a task; pass `ref.invalidate` from a WidgetRef or Ref.
void invalidateTaskViews(void Function(ProviderOrFamily) invalidate, {String? taskId, String? projectId}) {
  invalidate(dashboardProvider);
  invalidate(myTasksProvider);
  invalidate(projectsProvider);
  invalidate(unreadCountProvider);
  if (projectId != null) invalidate(projectTasksProvider(projectId));
  if (taskId != null) {
    invalidate(taskProvider(taskId));
    invalidate(commentsProvider(taskId));
  }
}

// ---------- Phase 7: calendar, docs, chat, focus, arena ----------

final rangeTasksProvider = FutureProvider.autoDispose.family<List<Task>, ({DateTime from, DateTime to})>((ref, r) async {
  final wid = ref.watch(workspaceIdProvider);
  return _tasks(
    await ref
        .watch(apiProvider)
        .get<List<dynamic>>(
          '/workspaces/$wid/tasks',
          query: {'from': r.from.toUtc().toIso8601String(), 'to': r.to.toUtc().toIso8601String(), 'includeDone': 'true'},
        ),
  );
});

final meetingsProvider = FutureProvider.autoDispose.family<List<DocBrief>, ({DateTime from, DateTime to})>((ref, r) async {
  final wid = ref.watch(workspaceIdProvider);
  final list = await ref
      .watch(apiProvider)
      .get<List<dynamic>>('/workspaces/$wid/meetings', query: {'from': r.from.toUtc().toIso8601String(), 'to': r.to.toUtc().toIso8601String()});
  return [for (final d in list) DocBrief.fromJson(d as _J)];
});

final docsProvider = FutureProvider.autoDispose<List<DocBrief>>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  return [for (final d in await ref.watch(apiProvider).get<List<dynamic>>('/workspaces/$wid/docs')) DocBrief.fromJson(d as _J)];
});

final docProvider = FutureProvider.autoDispose.family<DocDetail, String>((ref, id) async {
  return DocDetail.fromJson(await ref.watch(apiProvider).get<_J>('/docs/$id'));
});

final channelsProvider = FutureProvider.autoDispose<List<Channel>>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  return [for (final c in await ref.watch(apiProvider).get<List<dynamic>>('/workspaces/$wid/channels')) Channel.fromJson(c as _J)];
});

final messagesProvider = FutureProvider.autoDispose.family<List<ChatMessage>, String>((ref, channelId) async {
  return [for (final m in await ref.watch(apiProvider).get<List<dynamic>>('/channels/$channelId/messages')) ChatMessage.fromJson(m as _J)];
});

final threadProvider = FutureProvider.autoDispose.family<List<ChatMessage>, String>((ref, id) async {
  final res = await ref.watch(apiProvider).get<_J>('/messages/$id/thread');
  return [ChatMessage.fromJson(res['root'] as _J), for (final m in res['replies'] as List) ChatMessage.fromJson(m as _J)];
});

final focusProvider = FutureProvider.autoDispose<FocusStats>((ref) async {
  return FocusStats.fromJson(await ref.watch(apiProvider).get<_J>('/me/focus'));
});

final gameProvider = FutureProvider.autoDispose<List<GameMember>>((ref) async {
  final wid = ref.watch(workspaceIdProvider);
  final res = await ref.watch(apiProvider).get<_J>('/workspaces/$wid/gamification');
  return [for (final m in res['members'] as List) GameMember.fromJson(m as _J)];
});

final aiStatusProvider = FutureProvider.autoDispose<bool>((ref) async {
  return (await ref.watch(apiProvider).get<_J>('/ai/status'))['enabled'] as bool? ?? false;
});
