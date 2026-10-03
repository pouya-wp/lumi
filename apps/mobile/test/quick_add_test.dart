import 'package:flutter_test/flutter_test.dart';
import 'package:lumi/core/utils/quick_add.dart';

void main() {
  // Saturday 2026-10-03 09:00.
  final now = DateTime(2026, 10, 3, 9);

  test('parses Persian date, time, label, mention and priority', () {
    final r = parseQuickAdd('فردا ساعت ۱۰ گزارش فروش @علی #مارکتینگ !فوری', now);
    expect(r.title, 'گزارش فروش');
    expect(r.labels, ['مارکتینگ']);
    expect(r.mentions, ['علی']);
    expect(r.priority, 'URGENT');
    expect(r.dueAt, DateTime(2026, 10, 4, 10));
  });

  test('weekdays resolve to the next occurrence', () {
    expect(parseQuickAdd('جلسه سه شنبه', now).dueAt!.weekday, DateTime.tuesday);
    expect(parseQuickAdd('جلسه سه‌شنبه', now).title, 'جلسه');
    expect(parseQuickAdd('review saturday', now).dueAt!.day, 10);
  });

  test('English input with pm time', () {
    final r = parseQuickAdd('tomorrow at 3pm ship release !high', now);
    expect(r.title, 'ship release');
    expect(r.priority, 'HIGH');
    expect(r.dueAt!.hour, 15);
  });
}
