import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/task_actions.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';
import 'task_sheet.dart';

class TaskRow extends ConsumerWidget {
  const TaskRow({super.key, required this.task, this.showProject = false});

  final Task task;
  final bool showProject;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => showTask(context, task.id),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            CheckCircle(
              checked: task.isDone,
              onChanged: (_) async {
                final project = await ref.read(projectProvider(task.projectId).future);
                if (context.mounted) await ref.tasks(context).toggleDone(task, project.statuses);
              },
            ),
            const SizedBox(width: 6),
            PriorityGlyph(task.priority, size: 13),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, decoration: task.isDone ? TextDecoration.lineThrough : null, color: task.isDone ? p.muted : p.ink),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        task.key,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(fontSize: 11, color: p.muted),
                      ),
                      if (showProject) ...[Text('  ·  ${task.projectIcon ?? ''} ${task.projectName}', style: TextStyle(fontSize: 11, color: p.muted))],
                      if (task.proposalState == 'PROPOSED') ...[const SizedBox(width: 4), const Pulse(color: LumiColors.warn, size: 6)],
                    ],
                  ),
                ],
              ),
            ),
            DueChip(task.dueAt),
            const SizedBox(width: 6),
            AvatarStack(users: task.owners, size: 24, max: 2),
          ],
        ),
      ),
    );
  }
}
