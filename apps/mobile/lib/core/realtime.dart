import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'package:flutter/widgets.dart';

import 'api/api_client.dart';
import 'device/notifications.dart';
import 'data.dart';
import 'providers.dart';

/// Socket.IO connection that invalidates cached data on server events; lives while signed in.
final realtimeProvider = Provider.autoDispose<void>((ref) {
  final session = ref.watch(sessionProvider).valueOrNull;
  final token = ref.watch(tokenStoreProvider).access;
  if (session == null || token == null) return;

  final socket = io.io('$apiUrl/realtime', io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).disableAutoConnect().build());
  void onTask(dynamic e) {
    final m = e as Map;
    invalidateTaskViews(ref.invalidate, taskId: m['taskId'] as String?, projectId: m['projectId'] as String?);
  }

  socket
    ..on('task', onTask)
    ..on('comment', onTask)
    ..on('project', (_) => ref.invalidate(projectsProvider))
    ..on('notification', (n) {
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadCountProvider);
      _notifyIfBackground(ref, n);
    })
    ..on('chat', (e) {
      ref.invalidate(channelsProvider);
      final id = (e as Map)['channelId'] as String?;
      if (id != null) ref.invalidate(messagesProvider(id));
    })
    ..connect();
  ref.onDispose(socket.dispose);
});

/// Mirrors an in-app notification to the system tray when the app is not in the foreground.
void _notifyIfBackground(Ref ref, dynamic raw) {
  if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) return;
  final n = raw as Map;
  final payload = (n['payload'] as Map?) ?? const {};
  final s = ref.read(stringsProvider);
  final type = n['type'] as String? ?? '';
  final title = type == 'badge' ? s.t('game.badges.${payload['badge']}.name') : '${payload['title'] ?? ''}';
  LocalNotifications.instance.show('Lumi', s.t('notif.$type', {'title': title, 'status': '${payload['status'] ?? ''}'}), payload: payload['taskId'] as String?);
}
