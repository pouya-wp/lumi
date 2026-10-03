import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/ai/ai_screen.dart';
import '../features/arena/arena_screen.dart';
import '../features/auth/auth_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/chat/chat_screens.dart';
import '../features/docs/docs_screens.dart';
import '../features/focus/focus_screen.dart';
import '../features/home/home_screen.dart';
import '../features/inbox/inbox_screen.dart';
import '../features/projects/board_screen.dart';
import '../features/projects/projects_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/tasks/my_tasks_screen.dart';
import '../features/team/team_screen.dart';
import 'providers.dart';

/// Bridges session changes into GoRouter's refresh.
class _SessionListenable extends ChangeNotifier {
  _SessionListenable(Ref ref) {
    ref.listen(sessionProvider, (_, __) => notifyListeners());
  }
}

/// Root navigator, used to open screens from outside the widget tree (notification taps).
final rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _SessionListenable(ref);
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      if (session.isLoading) return state.matchedLocation == '/splash' ? null : '/splash';
      final signedIn = session.valueOrNull != null;
      final onAuth = state.matchedLocation == '/login' || state.matchedLocation == '/register';
      if (!signedIn) return onAuth ? null : '/login';
      if (onAuth || state.matchedLocation == '/splash') return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, __) => const Scaffold(body: Center(child: CircularProgressIndicator(strokeWidth: 2))),
      ),
      GoRoute(path: '/login', builder: (_, __) => const AuthScreen(register: false)),
      GoRoute(path: '/register', builder: (_, __) => const AuthScreen(register: true)),
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/home', builder: (_, __) => const HomeScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/tasks', builder: (_, __) => const MyTasksScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/projects',
                builder: (_, __) => const ProjectsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) => BoardScreen(projectId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/inbox', builder: (_, __) => const InboxScreen())],
          ),
        ],
      ),
      GoRoute(path: '/team', builder: (_, __) => const TeamScreen()),
      GoRoute(path: '/calendar', builder: (_, __) => const CalendarScreen()),
      GoRoute(path: '/focus', builder: (_, __) => const FocusScreen()),
      GoRoute(path: '/ai', builder: (_, __) => const AiScreen()),
      GoRoute(path: '/arena', builder: (_, __) => const ArenaScreen()),
      GoRoute(
        path: '/docs',
        builder: (_, __) => const DocsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (_, state) => DocScreen(docId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/chat',
        builder: (_, __) => const ChatListScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (_, state) => ConversationScreen(channelId: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'thread/:mid',
                builder: (_, state) => ConversationScreen(channelId: state.pathParameters['id']!, parentId: state.pathParameters['mid']),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
