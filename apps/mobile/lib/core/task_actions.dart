import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'data.dart';
import 'models/models.dart';
import 'providers.dart';

/// Task mutations shared by every screen; each refreshes the affected views and reports errors as a snackbar.
class TaskActions {
  TaskActions(this._ref, this._context);

  final WidgetRef _ref;
  final BuildContext _context;

  ApiClient get _api => _ref.read(apiProvider);

  Future<T?> _run<T>(Future<T> Function() action, {String? taskId, String? projectId}) async {
    try {
      final result = await action();
      invalidateTaskViews(_ref.invalidate, taskId: taskId, projectId: projectId);
      return result;
    } on ApiException catch (e) {
      if (_context.mounted) ScaffoldMessenger.of(_context).showSnackBar(SnackBar(content: Text('⚠️  ${e.message}')));
      return null;
    }
  }

  Future<void> update(Task task, Map<String, dynamic> data) =>
      _run(() => _api.patch<Map<String, dynamic>>('/tasks/${task.id}', data), taskId: task.id, projectId: task.projectId);

  Future<void> move(Task task, String statusId, {String? beforeId, String? afterId}) => _run(
    () => _api.post<Map<String, dynamic>>('/tasks/${task.id}/move', {'statusId': statusId, 'beforeId': ?beforeId, 'afterId': ?afterId}),
    taskId: task.id,
    projectId: task.projectId,
  );

  /// Moves to the project's first DONE (or back to TODO) status.
  Future<void> toggleDone(Task task, List<Status> statuses) async {
    final target = statuses.where((s) => s.category == (task.isDone ? 'TODO' : 'DONE')).firstOrNull;
    if (target != null) await update(task, {'statusId': target.id});
  }

  Future<void> respond(Task task, String action, {String? note, DateTime? dueAt}) => _run(
    () => _api.post<Map<String, dynamic>>('/tasks/${task.id}/proposal', {
      'action': action,
      'note': ?note,
      if (dueAt != null) 'dueAt': dueAt.toUtc().toIso8601String(),
    }),
    taskId: task.id,
    projectId: task.projectId,
  );

  Future<void> setAssignees(Task task, List<String> userIds) =>
      _run(() => _api.put<Map<String, dynamic>>('/tasks/${task.id}/assignees', {'userIds': userIds}), taskId: task.id, projectId: task.projectId);

  Future<void> remove(Task task) => _run(() => _api.delete('/tasks/${task.id}'), taskId: task.id, projectId: task.projectId);

  Future<Task?> create(String projectId, Map<String, dynamic> body) async {
    final json = await _run(() => _api.post<Map<String, dynamic>>('/projects/$projectId/tasks', body), projectId: projectId);
    return json == null ? null : Task.fromJson(json);
  }

  Future<void> addChecklist(Task task, String text) =>
      _run(() => _api.post('/tasks/${task.id}/checklist', {'text': text}), taskId: task.id, projectId: task.projectId);

  Future<void> toggleChecklist(Task task, ChecklistItem item) =>
      _run(() => _api.patch('/checklist/${item.id}', {'done': !item.done}), taskId: task.id, projectId: task.projectId);

  Future<void> comment(Task task, String text, List<String> mentionIds) =>
      _run(() => _api.post('/tasks/${task.id}/comments', {'text': text, 'mentionIds': mentionIds}), taskId: task.id, projectId: task.projectId);
}

extension TaskActionsX on WidgetRef {
  TaskActions tasks(BuildContext context) => TaskActions(this, context);
}
