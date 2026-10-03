import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../core/data.dart';
import '../../core/models/collab.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/widgets.dart';
import '../tasks/task_sheet.dart';

const _quick = ['👍', '❤️', '🎉', '😂', '👀', '🔥'];

/// Channels and DMs with unread counts; tapping a teammate opens (or creates) the DM.
class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final me = ref.watch(sessionProvider).valueOrNull?.user.id ?? '';
    final channels = ref.watch(channelsProvider);
    final members = ref.watch(membersProvider).valueOrNull ?? const <UserBrief>[];

    Future<void> openDm(UserBrief m, List<Channel> list) async {
      final existing = list.where((c) => c.isDirect && c.members.any((x) => x.id == m.id)).firstOrNull;
      var id = existing?.id;
      if (id == null) {
        final wid = ref.read(workspaceIdProvider);
        final ch = await ref.read(apiProvider).post<Map<String, dynamic>>('/workspaces/$wid/dm', {'userId': m.id});
        id = ch['id'] as String;
        ref.invalidate(channelsProvider);
      }
      if (context.mounted) context.push('/chat/$id');
    }

    return Scaffold(
      appBar: AppBar(title: Text(s.t('chat.title'))),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: () => ref.refresh(channelsProvider.future),
        child: channels.when(
          loading: () => const Loading(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(channelsProvider)),
          data: (list) => ListView(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 40),
            children: [
              _Section(s.t('chat.channels')),
              Panel(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    for (final c in list.where((c) => !c.isDirect))
                      _ChannelTile(
                        leading: Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(14)),
                          child: Text(c.emoji ?? '#', style: const TextStyle(fontSize: 20)),
                        ),
                        title: '# ${c.name}',
                        subtitle: c.last?.deletedAt == null ? c.last?.text : null,
                        unread: c.unread,
                        onTap: () => context.push('/chat/${c.id}'),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _Section(s.t('chat.direct')),
              Panel(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    for (final m in members.where((m) => m.id != me))
                      Builder(
                        builder: (_) {
                          final dm = list.where((c) => c.isDirect && c.members.any((x) => x.id == m.id)).firstOrNull;
                          return _ChannelTile(
                            leading: LumiAvatar(name: m.name, size: 42),
                            title: m.name,
                            subtitle: dm?.last?.deletedAt == null ? dm?.last?.text : null,
                            unread: dm?.unread ?? 0,
                            onTap: () => openDm(m, list),
                          );
                        },
                      ),
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

class _Section extends StatelessWidget {
  const _Section(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
    child: Text(
      label,
      style: TextStyle(color: context.palette.muted, fontSize: 12, fontWeight: FontWeight.w600),
    ),
  );
}

class _ChannelTile extends ConsumerWidget {
  const _ChannelTile({required this.leading, required this.title, this.subtitle, required this.unread, required this.onTap});

  final Widget leading;
  final String title;
  final String? subtitle;
  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    return ListTile(
      onTap: onTap,
      leading: leading,
      title: Text(title, style: TextStyle(fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w500)),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: p.muted, fontSize: 12),
            ),
      trailing: unread > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: LumiColors.lumi, borderRadius: BorderRadius.circular(99)),
              child: Text(
                s.n(unread),
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
              ),
            )
          : null,
    );
  }
}

