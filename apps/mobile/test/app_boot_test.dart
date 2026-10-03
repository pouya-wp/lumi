import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/core/api/api_client.dart';
import 'package:lumi/core/l10n/strings.dart';
import 'package:lumi/core/providers.dart';
import 'package:lumi/main.dart';

void main() {
  testWidgets('boots to the login screen when signed out', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    final catalogs = {'fa': await Strings.load('fa'), 'en': await Strings.load('en')};
    final tokens = TokenStore();
    await tokens.load();
    await tester.pumpWidget(
      ProviderScope(overrides: [catalogsProvider.overrideWithValue(catalogs), tokenStoreProvider.overrideWithValue(tokens)], child: const LumiApp()),
    );
    await tester.pumpAndSettle();
    expect(find.text(catalogs['fa']!.t('auth.loginTitle')), findsOneWidget);
  });
}
