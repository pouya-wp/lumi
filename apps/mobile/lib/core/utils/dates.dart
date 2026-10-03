import 'package:intl/intl.dart';
import 'package:shamsi_date/shamsi_date.dart';

import '../l10n/strings.dart';

const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const jalaliWeekdays = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه'];

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// "۱۲ مهر" in fa (Jalali), "Oct 4" in en.
String shortDate(DateTime d, Strings s) {
  if (s.isFa) {
    final j = Jalali.fromDateTime(d);
    return s.n('${j.day} ${jalaliMonths[j.month - 1]}');
  }
  return DateFormat('MMM d', 'en').format(d);
}

String weekday(DateTime d, Strings s) => s.isFa ? jalaliWeekdays[d.weekday - 1] : DateFormat('EEEE', 'en').format(d);

String longDate(DateTime d, Strings s) {
  if (s.isFa) {
    final j = Jalali.fromDateTime(d);
    return s.n('${weekday(d, s)}، ${j.day} ${jalaliMonths[j.month - 1]} ${j.year}');
  }
  return DateFormat('EEEE, MMMM d, y', 'en').format(d);
}

enum DueTone { late, today, soon, later }

({String label, DueTone tone}) dueInfo(DateTime due, Strings s) {
  final days = startOfDay(due.toLocal()).difference(startOfDay(DateTime.now())).inDays;
  if (days < -1) return (label: s.t('common.daysLate', {'n': -days}), tone: DueTone.late);
  if (days == -1) return (label: s.t('common.yesterday'), tone: DueTone.late);
  if (days == 0) return (label: s.t('common.today'), tone: DueTone.today);
  if (days == 1) return (label: s.t('common.tomorrow'), tone: DueTone.soon);
  if (days <= 6) return (label: weekday(due.toLocal(), s), tone: DueTone.soon);
  return (label: shortDate(due.toLocal(), s), tone: DueTone.later);
}

String timeAgo(DateTime d, Strings s) {
  final diff = DateTime.now().difference(d);
  String unit(int n, String fa, String en) => s.isFa ? '${s.n(n)} $fa پیش' : '$n $en ago';
  if (diff.inMinutes < 1) return s.isFa ? 'همین الان' : 'just now';
  if (diff.inHours < 1) return unit(diff.inMinutes, 'دقیقه', 'min');
  if (diff.inDays < 1) return unit(diff.inHours, 'ساعت', 'h');
  if (diff.inDays < 30) return unit(diff.inDays, 'روز', 'd');
  return shortDate(d, s);
}
