import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';

import '../l10n/strings.dart';
import '../theme/lumi_colors.dart';
import '../utils/dates.dart';

const _faWeekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const _enWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/// Bottom sheet month grid: Jalali (Saturday-first) for fa, Gregorian for en. Returns 18:00 local of the picked day.
Future<DateTime?> pickDate(BuildContext context, Strings s, {DateTime? initial}) {
  return showModalBottomSheet<DateTime>(
    useRootNavigator: true,
    context: context,
    builder: (_) => _DatePicker(strings: s, initial: initial ?? DateTime.now()),
  );
}

class _DatePicker extends StatefulWidget {
  const _DatePicker({required this.strings, required this.initial});

  final Strings strings;
  final DateTime initial;

  @override
  State<_DatePicker> createState() => _DatePickerState();
}

class _DatePickerState extends State<_DatePicker> {
  late int year;
  late int month;

  bool get jalali => widget.strings.isFa;

  @override
  void initState() {
    super.initState();
    if (jalali) {
      final j = Jalali.fromDateTime(widget.initial);
      year = j.year;
      month = j.month;
    } else {
      year = widget.initial.year;
      month = widget.initial.month;
    }
  }

  DateTime _date(int day) => jalali ? Jalali(year, month, day).toDateTime() : DateTime(year, month, day);
  int get _length => jalali ? Jalali(year, month).monthLength : DateUtils.getDaysInMonth(year, month);

  void _shift(int delta) => setState(() {
    month += delta;
    if (month < 1) {
      month = 12;
      year--;
    } else if (month > 12) {
      month = 1;
      year++;
    }
  });

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final p = context.palette;
    final first = _date(1).weekday; // Mon=1..Sun=7
    final lead = jalali ? (first + 1) % 7 : first % 7;
    final today = startOfDay(DateTime.now());
    final selected = startOfDay(widget.initial);
    final title = jalali
        ? '${jalaliMonths[month - 1]} ${s.n(year)}'
        : '${const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} $year';
    DateTime at18(DateTime d) => DateTime(d.year, d.month, d.day, 18);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                IconButton(onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left_rounded)),
                Expanded(
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                  ),
                ),
                IconButton(onPressed: () => _shift(1), icon: const Icon(Icons.chevron_right_rounded)),
              ],
            ),
            GridView.count(
              crossAxisCount: 7,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (final w in jalali ? _faWeekdays : _enWeekdays)
                  Center(
                    child: Text(w, style: TextStyle(color: p.muted, fontSize: 12)),
                  ),
                for (var i = 0; i < lead; i++) const SizedBox.shrink(),
                for (var d = 1; d <= _length; d++)
                  Builder(
                    builder: (_) {
                      final date = _date(d);
                      final isSel = startOfDay(date) == selected;
                      final isToday = startOfDay(date) == today;
                      final holiday = jalali && date.weekday == DateTime.friday;
                      return Padding(
                        padding: const EdgeInsets.all(3),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => Navigator.pop(context, at18(date)),
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSel ? p.ink : null,
                              border: isToday && !isSel ? Border.all(color: LumiColors.lumi, width: 1.5) : null,
                            ),
                            child: Text(
                              s.n(d),
                              style: TextStyle(
                                color: isSel
                                    ? p.onInk
                                    : holiday
                                    ? LumiColors.danger
                                    : isToday
                                    ? LumiColors.lumi
                                    : p.ink,
                                fontWeight: isToday ? FontWeight.w700 : FontWeight.w400,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final (label, days) in [(s.t('common.today'), 0), (s.t('common.tomorrow'), 1), ('+${s.n(7)}', 7)])
                  ActionChip(
                    label: Text(label),
                    shape: const StadiumBorder(),
                    side: BorderSide(color: p.line),
                    onPressed: () => Navigator.pop(context, at18(today.add(Duration(days: days)))),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
