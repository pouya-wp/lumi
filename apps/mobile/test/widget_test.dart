import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/features/home/home_screen.dart';

void main() {
  testWidgets('home screen shows today card', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    expect(find.text('امروز'), findsOneWidget);
  });
}
