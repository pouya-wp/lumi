import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'l10n/strings.dart';
import 'models/models.dart';

/// Overridden in main() after loading catalogs and stored tokens.
final catalogsProvider = Provider<Map<String, Strings>>((ref) => throw UnimplementedError());
final tokenStoreProvider = Provider<TokenStore>((ref) => throw UnimplementedError());

final localeProvider = StateProvider<String>((ref) => 'fa');
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
final stringsProvider = Provider<Strings>((ref) => ref.watch(catalogsProvider)[ref.watch(localeProvider)]!);

final apiProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStoreProvider), onUnauthorized: () => ref.read(sessionProvider.notifier).signOut());
});

class Session {
  const Session({required this.user, required this.workspaces, required this.workspaceId});

  final User user;
  final List<Workspace> workspaces;
  final String workspaceId;

  Workspace get workspace => workspaces.firstWhere((w) => w.id == workspaceId, orElse: () => workspaces.first);

  Session copyWith({String? workspaceId}) => Session(user: user, workspaces: workspaces, workspaceId: workspaceId ?? this.workspaceId);
}

/// Signed-in user and current workspace; null when signed out.
class SessionNotifier extends AsyncNotifier<Session?> {
  @override
  Future<Session?> build() async {
    final tokens = ref.read(tokenStoreProvider);
    if (tokens.access == null) return null;
    try {
      return await _load();
    } on ApiException catch (e) {
      if (e.status == 401) {
        await tokens.clear();
        return null;
      }
      rethrow;
    }
  }

  Future<Session> _load() async {
    final api = ref.read(apiProvider);
    final user = User.fromJson(await api.get<Map<String, dynamic>>('/auth/me'));
    final workspaces = [for (final w in await api.get<List<dynamic>>('/workspaces')) Workspace.fromJson(w as Map<String, dynamic>)];
    ref.read(localeProvider.notifier).state = user.locale == 'en' ? 'en' : 'fa';
    return Session(user: user, workspaces: workspaces, workspaceId: workspaces.first.id);
  }

  Future<void> signIn(Map<String, dynamic> body) async {
    await ref.read(tokenStoreProvider).save(body['accessToken'] as String, body['refreshToken'] as String);
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  Future<void> signOut() async {
    final tokens = ref.read(tokenStoreProvider);
    final refresh = tokens.refresh;
    if (refresh != null) ref.read(apiProvider).post('/auth/logout', {'refreshToken': refresh}).ignore();
    await tokens.clear();
    state = const AsyncData(null);
  }

  void switchWorkspace(String id) {
    final current = state.valueOrNull;
    if (current != null) state = AsyncData(current.copyWith(workspaceId: id));
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, Session?>(SessionNotifier.new);

final workspaceIdProvider = Provider<String?>((ref) => ref.watch(sessionProvider).valueOrNull?.workspaceId);
