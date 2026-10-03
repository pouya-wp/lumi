import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// System notifications for realtime events that arrive while the app is in the background.
///
/// This covers the running-app case; true push (app killed) needs FCM/APNs keys,
/// see docs/DEPLOYMENT.md. Taps are surfaced on [taps] with the payload (a task id).
class LocalNotifications {
  LocalNotifications._();
  static final instance = LocalNotifications._();

  final _plugin = FlutterLocalNotificationsPlugin();
  final _taps = StreamController<String>.broadcast();
  bool _ready = false;
  int _id = 0;

  Stream<String> get taps => _taps.stream;

  Future<void> init() async {
    if (kIsWeb || _ready) return;
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher'), iOS: DarwinInitializationSettings()),
        onDidReceiveNotificationResponse: (r) {
          if (r.payload != null && r.payload!.isNotEmpty) _taps.add(r.payload!);
        },
      );
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
      _ready = true;
    } catch (_) {
      // Unsupported platform (tests, desktop without a backend): stay silent.
    }
  }

  Future<void> show(String title, String body, {String? payload}) async {
    if (!_ready) return;
    await _plugin.show(
      id: _id++ % 1000,
      title: title,
      body: body,
      payload: payload,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'lumi',
          'Lumi',
          channelDescription: 'Tasks, mentions and chat',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
