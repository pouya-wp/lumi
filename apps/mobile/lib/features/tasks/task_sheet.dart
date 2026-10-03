import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/task_actions.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/date_picker.dart';
import '../../core/widgets/widgets.dart';

const _priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

Future<void> showTask(BuildContext context, String taskId) {
  return showModalBottomSheet(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .92,
      minChildSize: .5,
      maxChildSize: 1,
      builder: (_, controller) => _TaskSheet(taskId: taskId, controller: controller),
    ),
  );
}

class _TaskSheet extends ConsumerWidget {
  const _TaskSheet({required this.taskId, required this.controller});

  final String taskId;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final taskAsync = ref.watch(taskProvider(taskId));

    return taskAsync.when(
      loading: () => const SizedBox(height: 300, child: Loading()),
      error: (e, _) => SizedBox(height: 300, child: ErrorView(error: e)),
      data: (task) {
        final project = ref.watch(projectProvider(task.projectId)).valueOrNull;
        final statuses = project?.statuses ?? const <Status>[];
        final actions = ref.tasks(context);

        return ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: LumiColors.parse(task.projectColor).withValues(alpha: .16), borderRadius: BorderRadius.circular(9)),
                  child: Text(task.projectIcon ?? '◆'),
                ),
                const SizedBox(width: 8),
                Text(task.projectName, style: TextStyle(color: p.muted)),
                Text(
                  '  /  ${task.key}',
                  textDirection: TextDirection.ltr,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        content: Text(s.t('task.deleteConfirm')),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s.t('common.cancel'))),
                          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('task.delete'))),
                        ],
                      ),
                    );
                    if (ok == true && context.mounted) {
                      await actions.remove(task);
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CheckCircle(checked: task.isDone, size: 26, onChanged: (_) => actions.toggleDone(task, statuses)),
                const SizedBox(width: 8),
                Expanded(
                  child: _TitleField(task: task, onSave: (title) => actions.update(task, {'title': title})),
                ),
              ],
            ),
            _ProposalBanner(task: task),
            const SizedBox(height: 18),
            _Prop(
              label: s.t('task.status'),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final st in statuses)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 6),
                        child: ChoiceChip(
                          label: Text(st.name),
                          avatar: StatusDot(st, size: 9),
                          selected: st.id == task.statusId,
                          showCheckmark: false,
                          shape: const StadiumBorder(),
                          side: BorderSide(color: p.line),
                          selectedColor: p.ink,
                          labelStyle: TextStyle(color: st.id == task.statusId ? p.onInk : p.ink2, fontSize: 12),
                          onSelected: (_) => actions.update(task, {'statusId': st.id}),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            _Prop(
              label: s.t('task.priority'),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final pr in _priorities)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 6),
                        child: ChoiceChip(
                          label: Text(s.t('priority.$pr')),
                          avatar: PriorityGlyph(pr, size: 12),
                          selected: pr == task.priority,
                          showCheckmark: false,
                          shape: const StadiumBorder(),
                          side: BorderSide(color: p.line),
                          selectedColor: p.ink,
                          labelStyle: TextStyle(color: pr == task.priority ? p.onInk : p.ink2, fontSize: 12),
                          onSelected: (_) => actions.update(task, {'priority': pr}),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            _Prop(
              label: s.t('task.assignees'),
              child: _Assignees(task: task),
            ),
            _Prop(
              label: s.t('task.due'),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: InkWell(
                  borderRadius: BorderRadius.circular(99),
                  onTap: () async {
                    final picked = await pickDate(context, s, initial: task.dueAt);
                    if (picked != null) await actions.update(task, {'dueAt': picked.toUtc().toIso8601String()});
                  },
                  child: DueChip(task.dueAt, compact: false),
                ),
              ),
            ),
            if (task.labels.isNotEmpty)
              _Prop(
                label: s.t('task.labels'),
                child: Wrap(spacing: 6, children: [for (final l in task.labels) LabelChip(l)]),
              ),
            _Section(title: s.t('task.description')),
            _DescriptionField(
              task: task,
              hint: s.t('task.descriptionPlaceholder'),
              onSave: (text) => actions.update(task, {
                'description': {'text': text},
              }),
            ),
            _Section(
              title: s.t('task.checklist'),
              trailing: task.checklistItems.isEmpty
                  ? null
                  : Text('${s.n(task.checklistItems.where((c) => c.done).length)}/${s.n(task.checklistItems.length)}', style: TextStyle(color: p.muted)),
            ),
            if (task.checklistItems.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: LinearProgressIndicator(
                    value: task.checklistItems.where((c) => c.done).length / task.checklistItems.length,
                    minHeight: 5,
                    color: LumiColors.success,
                    backgroundColor: p.sunken,
                  ),
                ),
              ),
            for (final item in task.checklistItems)
              Row(
                children: [
                  CheckCircle(checked: item.done, size: 20, onChanged: (_) => actions.toggleChecklist(task, item)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      item.text,
                      style: TextStyle(decoration: item.done ? TextDecoration.lineThrough : null, color: item.done ? p.muted : p.ink),
                    ),
                  ),
                ],
              ),
            _InlineAdd(hint: s.t('task.addItem'), icon: Icons.add_rounded, onSubmit: (text) => actions.addChecklist(task, text)),
            _Section(title: s.t('task.subtasks')),
            for (final sub in task.subtasks)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CheckCircle(checked: sub.isDone, size: 20, onChanged: (_) => actions.toggleDone(sub, statuses)),
                title: Text(sub.title, style: TextStyle(fontSize: 14, decoration: sub.isDone ? TextDecoration.lineThrough : null)),
                trailing: AvatarStack(users: sub.owners, size: 22),
                onTap: () => showTask(context, sub.id),
              ),
            _InlineAdd(
              hint: s.t('task.addSubtask'),
              icon: Icons.subdirectory_arrow_left_rounded,
              onSubmit: (title) =>
                  actions.create(task.projectId, {'title': title, 'parentId': task.id, 'assigneeIds': task.owners.map((o) => o.id).toList()}).then((_) {
                    ref.invalidate(taskProvider(task.id));
                  }),
            ),
            _Section(title: s.t('task.comments')),
            _Comments(task: task),
            if (task.createdBy != null && task.createdAt != null)
              Padding(
                padding: const EdgeInsets.only(top: 18),
                child: Text(
                  '${s.t('task.createdBy', {'name': task.createdBy!.name})} · ${shortDate(task.createdAt!, s)}',
                  style: TextStyle(color: p.muted, fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _TitleField extends StatefulWidget {
  const _TitleField({required this.task, required this.onSave});

  final Task task;
  final ValueChanged<String> onSave;

  @override
  State<_TitleField> createState() => _TitleFieldState();
}

class _TitleFieldState extends State<_TitleField> {
  late final _c = TextEditingController(text: widget.task.title);

  @override
  void didUpdateWidget(_TitleField old) {
    super.didUpdateWidget(old);
    if (old.task.title != widget.task.title) _c.text = widget.task.title;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      maxLines: null,
      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, decoration: widget.task.isDone ? TextDecoration.lineThrough : null),
      decoration: const InputDecoration(
        filled: false,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: EdgeInsets.only(top: 4),
      ),
      textInputAction: TextInputAction.done,
      onSubmitted: (v) {
        if (v.trim().isNotEmpty && v.trim() != widget.task.title) widget.onSave(v.trim());
      },
      onTapOutside: (_) {
        FocusScope.of(context).unfocus();
        if (_c.text.trim().isNotEmpty && _c.text.trim() != widget.task.title) widget.onSave(_c.text.trim());
      },
    );
  }
}

class _DescriptionField extends StatefulWidget {
  const _DescriptionField({required this.task, required this.hint, required this.onSave});

  final Task task;
  final String hint;
  final ValueChanged<String> onSave;

  @override
  State<_DescriptionField> createState() => _DescriptionFieldState();
}

class _DescriptionFieldState extends State<_DescriptionField> {
  late final _c = TextEditingController(text: widget.task.description ?? '');

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      minLines: 3,
      maxLines: 8,
      decoration: InputDecoration(hintText: widget.hint),
      onTapOutside: (_) {
        FocusScope.of(context).unfocus();
        if (_c.text != (widget.task.description ?? '')) widget.onSave(_c.text);
      },
    );
  }
}

