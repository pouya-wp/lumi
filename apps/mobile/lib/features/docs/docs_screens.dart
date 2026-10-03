import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data.dart';
import '../../core/models/collab.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/widgets.dart';
import '../tasks/task_sheet.dart';

/// Cover keys shared with the web (components/docs/covers.ts), approximated as two-stop gradients.
const _covers = {
  'aurora': [Color(0xFF4F5BFF), Color(0xFFF97316)],
  'sunset': [Color(0xFFFDBA74), Color(0xFFF43F5E)],
  'mint': [Color(0xFFA7F3D0), Color(0xFF0F766E)],
  'ink': [Color(0xFF0B0C0F), Color(0xFF23262F)],
  'lilac': [Color(0xFFA5B4FC), Color(0xFF4338CA)],
  'sand': [Color(0xFFFAF7F0), Color(0xFFEADBC8)],
};

class DocsScreen extends ConsumerWidget {
  const DocsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final docs = ref.watch(docsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('docs.title'))),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: () => ref.refresh(docsProvider.future),
        child: docs.when(
          loading: () => const Loading(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(docsProvider)),
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                children: [EmptyState(emoji: '✍️', text: s.t('docs.empty'))],
              );
            }
            final recent = [...list]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
            final meetings = list.where((d) => d.isMeeting && d.meetingAt != null).toList()..sort((a, b) => b.meetingAt!.compareTo(a.meetingAt!));
            final roots = list.where((d) => d.parentId == null && !d.isMeeting).toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 40),
              children: [
                SizedBox(
                  height: 132,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: recent.take(8).length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final d = recent[i];
                      return GestureDetector(
                        onTap: () => context.push('/docs/${d.id}'),
                        child: Container(
                          width: 150,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: i == 0 ? p.ink : p.panel,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: p.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(d.icon ?? '📄', style: const TextStyle(fontSize: 28)),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    d.title.isEmpty ? s.t('docs.untitled') : d.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontWeight: FontWeight.w700, color: i == 0 ? p.onInk : p.ink, height: 1.3),
                                  ),
                                  Text(timeAgo(d.updatedAt, s), style: TextStyle(fontSize: 11, color: (i == 0 ? p.onInk : p.muted).withValues(alpha: .7))),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (meetings.isNotEmpty) ...[
                  _Header(s.t('docs.meetings')),
                  Panel(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      children: [
                        for (final m in meetings.take(5))
                          ListTile(
                            onTap: () => context.push('/docs/${m.id}'),
                            leading: Text(m.icon ?? '🗓️', style: const TextStyle(fontSize: 22)),
                            title: Text(m.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(longDate(m.meetingAt!, s), style: TextStyle(fontSize: 12, color: p.muted)),
                          ),
                      ],
                    ),
                  ),
                ],
                _Header(s.t('docs.all')),
                Panel(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [for (final d in roots) _TreeNode(doc: d, all: list, depth: 0)],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(6, 18, 6, 8),
    child: Text(
      text,
      style: TextStyle(color: context.palette.muted, fontSize: 12, fontWeight: FontWeight.w600),
    ),
  );
}

class _TreeNode extends ConsumerStatefulWidget {
  const _TreeNode({required this.doc, required this.all, required this.depth});

  final DocBrief doc;
  final List<DocBrief> all;
  final int depth;

  @override
  ConsumerState<_TreeNode> createState() => _TreeNodeState();
}

class _TreeNodeState extends ConsumerState<_TreeNode> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final kids = widget.all.where((d) => d.parentId == widget.doc.id).toList();
    return Column(
      children: [
        InkWell(
          onTap: () => context.push('/docs/${widget.doc.id}'),
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(8.0 + widget.depth * 18, 10, 12, 10),
            child: Row(
              children: [
                SizedBox(
                  width: 28,
                  child: kids.isEmpty
                      ? null
                      : IconButton(
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          onPressed: () => setState(() => _open = !_open),
                          icon: AnimatedRotation(
                            turns: _open ? 0 : (Directionality.of(context) == TextDirection.rtl ? .25 : -.25),
                            duration: const Duration(milliseconds: 200),
                            child: Icon(Icons.expand_more_rounded, size: 18, color: p.muted),
                          ),
                        ),
                ),
                Text(widget.doc.icon ?? '📄', style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 10),
                Expanded(child: Text(widget.doc.title.isEmpty ? s.t('docs.untitled') : widget.doc.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (kids.isNotEmpty) Text(s.n(kids.length), style: TextStyle(fontSize: 11, color: p.muted)),
              ],
            ),
          ),
        ),
        if (_open)
          for (final k in kids) _TreeNode(doc: k, all: widget.all, depth: widget.depth + 1),
      ],
    );
  }
}

/// Read-only page: cover, icon, title, meeting details, rendered blocks and sub-pages.
class DocScreen extends ConsumerWidget {
  const DocScreen({super.key, required this.docId});

