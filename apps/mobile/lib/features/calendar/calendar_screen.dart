import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:shamsi_date/shamsi_date.dart';

import '../../core/data.dart';
import '../../core/l10n/strings.dart';
import '../../core/models/collab.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/widgets.dart';
import '../tasks/task_row.dart';

const _faWeekShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const _enWeekShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/// A month in the user's calendar: Jalali (Saturday-first) for fa, Gregorian (Sunday-first) for en.
class _Month {
  const _Month(this.year, this.month);

  final int year;
  final int month;

  _Month shift(int delta) {
    final m = month - 1 + delta;
    return _Month(year + (m / 12).floor(), m % 12 + 1);
  }

  DateTime first(bool fa) => fa ? Jalali(year, month, 1).toDateTime() : DateTime(year, month, 1);

  int length(bool fa) => fa ? Jalali(year, month, 1).monthLength : DateUtils.getDaysInMonth(year, month);

  static _Month of(DateTime d, bool fa) {
    if (fa) {
      final j = Jalali.fromDateTime(d);
      return _Month(j.year, j.month);
    }
    return _Month(d.year, d.month);
  }

  String title(Strings s) => s.isFa ? s.n('${jalaliMonths[month - 1]} $year') : DateFormat('MMMM y', 'en').format(DateTime(year, month));

  /// 42 days starting on the locale's first weekday on or before the 1st.
  List<DateTime> grid(bool fa) {
    final start = first(fa);
    final weekStart = fa ? DateTime.saturday : DateTime.sunday;
    final offset = (start.weekday - weekStart + 7) % 7;
    return [for (var i = 0; i < 42; i++) DateTime(start.year, start.month, start.day - offset + i)];
  }
}

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late _Month _month;
  DateTime _selected = startOfDay(DateTime.now());

  @override
  void initState() {
    super.initState();
    _month = _Month.of(DateTime.now(), ref.read(stringsProvider).isFa);
  }

  int _dayNumber(DateTime d, bool fa) => fa ? Jalali.fromDateTime(d).day : d.day;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final fa = s.isFa;
    final days = _month.grid(fa);
    final range = (from: days.first, to: days.last.add(const Duration(days: 1)));
    final tasks = ref.watch(rangeTasksProvider(range)).valueOrNull ?? const <Task>[];
    final meetings = ref.watch(meetingsProvider(range)).valueOrNull ?? const <DocBrief>[];
    final first = _month.first(fa);
    final next = _month.shift(1).first(fa);
    final today = startOfDay(DateTime.now());

    List<Task> tasksOn(DateTime d) => tasks.where((t) => t.dueAt != null && DateUtils.isSameDay(t.dueAt, d)).toList();
    List<DocBrief> meetingsOn(DateTime d) => meetings.where((m) => m.meetingAt != null && DateUtils.isSameDay(m.meetingAt, d)).toList();

    final dayTasks = tasksOn(_selected);
    final dayMeetings = meetingsOn(_selected);

    return Scaffold(
      appBar: AppBar(
        title: Text(_month.title(s)),
        actions: [
          IconButton(onPressed: () => setState(() => _month = _month.shift(-1)), icon: const Icon(Icons.chevron_left_rounded)),
          TextButton(
            onPressed: () => setState(() {
              _month = _Month.of(DateTime.now(), fa);
              _selected = today;
            }),
            child: Text(s.t('planning.today')),
          ),
          IconButton(onPressed: () => setState(() => _month = _month.shift(1)), icon: const Icon(Icons.chevron_right_rounded)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 40),
        children: [
          Panel(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
            child: Column(
              children: [
                Row(
                  children: [
                    for (var i = 0; i < 7; i++)
                      Expanded(
                        child: Center(
                          child: Text(
                            fa ? _faWeekShort[i] : _enWeekShort[i],
                            style: TextStyle(fontSize: 11, color: (fa ? i == 6 : i == 5) ? LumiColors.danger : p.muted),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                GestureDetector(
                  onHorizontalDragEnd: (d) {
                    final v = d.primaryVelocity ?? 0;
                    if (v.abs() < 200) return;
                    final forward = (v < 0) != (Directionality.of(context) == TextDirection.rtl);
                    setState(() => _month = _month.shift(forward ? 1 : -1));
                  },
                  child: GridView.count(
                    crossAxisCount: 7,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    childAspectRatio: .82,
                    children: [
                      for (final d in days)
                        _DayCell(
                          day: _dayNumber(d, fa),
                          label: s.n(_dayNumber(d, fa)),
                          inMonth: !d.isBefore(first) && d.isBefore(next),
                          isToday: d == today,
                          selected: d == _selected,
                          off: d.weekday == DateTime.friday,
                          dots: [for (final t in tasksOn(d).take(3)) LumiColors.parse(t.projectColor)],
                          meeting: meetingsOn(d).isNotEmpty,
                          onTap: () => setState(() => _selected = d),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(longDate(_selected, s), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          ),
          const SizedBox(height: 8),
          if (dayTasks.isEmpty && dayMeetings.isEmpty) EmptyState(emoji: '🌤️', text: s.t('mobile.calendar.empty')),
          for (final m in dayMeetings)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: p.ink,
                borderRadius: BorderRadius.circular(LumiRadius.inner),
                child: ListTile(
                  onTap: () => context.push('/docs/${m.id}'),
                  leading: Text(m.icon ?? '🗓️', style: const TextStyle(fontSize: 22)),
                  title: Text(
                    m.title,
                    style: TextStyle(color: p.onInk, fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    '${s.t('mobile.calendar.meeting')} · ${s.n(DateFormat.Hm().format(m.meetingAt!))}',
                    style: TextStyle(color: p.onInk.withValues(alpha: .6), fontSize: 12),
                  ),
                ),
              ),
            ),
          if (dayTasks.isNotEmpty)
            Panel(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(children: [for (final t in dayTasks) TaskRow(task: t, showProject: true)]),
            ),
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.label,
    required this.inMonth,
    required this.isToday,
    required this.selected,
    required this.off,
    required this.dots,
    required this.meeting,
    required this.onTap,
  });

  final int day;
  final String label;
  final bool inMonth;
  final bool isToday;
  final bool selected;
  final bool off;
  final List<Color> dots;
  final bool meeting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fg = selected
        ? p.onInk
        : !inMonth
        ? p.muted.withValues(alpha: .5)
        : off
        ? LumiColors.danger
        : p.ink;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: selected ? p.ink : (isToday ? p.sunken : Colors.transparent),
          borderRadius: BorderRadius.circular(14),
          border: isToday && !selected ? Border.all(color: p.ink, width: 1.4) : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(color: fg, fontWeight: isToday || selected ? FontWeight.w700 : FontWeight.w500, fontSize: 15),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: 6,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (meeting)
                    Container(
                      width: 10,
                      height: 5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(color: selected ? p.onInk : p.ink, borderRadius: BorderRadius.circular(3)),
                    ),
                  for (final c in dots)
                    Container(
                      width: 5,
                      height: 5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
