import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/core/models/models.dart';
import 'package:lumi/core/theme/lumi_theme.dart';
import 'package:lumi/core/widgets/widgets.dart';

void main() {
  testWidgets('check circle toggles and blooms', (tester) async {
    var checked = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: LumiTheme.light(),
        home: Scaffold(
          body: StatefulBuilder(
            builder: (_, setState) => CheckCircle(checked: checked, onChanged: (v) => setState(() => checked = v)),
          ),
        ),
      ),
    );
    await tester.tap(find.byType(CheckCircle));
    await tester.pump(const Duration(milliseconds: 300));
    expect(checked, isTrue);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('status dot shows a check for done', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: LumiTheme.light(),
        home: const Scaffold(
          body: StatusDot(Status(id: 's', name: 'Done', category: 'DONE', color: '#16A34A')),
        ),
      ),
    );
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });
}