/// A channel conversation, or a thread when [parentId] is set.
class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({super.key, required this.channelId, this.parentId});

  final String channelId;
  final String? parentId;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _text = TextEditingController();
  bool _sending = false;

  bool get _thread => widget.parentId != null;

  @override
  void initState() {
    super.initState();
    _markRead();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _markRead() {
    ref.read(apiProvider).post('/channels/${widget.channelId}/read').then((_) => ref.invalidate(channelsProvider)).ignore();
  }

  void _refresh() {
    ref.invalidate(messagesProvider(widget.channelId));
    if (_thread) ref.invalidate(threadProvider(widget.parentId!));
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final members = ref.read(membersProvider).valueOrNull ?? const <UserBrief>[];
      await ref.read(apiProvider).post('/channels/${widget.channelId}/messages', {
        'text': text,
        'mentionIds': [
          for (final m in members)
            if (text.contains('@${m.name}')) m.id,
        ],
        'parentId': ?widget.parentId,
      });
      _text.clear();
      _refresh();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _actions(ChatMessage m) async {
    final s = ref.read(stringsProvider);
    final me = ref.read(sessionProvider).valueOrNull?.user.id;
    final api = ref.read(apiProvider);
    final choice = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final e in _quick)
                    InkWell(
                      borderRadius: BorderRadius.circular(99),
                      onTap: () => Navigator.pop(ctx, 'react:$e'),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(e, style: const TextStyle(fontSize: 26)),
                      ),
                    ),
                ],
              ),
            ),
            if (!_thread) ListTile(leading: const Icon(Icons.forum_outlined), title: Text(s.t('chat.thread')), onTap: () => Navigator.pop(ctx, 'thread')),
            if (m.taskId == null)
              ListTile(leading: const Icon(Icons.task_alt_rounded), title: Text(s.t('chat.toTask')), onTap: () => Navigator.pop(ctx, 'task')),
            if (m.author.id == me)
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: LumiColors.danger),
                title: Text(s.t('chat.delete'), style: const TextStyle(color: LumiColors.danger)),
                onTap: () => Navigator.pop(ctx, 'delete'),
              ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;
    if (choice.startsWith('react:')) {
      await api.post('/messages/${m.id}/react', {'emoji': choice.substring(6)});
    } else if (choice == 'thread') {
      if (mounted) context.push('/chat/${widget.channelId}/thread/${m.id}');
    } else if (choice == 'delete') {
      await api.delete('/messages/${m.id}');
    } else if (choice == 'task') {
      final projects = await ref.read(projectsProvider.future);
      if (projects.isEmpty || !mounted) return;
      final pid = projects.length == 1
          ? projects.first.id
          : await showModalBottomSheet<String>(
              context: context,
              useRootNavigator: true,
              builder: (ctx) => SafeArea(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(s.t('docs.pickProject'), style: const TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    for (final p in projects)
                      ListTile(
                        leading: Text(p.icon ?? '◆', style: const TextStyle(fontSize: 20)),
                        title: Text(p.name),
                        onTap: () => Navigator.pop(ctx, p.id),
                      ),
                  ],
                ),
              ),
            );
      if (pid == null) return;
      final task = await api.post<Map<String, dynamic>>('/messages/${m.id}/to-task', {'projectId': pid});
      if (mounted) showTask(context, task['id'] as String);
    }
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final me = ref.watch(sessionProvider).valueOrNull?.user.id ?? '';
    final channel = ref.watch(channelsProvider).valueOrNull?.where((c) => c.id == widget.channelId).firstOrNull;
    final messages = _thread ? ref.watch(threadProvider(widget.parentId!)) : ref.watch(messagesProvider(widget.channelId));
    final title = _thread ? s.t('chat.thread') : (channel == null ? '' : (channel.isDirect ? channel.title(me) : '# ${channel.name}'));
    ref.listen(messagesProvider(widget.channelId), (_, __) => _markRead());

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            if (!_thread && channel?.topic != null) Text(channel!.topic!, style: TextStyle(fontSize: 11, color: p.muted)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messages.when(
              loading: () => const Loading(),
              error: (e, _) => ErrorView(error: e, onRetry: _refresh),
              data: (list) {
                if (list.isEmpty) return EmptyState(emoji: '👋', text: s.t('chat.empty'));
                final items = list.reversed.toList();
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final m = items[i];
                    final older = i + 1 < items.length ? items[i + 1] : null;
                    final newDay = older == null || !DateUtils.isSameDay(older.createdAt, m.createdAt);
                    final grouped = !newDay && older.author.id == m.author.id && m.createdAt.difference(older.createdAt).inMinutes < 5;
                    return Column(
                      children: [
                        if (newDay) _DayDivider(m.createdAt),
                        _Bubble(
                          message: m,
                          mine: m.author.id == me,
                          grouped: grouped,
                          showThread: !_thread,
                          onLongPress: () => _actions(m),
                          onThread: () => context.push('/chat/${widget.channelId}/thread/${m.id}'),
                          onReact: (e) async {
                            await ref.read(apiProvider).post('/messages/${m.id}/react', {'emoji': e});
                            _refresh();
                          },
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: p.panel,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: p.line),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.newline,
                        decoration: InputDecoration(
                          hintText: _thread ? s.t('chat.reply') : s.t('chat.placeholder', {'name': title}),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                      ),
                    ),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: p.ink, foregroundColor: p.onInk),
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.send_rounded, size: 20, textDirection: TextDirection.ltr),
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

class _DayDivider extends ConsumerWidget {
  const _DayDivider(this.date);

  final DateTime date;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final today = DateUtils.isSameDay(date, DateTime.now());
    final yesterday = DateUtils.isSameDay(date, DateTime.now().subtract(const Duration(days: 1)));
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(child: Divider(color: p.line)),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: p.line),
            ),
            child: Text(today ? s.t('chat.today') : (yesterday ? s.t('chat.yesterday') : longDate(date, s)), style: TextStyle(fontSize: 11, color: p.muted)),
          ),
          Expanded(child: Divider(color: p.line)),
        ],
      ),
    );
  }
}

