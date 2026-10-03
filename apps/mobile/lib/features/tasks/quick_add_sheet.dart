import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/task_actions.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/quick_add.dart';
import '../../core/widgets/widgets.dart';
import 'task_sheet.dart';

Future<void> showQuickAdd(BuildContext context, {String? projectId, String? statusId}) {
  return showModalBottomSheet(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: _QuickAdd(projectId: projectId, statusId: statusId),
    ),
  );
}

/// Natural-language task creation with a live preview of what was understood.
class _QuickAdd extends ConsumerStatefulWidget {
  const _QuickAdd({this.projectId, this.statusId});

  final String? projectId;
  final String? statusId;

  @override
  ConsumerState<_QuickAdd> createState() => _QuickAddState();
}

class _QuickAddState extends ConsumerState<_QuickAdd> {
  final _c = TextEditingController();
  late String? _projectId = widget.projectId;
  bool _saving = false;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final projects = ref.watch(projectsProvider).valueOrNull ?? const <Project>[];
    final members = ref.watch(membersProvider).valueOrNull ?? const <UserBrief>[];
    final me = ref.watch(sessionProvider).valueOrNull?.user;
    final parsed = parseQuickAdd(_c.text);
    final assignees = [
      for (final m in parsed.mentions)
        ?members.where((u) => u.name.toLowerCase().startsWith(m.toLowerCase()) || u.email.toLowerCase().startsWith(m.toLowerCase())).firstOrNull,
    ];
    final project = projects.where((pr) => pr.id == _projectId).firstOrNull ?? projects.firstOrNull;

    Future<void> submit() async {
      final title = parsed.title.isNotEmpty ? parsed.title : _c.text.trim();
      if (title.isEmpty || project == null || _saving) return;
      setState(() => _saving = true);
      final task = await ref.tasks(context).create(project.id, {
        'title': title,
        'priority': ?parsed.priority,
        if (parsed.dueAt != null) 'dueAt': parsed.dueAt!.toUtc().toIso8601String(),
        'labelNames': parsed.labels,
        'assigneeIds': assignees.isNotEmpty ? assignees.map((a) => a.id).toList() : [?me?.id],
        if (project.id == widget.projectId) 'statusId': ?widget.statusId,
      });
      if (!context.mounted) return;
      Navigator.pop(context);
      if (task != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('✨  ${task.key} · ${task.title}')));
        showTask(context, task.id);
      }
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(shape: BoxShape.circle, color: LumiColors.lumi.withValues(alpha: .12)),
                child: const Icon(Icons.auto_awesome_rounded, color: LumiColors.lumi, size: 19),
              ),
              const SizedBox(width: 10),
              Text(s.t('task.new'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _c,
            autofocus: true,
            minLines: 1,
            maxLines: 3,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => submit(),
            decoration: InputDecoration(hintText: s.t('task.quickAddPlaceholder')),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (parsed.dueAt != null)
                Pill(
                  '${shortDate(parsed.dueAt!, s)}${parsed.dueAt!.hour != 23 ? ' · ${s.n('${parsed.dueAt!.hour}:${parsed.dueAt!.minute.toString().padLeft(2, '0')}')}' : ''}',
                  tone: PillTone.info,
                  icon: const Icon(Icons.event_outlined, size: 12, color: LumiColors.info),
                ),
              if (parsed.priority != null)
                Pill(
                  s.t('priority.${parsed.priority}'),
                  tone: parsed.priority == 'URGENT' ? PillTone.danger : PillTone.warn,
                  icon: PriorityGlyph(parsed.priority!, size: 11),
                ),
              for (final a in assignees)
                Pill(
                  a.name,
                  tone: PillTone.lumi,
                  icon: LumiAvatar(name: a.name, size: 14),
                ),
              for (final l in parsed.labels) Pill('#$l'),
              if (_c.text.isEmpty) Text('@ · # · ! · ${s.t('common.tomorrow')}', style: TextStyle(color: p.muted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: project?.id,
                  isExpanded: true,
                  items: [
                    for (final pr in projects)
                      DropdownMenuItem(
                        value: pr.id,
                        child: Text('${pr.icon ?? '◆'}  ${pr.name}', overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _projectId = v),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton(onPressed: _c.text.trim().isEmpty ? null : submit, child: Text(s.t('task.create'))),
            ],
          ),
        ],
      ),
    );
  }
}