class _Prop extends StatelessWidget {
  const _Prop({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 82,
            child: Text(label, style: TextStyle(color: context.palette.muted, fontSize: 13)),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class _InlineAdd extends StatefulWidget {
  const _InlineAdd({required this.hint, required this.icon, required this.onSubmit});

  final String hint;
  final IconData icon;
  final Future<void> Function(String) onSubmit;

  @override
  State<_InlineAdd> createState() => _InlineAddState();
}

class _InlineAddState extends State<_InlineAdd> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      decoration: InputDecoration(
        hintText: widget.hint,
        prefixIcon: Icon(widget.icon, size: 18, color: context.palette.muted),
        filled: false,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
      onSubmitted: (v) async {
        if (v.trim().isEmpty) return;
        await widget.onSubmit(v.trim());
        _c.clear();
      },
    );
  }
}

class _Assignees extends ConsumerWidget {
  const _Assignees({required this.task});

  final Task task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final owners = task.owners;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: () async {
          final members = await ref.read(membersProvider.future);
          if (!context.mounted) return;
          final selected = {...owners.map((o) => o.id)};
          final result = await showModalBottomSheet<Set<String>>(
            useRootNavigator: true,
            context: context,
            builder: (c) => StatefulBuilder(
              builder: (c, setState) => SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final m in members)
                      CheckboxListTile(
                        value: selected.contains(m.id),
                        onChanged: (v) => setState(() => v == true ? selected.add(m.id) : selected.remove(m.id)),
                        secondary: LumiAvatar(name: m.name, size: 32),
                        title: Text(m.name),
                      ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton(onPressed: () => Navigator.pop(c, selected), child: Text(s.t('common.save'))),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
          if (result != null && context.mounted) await ref.tasks(context).setAssignees(task, result.toList());
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (owners.isEmpty) Text(s.t('task.unassigned'), style: TextStyle(color: context.palette.muted)) else AvatarStack(users: owners, size: 28),
              if (owners.length == 1) ...[const SizedBox(width: 8), Text(owners.first.name)],
              const Icon(Icons.expand_more_rounded, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dark banner for open proposals: accept, counter with a date, or decline with a note.
class _ProposalBanner extends ConsumerWidget {
  const _ProposalBanner({required this.task});

  final Task task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final me = ref.watch(sessionProvider).valueOrNull?.user;
    final p = context.palette;
    if (me == null || task.proposalState == 'NONE' || task.proposalState == 'ACCEPTED') return const SizedBox.shrink();

    if (task.proposalState == 'DECLINED') {
      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: p.dangerSoft, borderRadius: BorderRadius.circular(18)),
        child: Text(
          '✕ ${s.t('task.declined')}${task.proposalNote != null ? ' — “${task.proposalNote}”' : ''}',
          style: const TextStyle(color: LumiColors.danger),
        ),
      );
    }

    final isAssignee = task.owners.any((o) => o.id == me.id);
    final isCreator = task.createdById == me.id;
    final members = ref.watch(membersProvider).valueOrNull ?? const [];
    final creator = members.where((m) => m.id == task.createdById).firstOrNull;
    final actions = ref.tasks(context);

    Future<String?> askNote() => showDialog<String>(
      context: context,
      builder: (c) {
        final ctrl = TextEditingController();
        return AlertDialog(
          content: TextField(
            controller: ctrl,
            autofocus: true,
            decoration: InputDecoration(hintText: s.t('task.declineReason')),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c), child: Text(s.t('common.cancel'))),
            FilledButton(onPressed: () => Navigator.pop(c, ctrl.text), child: Text(s.t('task.decline'))),
          ],
        );
      },
    );

    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: p.ink,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: LumiColors.lumi.withValues(alpha: .6)),
        boxShadow: [BoxShadow(color: LumiColors.lumi.withValues(alpha: .25), blurRadius: 24, spreadRadius: -8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Pulse(),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  isAssignee
                      ? s.t('task.proposalFor', {'name': creator?.name ?? ''})
                      : s.t('task.proposalWaiting', {'name': task.owners.map((o) => o.name).join('، ')}),
                  style: TextStyle(color: p.onInk),
                ),
              ),
            ],
          ),
          if (task.proposedDueAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                s.t('task.counterFrom', {'name': task.owners.firstOrNull?.name ?? '', 'date': longDate(task.proposedDueAt!, s)}),
                style: TextStyle(color: p.onInk.withValues(alpha: .7), fontSize: 12),
              ),
            ),
          const SizedBox(height: 12),
          if (isAssignee)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: p.onInk, foregroundColor: p.ink, minimumSize: const Size(0, 38)),
                  onPressed: () => actions.respond(task, 'accept'),
                  child: Text('✓ ${s.t('task.accept')}'),
                ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: p.onInk,
                    side: BorderSide(color: p.onInk.withValues(alpha: .3)),
                    shape: const StadiumBorder(),
                  ),
                  onPressed: () async {
                    final date = await pickDate(context, s, initial: task.dueAt);
                    if (date != null) await actions.respond(task, 'counter', dueAt: date);
                  },
                  icon: const Icon(Icons.event_outlined, size: 16),
                  label: Text(s.t('task.counter')),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: p.onInk.withValues(alpha: .7)),
                  onPressed: () async {
                    final note = await askNote();
                    if (note != null) await actions.respond(task, 'decline', note: note.isEmpty ? null : note);
                  },
                  child: Text(s.t('task.decline')),
                ),
              ],
            )
          else if (isCreator && task.proposedDueAt != null)
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: p.onInk, foregroundColor: p.ink, minimumSize: const Size(0, 38)),
              onPressed: () => actions.respond(task, 'accept'),
              child: Text('✓ ${s.t('task.acceptCounter')}'),
            ),
        ],
      ),
    );
  }
}

