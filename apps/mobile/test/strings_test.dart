import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/core/l10n/strings.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('resolves dotted keys, nested sections, arrays and params', () async {
    final s = await Strings.load('fa');
    expect(s.t('notif.task.assigned', {'title': 'X'}), contains('X'));
    expect(s.t('auto.triggers.task.created'), isNot(contains('auto.')));
    expect(s.t('priority.URGENT'), 'فوری');
    expect(s.raw('ai.suggestions'), isA<List<dynamic>>());
    expect(s.t('project.tasks', {'n': 12}), contains('۱۲'));
    expect(s.t('missing.key'), 'missing.key');
  });
}
