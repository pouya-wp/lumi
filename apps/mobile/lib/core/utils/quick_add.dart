import 'digits.dart';

/// Dart port of packages/shared/src/quick-add.ts — keep both in sync.
class QuickAddResult {
  QuickAddResult({required this.title, this.dueAt, this.priority, required this.labels, required this.mentions});

  final String title;
  final DateTime? dueAt;
  final String? priority;
  final List<String> labels;
  final List<String> mentions;
}

const _priorityWords = {
  'فوری': 'URGENT',
  'urgent': 'URGENT',
  'بالا': 'HIGH',
  'مهم': 'HIGH',
  'high': 'HIGH',
  'متوسط': 'MEDIUM',
  'medium': 'MEDIUM',
  'کم': 'LOW',
  'low': 'LOW',
};

// Dart weekday: Monday = 1 … Sunday = 7.
const _weekdays = {
  'یکشنبه': 7,
  'یک‌شنبه': 7,
  'sunday': 7,
  'sun': 7,
  'دوشنبه': 1,
  'monday': 1,
  'mon': 1,
  'سه‌شنبه': 2,
  'سهشنبه': 2,
  'tuesday': 2,
  'tue': 2,
  'چهارشنبه': 3,
  'wednesday': 3,
  'wed': 3,
  'پنجشنبه': 4,
  'پنج‌شنبه': 4,
  'thursday': 4,
  'thu': 4,
  'جمعه': 5,
  'friday': 5,
  'fri': 5,
  'شنبه': 6,
  'saturday': 6,
  'sat': 6,
};

const _relativeDays = {'امروز': 0, 'today': 0, 'فردا': 1, 'tomorrow': 1, 'پس‌فردا': 2, 'پسفردا': 2};

({int h, int m})? _parseTime(String token) {
  final match = RegExp(r'^(\d{1,2})(?::(\d{2}))?(am|pm)?$', caseSensitive: false).firstMatch(toEnDigits(token));
  if (match == null) return null;
  var h = int.parse(match[1]!);
  final m = int.parse(match[2] ?? '0');
  final suffix = match[3]?.toLowerCase();
  if (suffix == 'pm' && h < 12) h += 12;
  if (suffix == 'am' && h == 12) h = 0;
  if (h > 23 || m > 59) return null;
  return (h: h, m: m);
}

int _offsetToWeekday(DateTime now, int weekday) {
  final diff = (weekday - now.weekday + 7) % 7;
  return diff == 0 ? 7 : diff;
}

QuickAddResult parseQuickAdd(String input, [DateTime? clock]) {
  final now = clock ?? DateTime.now();
  final tokens = input.trim().split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
  final title = <String>[];
  final labels = <String>[];
  final mentions = <String>[];
  String? priority;
  int? dayOffset;
  ({int h, int m})? time;

  for (var i = 0; i < tokens.length; i++) {
    final token = tokens[i];
    final lower = token.toLowerCase();
    final next = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (token.startsWith('#') && token.length > 1) {
      labels.add(token.substring(1));
    } else if (token.startsWith('@') && token.length > 1) {
      mentions.add(token.substring(1));
    } else if (token.startsWith('!') && _priorityWords.containsKey(lower.substring(1))) {
      priority = _priorityWords[lower.substring(1)];
    } else if (_relativeDays.containsKey(lower)) {
      dayOffset = _relativeDays[lower];
    } else if (lower == 'پس' && next == 'فردا') {
      dayOffset = 2;
      i++;
    } else if ((lower == 'سه' || lower == 'پنج' || lower == 'یک') && next == 'شنبه') {
      dayOffset = _offsetToWeekday(now, _weekdays['$lower‌شنبه'] ?? _weekdays['$lowerشنبه']!);
      i++;
    } else if (_weekdays.containsKey(lower)) {
      dayOffset = _offsetToWeekday(now, _weekdays[lower]!);
    } else if ((lower == 'ساعت' || lower == 'at') && next != null && _parseTime(next) != null) {
      time = _parseTime(next);
      i++;
    } else {
      title.add(token);
    }
  }

  DateTime? due;
  if (dayOffset != null || time != null) {
    final day = DateTime(now.year, now.month, now.day + (dayOffset ?? 0));
    due = time != null ? DateTime(day.year, day.month, day.day, time.h, time.m) : DateTime(day.year, day.month, day.day, 23, 59);
  }
  return QuickAddResult(title: title.join(' '), dueAt: due, priority: priority, labels: labels, mentions: mentions);
}
