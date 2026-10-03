import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api/api_client.dart';
import 'core/l10n/strings.dart';
import 'core/providers.dart';
import 'core/router.dart';
import 'core/theme/lumi_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final catalogs = {'fa': await Strings.load('fa'), 'en': await Strings.load('en')};
  final tokens = TokenStore();
  await tokens.load();
  runApp(ProviderScope(overrides: [catalogsProvider.overrideWithValue(catalogs), tokenStoreProvider.overrideWithValue(tokens)], child: const LumiApp()));
}

class LumiApp extends ConsumerWidget {
  const LumiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    return MaterialApp.router(
      title: 'Lumi',
      debugShowCheckedModeBanner: false,
      theme: LumiTheme.light(),
      darkTheme: LumiTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      routerConfig: ref.watch(routerProvider),
      locale: Locale(locale),
      supportedLocales: const [Locale('fa'), Locale('en')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    );
  }
}
