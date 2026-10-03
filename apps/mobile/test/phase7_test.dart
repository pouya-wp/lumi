import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/core/api/api_client.dart';
import 'package:lumi/core/l10n/strings.dart';
import 'package:lumi/core/providers.dart';
import 'package:lumi/core/theme/lumi_theme.dart';
import 'package:lumi/features/docs/docs_screens.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('response cache round-trips JSON per path and query, and clears', () async {
    SharedPreferences.setMockInitialValues({'other': 'keep'});
    final prefs = await SharedPreferences.getInstance();
    final cache = ResponseCache(prefs);
    cache.write(
      '/me/tasks',
      {'scope': 'today'},
      [
        {'id': 't1', 'title': 'سلام'},
      ],
    );
    expect((cache.read('/me/tasks', {'scope': 'today'}) as List).first['title'], 'سلام');
    expect(cache.read('/me/tasks', {'scope': 'open'}), isNull);
    await cache.clear();
    expect(cache.read('/me/tasks', {'scope': 'today'}), isNull);
    expect(prefs.getString('other'), 'keep');
  });

  test('offline GET falls back to the cache and flags offline', () async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final cache = ResponseCache(await SharedPreferences.getInstance());
    cache.write('/workspaces', null, [
      {'id': 'w1'},
    ]);
    final api = ApiClient(TokenStore(), onUnauthorized: () {}, cache: cache);
    // Every request fails before reaching a server, like a phone with no signal.
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) => h.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError)),
      ),
    );
    final list = await api.get<List<dynamic>>('/workspaces');
    expect((list.first as Map)['id'], 'w1');
    expect(api.offline.value, isTrue);
    await expectLater(api.get<List<dynamic>>('/nothing-cached'), throwsA(isA<ApiException>()));
  });

  testWidgets('renders TipTap JSON blocks natively', (tester) async {
    final catalogs = {'fa': await Strings.load('fa'), 'en': await Strings.load('en')};
    const doc = {
      'type': 'doc',
      'content': [
        {
          'type': 'heading',
          'attrs': {'level': 1},
          'content': [
            {'type': 'text', 'text': 'Roadmap'},
          ],
        },
        {
          'type': 'paragraph',
          'content': [
            {
              'type': 'text',
              'text': 'bold ',
              'marks': [
                {'type': 'bold'},
              ],
            },
            {
              'type': 'mention',
              'attrs': {'id': 'u1', 'label': 'Sara'},
            },
          ],
        },
        {
          'type': 'taskList',
          'content': [
            {
              'type': 'taskItem',
              'attrs': {'checked': true},
              'content': [
                {
                  'type': 'paragraph',
                  'content': [
                    {'type': 'text', 'text': 'Ship it'},
                  ],
                },
              ],
            },
          ],
        },
        {
          'type': 'callout',
          'attrs': {'emoji': '🚀'},
          'content': [
            {
              'type': 'paragraph',
              'content': [
                {'type': 'text', 'text': 'Launch soon'},
              ],
            },
          ],
        },
        {
          'type': 'codeBlock',
          'content': [
            {'type': 'text', 'text': 'pnpm build'},
          ],
        },
      ],
    };
    await tester.pumpWidget(
      ProviderScope(
        overrides: [catalogsProvider.overrideWithValue(catalogs), tokenStoreProvider.overrideWithValue(TokenStore())],
        child: MaterialApp(
          theme: LumiTheme.light(),
          home: const Scaffold(
            body: SingleChildScrollView(
              child: DocBody(content: doc, members: []),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Roadmap'), findsOneWidget);
    expect(find.textContaining('Sara', findRichText: true), findsOneWidget);
    expect(find.text('🚀'), findsOneWidget);
    expect(find.text('pnpm build'), findsOneWidget);
    expect(find.byIcon(Icons.check_box_rounded), findsOneWidget);
  });
}
