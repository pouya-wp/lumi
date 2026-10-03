import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

const _roles = ['ADMIN', 'MEMBER', 'GUEST', 'VIEWER'];

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  final _email = TextEditingController();
  String _role = 'MEMBER';
  bool _sending = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _invite() async {
    final s = ref.read(stringsProvider);
    final wid = ref.read(workspaceIdProvider);
    if (_email.text.trim().isEmpty) return;
    setState(() => _sending = true);
    try {
      final res = await ref.read(apiProvider).post<Map<String, dynamic>>('/workspaces/$wid/invites', {'email': _email.text.trim(), 'role': _role});
      _email.clear();
      ref.invalidate(membersProvider);
      ref.invalidate(dashboardProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t(res['status'] == 'added' ? 'team.added' : 'team.invited'))));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('⚠️  ${e.message}')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final session = ref.watch(sessionProvider).valueOrNull;
    final dash = ref.watch(dashboardProvider).valueOrNull;
    final members = ref.watch(membersProvider);
    final canManage = session?.workspace.role == 'OWNER' || session?.workspace.role == 'ADMIN';

    return Scaffold(
      appBar: AppBar(title: Text(s.t('team.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 40),
        children: [
          if (canManage)
            Panel(
              aurora: LumiColors.violet,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Sticker('✦ ${s.t('nav2.invite')}'),
                  const SizedBox(height: 14),
                  Text(s.t('team.inviteTitle'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(hintText: s.t('team.invitePlaceholder')),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _role,
                          items: [for (final r in _roles) DropdownMenuItem(value: r, child: Text(s.t('roles.$r')))],
                          onChanged: (v) => setState(() => _role = v ?? 'MEMBER'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(onPressed: _sending ? null : _invite, child: Text(s.t('team.sendInvite'))),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          members.when(
            loading: () => const Loading(),
            error: (e, _) => ErrorView(error: e),
            data: (list) => Column(
              children: [
                for (final m in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Panel(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          LumiAvatar(name: m.name, size: 44),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(m.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                Text(
                                  m.email,
                                  textDirection: TextDirection.ltr,
                                  style: TextStyle(fontSize: 12, color: p.muted),
                                ),
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 6,
                                  children: [
                                    Pill(s.t('roles.${m.role ?? 'MEMBER'}'), tone: PillTone.ink),
                                    if (dash != null)
                                      for (final t in dash.team.where((t) => t.id == m.id)) ...[
                                        Pill(s.t('dash.tasksOpen', {'n': t.open})),
                                        Pill('✓ ${s.n(t.doneThisWeek)}', tone: PillTone.success),
                                      ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
