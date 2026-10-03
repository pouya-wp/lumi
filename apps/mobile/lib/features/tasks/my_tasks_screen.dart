import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';
import 'task_row.dart';

const _scopes = ['today', 'overdue', 'upcoming', 'open', 'done'];

class MyTasksScreen extends ConsumerStatefulWidget {
  const MyTasksScreen({super.key});

  @override
  ConsumerState<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends ConsumerState<MyTasksScreen> {
  String _scope = 'open';

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final tasks = ref.watch(myTasksProvider(_scope));

    return Scaffold(
      appBar: AppBar(title: Text(s.t('myTasks.title'))),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              children: [
                for (final sc in _scopes)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 6),
                    child: ChoiceChip(
                      label: Text(s.t('myTasks.$sc')),
                      selected: sc == _scope,
                      showCheckmark: false,
                      shape: const StadiumBorder(),
                      side: BorderSide(color: p.line),
                      selectedColor: p.ink,
                      backgroundColor: p.panel,
                      labelStyle: TextStyle(color: sc == _scope ? p.onInk : p.ink2),
                      onSelected: (_) => setState(() => _scope = sc),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: p.ink,
              onRefresh: () => ref.refresh(myTasksProvider(_scope).future),
              child: tasks.when(
                loading: () => const Loading(),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(myTasksProvider(_scope))),
                data: (list) => ListView(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 120),
                  children: [
                    Panel(
                      aurora: LumiColors.lumi,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: list.isEmpty
                          ? EmptyState(emoji: _scope == 'done' ? '🌱' : '🎉', text: s.t('dash.focusEmpty'))
                          : Column(children: [for (final t in list) TaskRow(task: t, showProject: true)]),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