  final String docId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final doc = ref.watch(docProvider(docId));
    final members = ref.watch(membersProvider).valueOrNull ?? const <UserBrief>[];
    return Scaffold(
      body: doc.when(
        loading: () => const Loading(),
        error: (e, _) => Scaffold(
          appBar: AppBar(),
          body: ErrorView(error: e, onRetry: () => ref.invalidate(docProvider(docId))),
        ),
        data: (d) {
          final cover = _covers[d.cover];
          return RefreshIndicator(
            color: p.ink,
            onRefresh: () => ref.refresh(docProvider(docId).future),
            child: CustomScrollView(
              slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: cover == null ? null : 170,
                  backgroundColor: p.canvas,
                  foregroundColor: cover == null ? p.ink : Colors.white,
                  title: Text(d.breadcrumbs.isEmpty ? s.t('nav2.docs') : d.breadcrumbs.map((b) => b.title).join(' / '), style: const TextStyle(fontSize: 13)),
                  flexibleSpace: cover == null
                      ? null
                      : FlexibleSpaceBar(
                          background: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: cover),
                            ),
                          ),
                        ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 60),
                  sliver: SliverList.list(
                    children: [
                      Text(d.icon ?? '📄', style: const TextStyle(fontSize: 52)),
                      const SizedBox(height: 10),
                      Text(d.title.isEmpty ? s.t('docs.untitled') : d.title, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1.3)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.edit_note_rounded, size: 16, color: p.muted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(s.t('mobile.docs.readOnly'), style: TextStyle(fontSize: 11, color: p.muted)),
                          ),
                        ],
                      ),
                      if (d.isMeeting && d.meetingAt != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: p.sunken,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: p.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.event_rounded, size: 16),
                                  const SizedBox(width: 6),
                                  Text(longDate(d.meetingAt!, s), style: const TextStyle(fontWeight: FontWeight.w600)),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  for (final m in members.where((m) => d.attendeeIds.contains(m.id)))
                                    Chip(
                                      avatar: LumiAvatar(name: m.name, size: 22),
                                      label: Text(m.name),
                                      visualDensity: VisualDensity.compact,
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      DocBody(content: d.content, members: members),
                      if (d.children.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Divider(color: p.line),
                        Text(s.t('docs.subpages'), style: TextStyle(color: p.muted, fontSize: 12)),
                        for (final c in d.children)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Text(c.icon ?? '📄', style: const TextStyle(fontSize: 22)),
                            title: Text(c.title.isEmpty ? s.t('docs.untitled') : c.title),
                            onTap: () => context.push('/docs/${c.id}'),
                          ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

typedef _Node = Map<String, dynamic>;

/// Renders TipTap JSON (the web editor's format) as native widgets.
class DocBody extends ConsumerWidget {
  const DocBody({super.key, required this.content, required this.members});

  final Map<String, dynamic> content;
  final List<UserBrief> members;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final blocks = (content['content'] as List? ?? const []).cast<_Node>();
    if (blocks.isEmpty || (blocks.length == 1 && blocks.first['content'] == null)) {
      return EmptyState(emoji: '📝', text: s.t('mobile.docs.empty'));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final b in blocks) _block(context, b, 0)]);
  }

  List<_Node> _kids(_Node n) => (n['content'] as List? ?? const []).cast<_Node>();

  Widget _block(BuildContext context, _Node n, int depth) {
    final p = context.palette;
    final base = TextStyle(fontSize: 16, height: 1.85, color: p.ink);
    switch (n['type']) {
      case 'heading':
        final level = (n['attrs']?['level'] as int?) ?? 1;
        final size = {1: 26.0, 2: 21.0, 3: 18.0}[level] ?? 18.0;
        return Padding(
          padding: EdgeInsets.only(top: level == 1 ? 18 : 14, bottom: 4),
          child: _rich(context, n, base.copyWith(fontSize: size, fontWeight: FontWeight.w800, height: 1.4)),
        );
      case 'paragraph':
        return Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: _rich(context, n, base));
      case 'bulletList':
      case 'orderedList':
        final ordered = n['type'] == 'orderedList';
        final items = _kids(n);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < items.length; i++)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 26,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(ordered ? '${i + 1}.' : '•', style: base.copyWith(color: p.muted)),
                    ),
                  ),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final c in _kids(items[i])) _block(context, c, depth + 1)]),
                  ),
                ],
              ),
          ],
        );
      case 'taskList':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in _kids(n))
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 6, left: 2, right: 10),
                    child: Icon(
                      item['attrs']?['checked'] == true ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                      size: 20,
                      color: item['attrs']?['checked'] == true ? p.ink : p.muted,
                    ),
                  ),
                  Expanded(
                    child: Opacity(
                      opacity: item['attrs']?['checked'] == true ? .5 : 1,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final c in _kids(item)) _block(context, c, depth + 1)]),
                    ),
                  ),
                ],
              ),
          ],
        );
      case 'blockquote':
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsetsDirectional.only(start: 14),
          decoration: BoxDecoration(
            border: BorderDirectional(start: BorderSide(color: p.ink, width: 3)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final c in _kids(n)) _block(context, c, depth)]),
        );
      case 'callout':
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: p.sunken,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: p.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(n['attrs']?['emoji'] as String? ?? '💡', style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final c in _kids(n)) _block(context, c, depth)]),
              ),
            ],
          ),
        );
      case 'codeBlock':
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFF0B0C0F), borderRadius: BorderRadius.circular(14)),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Text(
              _kids(n).map((t) => t['text'] ?? '').join(),
              textDirection: TextDirection.ltr,
              style: const TextStyle(fontFamily: 'monospace', color: Color(0xFFE6E8EE), fontSize: 13, height: 1.6),
            ),
          ),
        );
      case 'horizontalRule':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Divider(color: p.line),
        );
      case 'table':
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: p.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              border: TableBorder.symmetric(inside: BorderSide(color: p.line)),
              children: [
                for (final row in _kids(n))
                  TableRow(
                    decoration: _kids(row).any((c) => c['type'] == 'tableHeader') ? BoxDecoration(color: p.sunken) : null,
                    children: [
                      for (final cell in _kids(row))
                        Container(
                          constraints: const BoxConstraints(minWidth: 90),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final c in _kids(cell)) _block(context, c, depth)]),
                        ),
                    ],
                  ),
              ],
            ),
          ),
        );
      default:
        final kids = _kids(n);
        if (kids.isEmpty) return const SizedBox.shrink();
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final c in kids) _block(context, c, depth)]);
    }
  }

  Widget _rich(BuildContext context, _Node n, TextStyle style) {
    final p = context.palette;
    final spans = <InlineSpan>[];
    for (final c in _kids(n)) {
      switch (c['type']) {
        case 'text':
          var st = style;
          String? href;
          for (final m in (c['marks'] as List? ?? const []).cast<_Node>()) {
            switch (m['type']) {
              case 'bold':
                st = st.copyWith(fontWeight: FontWeight.w800);
              case 'italic':
                st = st.copyWith(fontStyle: FontStyle.italic);
              case 'strike':
                st = st.copyWith(decoration: TextDecoration.lineThrough);
              case 'code':
                st = st.copyWith(fontFamily: 'monospace', backgroundColor: p.sunken, fontSize: (style.fontSize ?? 16) * .88);
              case 'highlight':
                st = st.copyWith(backgroundColor: const Color(0x73FACC15));
              case 'link':
                href = m['attrs']?['href'] as String?;
                st = st.copyWith(color: LumiColors.lumi, decoration: TextDecoration.underline);
            }
          }
          final link = href;
          spans.add(
            TextSpan(
              text: c['text'] as String? ?? '',
              style: st,
              recognizer: link == null
                  ? null
                  : (TapGestureRecognizer()
                      ..onTap = () {
                        final m = RegExp(r'/docs/([\w-]+)').firstMatch(link);
                        if (m != null) context.push('/docs/${m[1]}');
                      }),
            ),
          );
        case 'hardBreak':
          spans.add(const TextSpan(text: '\n'));
        case 'mention':
          spans.add(
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                decoration: BoxDecoration(color: LumiColors.lumi.withValues(alpha: .12), borderRadius: BorderRadius.circular(99)),
                child: Text(
                  '@${c['attrs']?['label'] ?? ''}',
                  style: style.copyWith(color: LumiColors.lumi, fontWeight: FontWeight.w600, fontSize: (style.fontSize ?? 16) * .9, height: 1.4),
                ),
              ),
            ),
          );
        case 'taskRef':
          final id = c['attrs']?['id'] as String?;
          spans.add(
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: _TaskChip(id: id, label: c['attrs']?['label'] as String? ?? '', fontSize: (style.fontSize ?? 16) * .85),
            ),
          );
      }
    }
    if (spans.isEmpty) return const SizedBox(height: 10);
    return Text.rich(TextSpan(children: spans), style: style);
  }
}

class _TaskChip extends ConsumerWidget {
  const _TaskChip({required this.id, required this.label, required this.fontSize});

  final String? id;
  final String label;
  final double fontSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    final Task? task = id == null ? null : ref.watch(taskProvider(id!)).valueOrNull;
    final done = task?.status.category == 'DONE';
    return GestureDetector(
      onTap: id == null ? null : () => showTask(context, id!),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: p.sunken,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: p.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (task != null) ...[StatusDot(task.status, size: 8), const SizedBox(width: 5)],
            Text(
              task?.title ?? label,
              style: TextStyle(fontSize: fontSize, decoration: done ? TextDecoration.lineThrough : null, color: done ? p.muted : p.ink),
            ),
          ],
        ),
      ),
    );
  }
}
