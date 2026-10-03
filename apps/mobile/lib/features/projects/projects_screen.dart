import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

const _icons = ['🚀', '📱', '🎨', '🧠', '📈', '🛠️', '🎯', '📚'];

class ProjectsScreen extends ConsumerWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final projects = ref.watch(projectsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('nav2.projects')),
        actions: [IconButton(onPressed: () => _create(context, ref), icon: const Icon(Icons.add_rounded))],
      ),
      body: projects.when(
        loading: () => const Loading(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(projectsProvider)),
        data: (list) => GridView.builder(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 120),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: .95),
          itemCount: list.length,
          itemBuilder: (_, i) {
            final pr = list[i];
            final dark = i == 0;
            final pct = pr.total == 0 ? 0 : (pr.done / pr.total * 100).round();
            return GestureDetector(
              onTap: () => context.go('/projects/${pr.id}'),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: dark ? p.ink : p.panel,
                  borderRadius: BorderRadius.circular(LumiRadius.panel),
                  border: Border.all(color: p.line),
                  gradient: dark
                      ? null
                      : RadialGradient(
                          center: AlignmentDirectional.topEnd.resolve(Directionality.of(context)),
                          radius: 1.2,
                          colors: [LumiColors.parse(pr.color).withValues(alpha: .16), p.panel],
                        ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pr.icon ?? '◆', style: const TextStyle(fontSize: 30)),
                    const Spacer(),
                    Text(
                      pr.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontWeight: FontWeight.w700, color: dark ? p.onInk : p.ink),
                    ),
                    const SizedBox(height: 4),
                    Text(s.t('project.tasks', {'n': pr.total}), style: TextStyle(fontSize: 12, color: dark ? p.onInk.withValues(alpha: .6) : p.muted)),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(9),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        minHeight: 5,
                        color: LumiColors.success,
                        backgroundColor: dark ? p.onInk.withValues(alpha: .12) : p.sunken,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final s = ref.read(stringsProvider);
    final name = TextEditingController();
    var icon = _icons.first;
    final ok = await showModalBottomSheet<bool>(
      useRootNavigator: true,
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setState) => Padding(
          padding: EdgeInsets.fromLTRB(18, 0, 18, 18 + MediaQuery.viewInsetsOf(c).bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(s.t('project.new'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              TextField(
                controller: name,
                autofocus: true,
                decoration: InputDecoration(hintText: s.t('project.name')),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                children: [
                  for (final i in _icons)
                    ChoiceChip(
                      label: Text(i, style: const TextStyle(fontSize: 18)),
                      selected: i == icon,
                      showCheckmark: false,
                      onSelected: (_) => setState(() => icon = i),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('project.create'))),
            ],
          ),
        ),
      ),
    );
    if (ok != true || name.text.trim().isEmpty) return;
    final wid = ref.read(workspaceIdProvider);
    await ref.read(apiProvider).post('/workspaces/$wid/projects', {'name': name.text.trim(), 'icon': icon});
    ref.invalidate(projectsProvider);
  }
}
