import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/widgets.dart';
import '../shell/settings_sheet.dart';
import 'launch_strip.dart';
import '../tasks/task_row.dart';
import '../tasks/task_sheet.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final session = ref.watch(sessionProvider).valueOrNull;
    final dash = ref.watch(dashboardProvider);
    final p = context.palette;
    if (session == null) return const SizedBox.shrink();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: p.ink,
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 120),
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: () => showSettings(context),
                    child: Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: p.ink, shape: BoxShape.circle),
                      child: Text(
                        session.workspace.name.characters.first,
                        style: TextStyle(color: p.onInk, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(session.workspace.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(longDate(DateTime.now(), s), style: TextStyle(color: p.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  IconButton(onPressed: () => context.push('/calendar'), icon: const Icon(Icons.calendar_month_outlined)),
                  GestureDetector(
                    onTap: () => showSettings(context),
                    child: LumiAvatar(name: session.user.name, size: 38),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Text(s.t('dash.welcome'), style: TextStyle(color: p.muted, fontSize: 16)),
              Text('${session.user.name.split(' ').first} 👋', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, height: 1.2)),
              const SizedBox(height: 18),
              const LaunchStrip(),
              const SizedBox(height: 14),
              dash.when(
                loading: () => const Padding(padding: EdgeInsets.all(60), child: Loading()),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(dashboardProvider)),
                data: (d) => Column(
                  children: [
                    _FocusPanel(tasks: d.myFocus),
                    const SizedBox(height: 12),
                    Panel(
                      aurora: LumiColors.success,
                      aurora2: LumiColors.warn,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          PanelHeader(icon: Icons.bolt_rounded, title: s.t('dash.overview'), trailing: Pill(s.t('dash.last7'))),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(s.n(d.doneThisWeek), style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w700, height: 1)),
                              const SizedBox(width: 6),
                              Text(s.t('dash.done'), style: TextStyle(color: p.muted)),
                              const Spacer(),
                              Delta(d.doneDelta),
                            ],
                          ),
                          const SizedBox(height: 12),
                          HatchBars(days: d.days, strings: s),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Panel(
                      child: Column(
                        children: [
                          PanelHeader(icon: Icons.track_changes_rounded, title: s.t('dash.goal')),
                          const SizedBox(height: 12),
                          SegmentGauge(value: d.completionRate, label: s.t('dash.done'), strings: s),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: _Kpi(label: s.t('dash.open'), value: d.open),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _Kpi(label: s.t('dash.overdue'), value: d.overdue, warn: d.overdue > 0),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Panel(
                      child: Column(
                        children: [
                          PanelHeader(icon: Icons.groups_2_outlined, title: s.t('dash.team')),
                          const SizedBox(height: 12),
                          for (final m in d.team)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: p.line),
                                ),
                                child: Row(
                                  children: [
                                    LumiAvatar(name: m.name, size: 34),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(m.name, style: const TextStyle(fontWeight: FontWeight.w500)),
                                          const SizedBox(height: 6),
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(9),
                                            child: LinearProgressIndicator(
                                              value: d.team.isEmpty ? 0 : m.open / d.team.map((t) => t.open).fold(1, (a, b) => a > b ? a : b),
                                              minHeight: 4,
                                              backgroundColor: p.sunken,
                                              color: p.ink,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      children: [
                                        Text(s.n(m.open), style: const TextStyle(fontWeight: FontWeight.w700)),
                                        Pill('✓ ${s.n(m.doneThisWeek)}', tone: PillTone.success),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (d.upcoming.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Panel(
                        child: Column(
                          children: [
                            PanelHeader(icon: Icons.event_outlined, title: s.t('dash.upcoming')),
                            const SizedBox(height: 8),
                            for (final t in d.upcoming)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                onTap: () => showTask(context, t.id),
                                leading: Container(
                                  width: 4,
                                  height: 34,
                                  decoration: BoxDecoration(color: LumiColors.parse(t.projectColor), borderRadius: BorderRadius.circular(9)),
                                ),
                                title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14)),
                                subtitle: Text('${t.projectIcon ?? ''} ${t.projectName}', style: TextStyle(color: p.muted, fontSize: 11)),
                                trailing: DueChip(t.dueAt),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Today's focus" — dark panel with a pulse and the next tasks.
class _FocusPanel extends ConsumerWidget {
  const _FocusPanel({required this.tasks});

  final List<Task> tasks;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LumiRadius.panel),
        gradient: const LinearGradient(colors: [LumiColors.lumi, LumiColors.violet, Color(0xFFA5B4FC)]),
      ),
      padding: const EdgeInsets.all(1.5),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(LumiRadius.panel - 1.5)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Pulse(),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(s.t('dash.focus'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
                Pill(s.n(tasks.length), tone: PillTone.ink),
              ],
            ),
            const SizedBox(height: 6),
            if (tasks.isEmpty) EmptyState(emoji: '☕', text: s.t('dash.focusEmpty')),
            for (final t in tasks) TaskRow(task: t, showProject: true),
          ],
        ),
      ),
    );
  }
}

class _Kpi extends ConsumerWidget {
  const _Kpi({required this.label, required this.value, this.warn = false});

  final String label;
  final int value;
  final bool warn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: warn ? p.ink : p.sunken,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: warn ? p.onInk.withValues(alpha: .7) : p.muted, fontSize: 11)),
          const SizedBox(height: 6),
          Text(
            s.n(value),
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: warn ? p.onInk : p.ink),
          ),
        ],
      ),
    );
  }
}
