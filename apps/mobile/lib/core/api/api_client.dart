import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Base URL: pass --dart-define=API_URL=... ; defaults to the Android emulator host or localhost.
String get apiUrl {
  const defined = String.fromEnvironment('API_URL');
  if (defined.isNotEmpty) return defined;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  String? access;
  String? refresh;

  Future<void> load() async {
    access = await _storage.read(key: 'lumi.access');
    refresh = await _storage.read(key: 'lumi.refresh');
  }

  Future<void> save(String accessToken, String refreshToken) async {
    access = accessToken;
    refresh = refreshToken;
    await _storage.write(key: 'lumi.access', value: accessToken);
    await _storage.write(key: 'lumi.refresh', value: refreshToken);
  }

  Future<void> clear() async {
    access = null;
    refresh = null;
    await _storage.delete(key: 'lumi.access');
    await _storage.delete(key: 'lumi.refresh');
  }
}

class ApiException implements Exception {
  ApiException(this.status, this.message);

  final int? status;
  final String message;

  @override
  String toString() => message;
}

/// Last good GET responses, so screens still render when the network drops.
class ResponseCache {
  ResponseCache(this._prefs);

  final SharedPreferences _prefs;
  static const _prefix = 'lumi.cache:';

  String _key(String path, Map<String, dynamic>? query) =>
      '$_prefix$path?${query == null ? '' : Uri(queryParameters: query.map((k, v) => MapEntry(k, '$v'))).query}';

  void write(String path, Map<String, dynamic>? query, Object? data) => _prefs.setString(_key(path, query), jsonEncode(data));

  Object? read(String path, Map<String, dynamic>? query) {
    final raw = _prefs.getString(_key(path, query));
    return raw == null ? null : jsonDecode(raw);
  }

  Future<void> clear() async {
    for (final k in _prefs.getKeys().where((k) => k.startsWith(_prefix)).toList()) {
      await _prefs.remove(k);
    }
  }
}

/// Dio client that attaches the access token and transparently rotates it once on 401.
/// GETs fall back to [cache] when the server is unreachable; [offline] reflects that state.
class ApiClient {
  ApiClient(this.tokens, {required this.onUnauthorized, this.cache, String? baseUrl})
    : _dio = Dio(BaseOptions(baseUrl: '${baseUrl ?? apiUrl}/api', connectTimeout: const Duration(seconds: 10), receiveTimeout: const Duration(seconds: 20))) {
    _dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (options, handler) {
          if (tokens.access != null) options.headers['Authorization'] = 'Bearer ${tokens.access}';
          handler.next(options);
        },
        onError: (error, handler) async {
          final retried = error.requestOptions.extra['retried'] == true;
          if (error.response?.statusCode == 401 && !retried && tokens.refresh != null && await _refresh()) {
            final opts = error.requestOptions
              ..extra['retried'] = true
              ..headers['Authorization'] = 'Bearer ${tokens.access}';
            try {
              return handler.resolve(await _dio.fetch(opts));
            } on DioException catch (e) {
              return handler.next(e);
            }
          }
          if (error.response?.statusCode == 401) onUnauthorized();
          handler.next(error);
        },
      ),
    );
  }

  final TokenStore tokens;
  final void Function() onUnauthorized;
  final ResponseCache? cache;
  final ValueNotifier<bool> offline = ValueNotifier(false);
  final Dio _dio;

  @visibleForTesting
  Dio get dio => _dio;

  Future<bool> _refresh() async {
    try {
      final res = await Dio(BaseOptions(baseUrl: '$apiUrl/api')).post('/auth/refresh', data: {'refreshToken': tokens.refresh});
      await tokens.save(res.data['accessToken'] as String, res.data['refreshToken'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<T> _call<T>(Future<Response<dynamic>> Function() request) async {
    try {
      final res = await request();
      return res.data as T;
    } on DioException catch (e) {
      final data = e.response?.data;
      final message = data is Map ? (data['message'] is List ? (data['message'] as List).join(', ') : '${data['message']}') : e.message ?? 'Network error';
      throw ApiException(e.response?.statusCode, message);
    }
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    try {
      final data = await _call<T>(() => _dio.get(path, queryParameters: query));
      offline.value = false;
      cache?.write(path, query, data);
      return data;
    } on ApiException catch (e) {
      if (e.status != null) rethrow;
      offline.value = true;
      final cached = cache?.read(path, query);
      if (cached is T) return cached;
      rethrow;
    }
  }

  Future<T> post<T>(String path, [Object? body]) => _call(() => _dio.post(path, data: body ?? {}));
  Future<T> patch<T>(String path, Object body) => _call(() => _dio.patch(path, data: body));
  Future<T> put<T>(String path, Object body) => _call(() => _dio.put(path, data: body));
  Future<void> delete(String path) => _call(() => _dio.delete(path));
}
