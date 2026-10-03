import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api/api_client.dart';
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
    ..on('notification', (_) {
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadCountProvider);
    })
    ..connect();
  ref.onDispose(socket.dispose);
});
