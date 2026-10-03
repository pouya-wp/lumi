import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

class _Msg {
  const _Msg(this.role, this.content);

  final String role;
  final String content;
}

/// Conversational assistant grounded in the workspace (POST /workspaces/:id/ai/chat).
class AiScreen extends ConsumerStatefulWidget {
  const AiScreen({super.key});

  @override
  ConsumerState<AiScreen> createState() => _AiScreenState();
}

class _AiScreenState extends ConsumerState<AiScreen> {
  final _messages = <_Msg>[];
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _thinking = false;

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _ask(String q) async {
    final text = q.trim();
    if (text.isEmpty || _thinking) return;
    setState(() {
      _messages.add(_Msg('user', text));
      _thinking = true;
    });
    _text.clear();
    try {
      final wid = ref.read(workspaceIdProvider);
      final res = await ref.read(apiProvider).post<Map<String, dynamic>>('/workspaces/$wid/ai/chat', {
        'messages': [
          for (final m in _messages) {'role': m.role, 'content': m.content},
        ],
      });
      _messages.add(_Msg('assistant', res['reply'] as String? ?? ''));
    } catch (e) {
      _messages.add(_Msg('assistant', '⚠️ $e'));
    } finally {
      if (mounted) setState(() => _thinking = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      });
    }
  }

  Future<void> _standup() async {
    setState(() => _thinking = true);
    try {
      final wid = ref.read(workspaceIdProvider);
      final res = await ref.read(apiProvider).post<Map<String, dynamic>>('/workspaces/$wid/ai/standup');
      setState(() => _messages.add(_Msg('assistant', res['text'] as String? ?? '')));
    } finally {
      if (mounted) setState(() => _thinking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final enabled = ref.watch(aiStatusProvider).valueOrNull ?? true;
    final suggestions = (s.raw('mobile.ai.suggest') as List?)?.cast<String>() ?? const <String>[];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [LumiColors.lumi, LumiColors.warn]),
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 17),
            ),
            const SizedBox(width: 10),
            Text(s.t('mobile.ai.title')),
          ],
        ),
        actions: [TextButton.icon(onPressed: _thinking ? null : _standup, icon: const Text('🌅'), label: Text(s.t('mobile.ai.standup')))],
      ),
      body: Column(
        children: [
          if (!enabled)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: p.warnSoft, borderRadius: BorderRadius.circular(14)),
              child: Text(s.t('mobile.ai.off'), style: const TextStyle(color: LumiColors.warn)),
            ),
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 16),
              children: [
                _Bubble(role: 'assistant', text: s.t('mobile.ai.hello')),
                if (_messages.isEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final q in suggestions)
                        ActionChip(
                          label: Text(q),
                          onPressed: () => _ask(q),
                          backgroundColor: p.panel,
                          side: BorderSide(color: p.line),
                        ),
                    ],
                  ),
                ],
                for (final m in _messages) _Bubble(role: m.role, text: m.content),
                if (_thinking)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Align(alignment: AlignmentDirectional.centerStart, child: Pulse(size: 10)),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: p.panel,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: p.line),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        minLines: 1,
                        maxLines: 4,
                        onSubmitted: _ask,
                        decoration: InputDecoration(
                          hintText: s.t('mobile.ai.placeholder'),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                      ),
                    ),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: LumiColors.lumi, foregroundColor: Colors.white),
                      onPressed: _thinking ? null : () => _ask(_text.text),
                      icon: const Icon(Icons.arrow_upward_rounded),
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.role, required this.text});

  final String role;
  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final mine = role == 'user';
    return Align(
      alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .82),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: mine ? p.ink : p.panel,
          border: mine ? null : Border.all(color: p.line),
          borderRadius: BorderRadius.circular(20),
        ),
        child: SelectableText(text, style: TextStyle(color: mine ? p.onInk : p.ink, height: 1.65)),
      ),
    );
  }
}
