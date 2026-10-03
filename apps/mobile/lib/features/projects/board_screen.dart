import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/task_actions.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';
import '../tasks/quick_add_sheet.dart';
import '../tasks/task_row.dart';
import '../tasks/task_sheet.dart';

/// Kanban as swipeable columns; long-press a card to drag it onto another card or column.
class BoardScreen extends ConsumerStatefulWidget {
  const BoardScreen({super.key, required this.projectId});

  final String projectId;

  @override
  ConsumerState<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends ConsumerState<BoardScreen> {
  final _pages = PageController(viewportFraction: .86);
  bool _list = false;
  Timer? _edgeTimer;

  @override
  void dispose() {
    _edgeTimer?.cancel();
    _pages.dispose();
    super.dispose();
  }

  /// Flips pages when a dragged card nears the screen edge.
  void _onDragUpdate(DragUpdateDetails d) {
    final width = MediaQuery.sizeOf(context).width;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final x = d.globalPosition.dx;
    int? dir;
    if (x < 40) dir = rtl ? 1 : -1;
    if (x > width - 40) dir = rtl ? -1 : 1;
    if (dir == null) {
      _edgeTimer?.cancel();
      _edgeTimer = null;
      return;
    }
    _edgeTimer ??= Timer(const Duration(milliseconds: 450), () {
      _edgeTimer = null;
      final page = (_pages.page ?? 0).round() + dir!;
      _pages.animateToPage(page, duration: const Duration(milliseconds: 300), curve: Curves.easeOutCubic);
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final project = ref.watch(projectProvider(widget.projectId));
    final tasks = ref.watch(projectTasksProvider(widget.projectId));

    return Scaffold(
      appBar: AppBar(
        title: project.maybeWhen(data: (pr) => Text('${pr.icon ?? ''}  ${pr.name}'), orElse: () => const SizedBox.shrink()),
        actions: [
          IconButton(
            tooltip: s.t(_list ? 'views.board' : 'views.list'),
            onPressed: () => setState(() => _list = !_list),
            icon: Icon(_list ? Icons.view_kanban_outlined : Icons.view_list_rounded),
          ),
          IconButton(
            onPressed: () => showQuickAdd(context, projectId: widget.projectId),
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: switch ((project, tasks)) {
        (AsyncData(value: final pr), AsyncData(value: final list)) => RefreshIndicator(
          color: p.ink,
          onRefresh: () => ref.refresh(projectTasksProvider(widget.projectId).future),
          child: _list ? _ListView(project: pr, tasks: list) : _board(pr, list),
        ),
        (AsyncError(:final error), _) || (_, AsyncError(:final error)) => ErrorView(error: error),
        _ => const Loading(),
      },
    );
  }

  bool _positioned = false;

  Widget _board(Project project, List<Task> tasks) {
    // Open on the first column that has work, once.
    if (!_positioned) {
      _positioned = true;
      final first = project.statuses.indexWhere((st) => tasks.any((t) => t.statusId == st.id));
      if (first > 0) WidgetsBinding.instance.addPostFrameCallback((_) => _pages.hasClients ? _pages.jumpToPage(first) : null);
    }
    return PageView.builder(
      controller: _pages,
      padEnds: false,
      itemCount: project.statuses.length,
      itemBuilder: (_, i) {
        final status = project.statuses[i];
        final items = tasks.where((t) => t.statusId == status.id).toList()..sort((a, b) => a.orderKey.compareTo(b.orderKey));
        return Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 4, 0, 110),
          child: _Column(projectId: project.id, status: status, tasks: items, onDragUpdate: _onDragUpdate),
        );
      },
    );
  }
}

class _Column extends ConsumerWidget {
  const _Column({required this.projectId, required this.status, required this.tasks, required this.onDragUpdate});

  final String projectId;
  final Status status;
  final List<Task> tasks;
  final ValueChanged<DragUpdateDetails> onDragUpdate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;

    return DragTarget<Task>(
      onWillAcceptWithDetails: (d) => true,
      onAcceptWithDetails: (d) {
        if (d.data.statusId == status.id && tasks.lastOrNull?.id == d.data.id) return;
        HapticFeedback.mediumImpact();
        ref.tasks(context).move(d.data, status.id, beforeId: tasks.where((t) => t.id != d.data.id).lastOrNull?.id);
      },
      builder: (context, candidates, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: candidates.isNotEmpty ? LumiColors.lumi.withValues(alpha: .06) : p.sunken,
          borderRadius: BorderRadius.circular(LumiRadius.panel),
          border: Border.all(color: candidates.isNotEmpty ? LumiColors.lumi.withValues(alpha: .5) : p.line, width: candidates.isNotEmpty ? 1.5 : 1),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 8, 4),
              child: Row(
                children: [
                  StatusDot(status),
                  const SizedBox(width: 8),
                  Text(status.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  Pill(s.n(tasks.length)),
                  const Spacer(),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.add_rounded, size: 20),
                    onPressed: () => showQuickAdd(context, projectId: projectId, statusId: status.id),
                  ),
                ],
              ),
            ),
            Expanded(
              child: tasks.isEmpty
                  ? Center(
                      child: Text(s.t('task.dropHere'), style: TextStyle(color: p.muted)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
                      itemCount: tasks.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _DraggableCard(task: tasks[i], status: status, onDragUpdate: onDragUpdate),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DraggableCard extends ConsumerWidget {
  const _DraggableCard({required this.task, required this.status, required this.onDragUpdate});

  final Task task;
  final Status status;
  final ValueChanged<DragUpdateDetails> onDragUpdate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width * .78;
    return DragTarget<Task>(
      onWillAcceptWithDetails: (d) => d.data.id != task.id,
      onAcceptWithDetails: (d) {
        HapticFeedback.mediumImpact();
        ref.tasks(context).move(d.data, status.id, afterId: task.id);
      },
      builder: (context, candidates, _) => Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: candidates.isNotEmpty ? 6 : 0,
            margin: EdgeInsets.only(bottom: candidates.isNotEmpty ? 6 : 0),
            decoration: BoxDecoration(color: LumiColors.lumi, borderRadius: BorderRadius.circular(9)),
          ),
          LongPressDraggable<Task>(
            data: task,
            onDragStarted: HapticFeedback.selectionClick,
            onDragUpdate: onDragUpdate,
            feedback: Material(
              color: Colors.transparent,
              child: Transform.rotate(
                angle: .035,
                child: SizedBox(
                  width: width,
                  child: TaskCard(task: task, lifted: true),
                ),
              ),
            ),
            childWhenDragging: Opacity(opacity: .35, child: TaskCard(task: task)),
            child: GestureDetector(
              onTap: () => showTask(context, task.id),
              child: TaskCard(task: task),
            ),
          ),
        ],
      ),
    );
  }
}

class TaskCard extends ConsumerWidget {
  const TaskCard({super.key, required this.task, this.lifted = false});

  final Task task;
  final bool lifted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: task.proposalState == 'PROPOSED' ? LumiColors.warn.withValues(alpha: .6) : p.line),
        boxShadow: lifted ? [BoxShadow(color: Colors.black.withValues(alpha: .25), blurRadius: 30, offset: const Offset(0, 16), spreadRadius: -10)] : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PriorityGlyph(task.priority, size: 12),
              const SizedBox(width: 6),
              Text(
                task.key,
                textDirection: TextDirection.ltr,
                style: TextStyle(color: p.muted, fontSize: 11),
              ),
              const Spacer(),
              if (task.status.category == 'IN_PROGRESS') const Pulse(size: 6),
              if (task.proposalState == 'PROPOSED') const Sticker('✦', angle: -8),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            task.title,
            style: TextStyle(
              fontWeight: FontWeight.w500,
              height: 1.5,
              decoration: task.isDone ? TextDecoration.lineThrough : null,
              color: task.isDone ? p.muted : p.ink,
            ),
          ),
          if (task.labels.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 4, runSpacing: 4, children: [for (final l in task.labels) LabelChip(l)]),
          ],
          if (task.checklistTotal > 0) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: LinearProgressIndicator(
                value: task.checklistDone / task.checklistTotal,
                minHeight: 3,
                color: LumiColors.success,
                backgroundColor: p.sunken,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              DueChip(task.dueAt),
              if (task.comments > 0) ...[
                const SizedBox(width: 8),
                Icon(Icons.chat_bubble_outline_rounded, size: 13, color: p.muted),
                const SizedBox(width: 3),
                Text(s.n(task.comments), style: TextStyle(fontSize: 11, color: p.muted)),
              ],
              const Spacer(),
              AvatarStack(users: task.owners, size: 22, max: 2),
            ],
          ),
        ],
      ),
    );
  }
}

class _ListView extends StatelessWidget {
  const _ListView({required this.project, required this.tasks});

  final Project project;
  final List<Task> tasks;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 120),
      children: [
        for (final st in project.statuses) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
            child: Row(
              children: [
                StatusDot(st),
                const SizedBox(width: 8),
                Text(st.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            child: Column(children: [for (final t in tasks.where((t) => t.statusId == st.id)) TaskRow(task: t)]),
          ),
        ],
      ],
    );
  }
}
