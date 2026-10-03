import 'package:flutter_riverpod/flutter_riverpod.dart';

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