class _Bubble extends ConsumerWidget {
  const _Bubble({
    required this.message,
    required this.mine,
    required this.grouped,
    required this.showThread,
    required this.onLongPress,
    required this.onThread,
    required this.onReact,
  });

  final ChatMessage message;
  final bool mine;
  final bool grouped;
  final bool showThread;
  final VoidCallback onLongPress;
  final VoidCallback onThread;
  final void Function(String emoji) onReact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final me = ref.watch(sessionProvider).valueOrNull?.user.id;
    final m = message;
    final time = s.n(DateFormat.Hm().format(m.createdAt));

    if (m.deletedAt != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 48),
        child: Align(
          alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
          child: Text(
            s.t('chat.deleted'),
            style: TextStyle(color: p.muted, fontStyle: FontStyle.italic, fontSize: 12),
          ),
        ),
      );
    }

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .74),
      padding: const EdgeInsets.fromLTRB(14, 9, 14, 8),
      decoration: BoxDecoration(
        color: mine ? p.ink : p.panel,
        border: mine ? null : Border.all(color: p.line),
        borderRadius: BorderRadiusDirectional.only(
          topStart: const Radius.circular(20),
          topEnd: const Radius.circular(20),
          bottomStart: Radius.circular(mine ? 20 : 6),
          bottomEnd: Radius.circular(mine ? 6 : 20),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!mine && !grouped)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                m.author.name,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: LumiColors.lumi),
              ),
            ),
          Text(m.text, style: TextStyle(color: mine ? p.onInk : p.ink, height: 1.55)),
          const SizedBox(height: 2),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (m.editedAt != null) Text('${s.t('chat.edited')} · ', style: TextStyle(fontSize: 10, color: (mine ? p.onInk : p.muted).withValues(alpha: .6))),
              Text(time, style: TextStyle(fontSize: 10, color: (mine ? p.onInk : p.muted).withValues(alpha: .6))),
            ],
          ),
        ],
      ),
    );

    return Padding(
      padding: EdgeInsets.only(top: grouped ? 3 : 10),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) SizedBox(width: 34, child: grouped ? null : LumiAvatar(name: m.author.name, size: 30)),
          if (!mine) const SizedBox(width: 6),
          Flexible(
            child: Column(
              crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                GestureDetector(onLongPress: onLongPress, child: bubble),
                if (m.taskId != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: GestureDetector(
                      onTap: () => showTask(context, m.taskId!),
                      child: Pill(
                        s.t('chat.linkedTask'),
                        tone: PillTone.success,
                        icon: const Icon(Icons.task_alt_rounded, size: 13, color: LumiColors.success),
                      ),
                    ),
                  ),
                if (m.reactions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        for (final e in m.reactions.entries)
                          GestureDetector(
                            onTap: () => onReact(e.key),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: e.value.contains(me) ? LumiColors.lumi.withValues(alpha: .12) : p.sunken,
                                borderRadius: BorderRadius.circular(99),
                                border: Border.all(color: e.value.contains(me) ? LumiColors.lumi : p.line),
                              ),
                              child: Text('${e.key} ${s.n(e.value.length)}', style: const TextStyle(fontSize: 12)),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (showThread && m.replyCount > 0)
                  TextButton.icon(
                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact, foregroundColor: LumiColors.lumi),
                    onPressed: onThread,
                    icon: const Icon(Icons.forum_outlined, size: 15),
                    label: Text(s.t('chat.replies', {'n': m.replyCount}), style: const TextStyle(fontSize: 12)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