class _Comments extends ConsumerStatefulWidget {
  const _Comments({required this.task});

  final Task task;

  @override
  ConsumerState<_Comments> createState() => _CommentsState();
}

class _CommentsState extends ConsumerState<_Comments> {
  final _c = TextEditingController();
  final _mentions = <String>{};

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final comments = ref.watch(commentsProvider(widget.task.id)).valueOrNull ?? const [];
    final members = ref.watch(membersProvider).valueOrNull ?? const <UserBrief>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final c in comments)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LumiAvatar(name: c.author.name, size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: c.author.name,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            TextSpan(
                              text: '  ·  ${timeAgo(c.createdAt, s)}',
                              style: TextStyle(color: p.muted),
                            ),
                          ],
                        ),
                        style: const TextStyle(fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(14)),
                        child: Text(c.text, style: const TextStyle(fontSize: 14)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (members.isNotEmpty)
          Wrap(
            spacing: 6,
            children: [
              for (final m in members)
                ActionChip(
                  label: Text('@${m.name}', style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                  shape: const StadiumBorder(),
                  side: BorderSide(color: p.line),
                  onPressed: () {
                    _mentions.add(m.id);
                    _c.text = '${_c.text}@${m.name} ';
                  },
                ),
            ],
          ),
        const SizedBox(height: 6),
        TextField(
          controller: _c,
          minLines: 1,
          maxLines: 4,
          decoration: InputDecoration(
            hintText: s.t('task.commentPlaceholder'),
            suffixIcon: IconButton(
              icon: const Icon(Icons.send_rounded),
              onPressed: () async {
                final text = _c.text.trim();
                if (text.isEmpty) return;
                final mentionIds = _mentions.where((id) => members.any((m) => m.id == id && text.contains('@${m.name}'))).toList();
                await ref.tasks(context).comment(widget.task, text, mentionIds);
                _c.clear();
                _mentions.clear();
              },
            ),
          ),
        ),
      ],
    );
  }
}
