import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

const _modes = {'FOCUS': 25, 'SHORT_BREAK': 5, 'LONG_BREAK': 15};

/// Pomodoro on the night canvas. Sessions live on the server, so a running timer survives app restarts
/// and focus minutes on a task are logged to its timesheet automatically.
class FocusScreen extends ConsumerStatefulWidget {
  const FocusScreen({super.key});

  @override
  ConsumerState<FocusScreen> createState() => _FocusScreenState();
}

class _FocusScreenState extends ConsumerState<FocusScreen> {
  String _mode = 'FOCUS';
  int _minutes = 25;
  Task? _task;
  String? _sessionId;
  DateTime? _startedAt;
  Timer? _ticker;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // Resume a session started earlier (here or on the web).
    ref.read(focusProvider.future).then((f) {
      if (!mounted || f.currentId == null) return;
      setState(() {
        _sessionId = f.currentId;
        _startedAt = f.currentStartedAt;
        _minutes = f.currentMinutes ?? 25;
        _mode = f.currentKind ?? 'FOCUS';
      });
      _tick();
    }).ignore();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Duration get _remaining {
    if (_startedAt == null) return Duration(minutes: _minutes);
    final left = Duration(minutes: _minutes) - DateTime.now().difference(_startedAt!);
    return left.isNegative ? Duration.zero : left;
  }

  void _tick() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_remaining == Duration.zero) {
        _finish(true);
      } else {
        setState(() {});
      }
    });
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      final res = await ref.read(apiProvider).post<Map<String, dynamic>>('/me/focus', {'minutes': _minutes, 'kind': _mode, 'taskId': ?_task?.id});
      HapticFeedback.mediumImpact();
      setState(() {
        _sessionId = res['id'] as String;
        _startedAt = DateTime.parse(res['startedAt'] as String).toLocal();
      });
      _tick();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish(bool completed) async {
    _ticker?.cancel();
    final id = _sessionId;
    setState(() {
      _sessionId = null;
      _startedAt = null;
    });
    if (id == null) return;
    await ref.read(apiProvider).post('/focus/$id/finish', {'completed': completed});
    ref.invalidate(focusProvider);
    ref.invalidate(gameProvider);
    if (completed && mounted) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ref.read(stringsProvider).t('mobile.focus.done'))));
    }
  }

  Future<void> _pickTask() async {
    final s = ref.read(stringsProvider);
    final tasks = await ref.read(myTasksProvider('open').future);
    if (!mounted) return;
    final picked = await showModalBottomSheet<Task?>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .6,
        builder: (_, controller) => ListView(
          controller: controller,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(s.t('mobile.focus.pickTask'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ),
            ListTile(leading: const Icon(Icons.block_rounded), title: Text(s.t('mobile.focus.noTask')), onTap: () => Navigator.pop(ctx)),
            for (final t in tasks.where((t) => t.status.category != 'DONE'))
              ListTile(leading: PriorityGlyph(t.priority), title: Text(t.title), subtitle: Text(t.projectName), onTap: () => Navigator.pop(ctx, t)),
          ],
        ),
      ),
    );
    setState(() => _task = picked);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final stats = ref.watch(focusProvider).valueOrNull;
    final running = _sessionId != null;
    final left = _remaining;
    final total = Duration(minutes: _minutes).inSeconds;
    final progress = running ? 1 - left.inSeconds / total : 0.0;
    final mm = left.inMinutes.toString().padLeft(2, '0');
    final ss = (left.inSeconds % 60).toString().padLeft(2, '0');
    final accent = _mode == 'FOCUS' ? LumiColors.warn : LumiColors.success;

    return Scaffold(
      backgroundColor: LumiColors.night1,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(
          s.t('mobile.focus.title'),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(center: Alignment(0, -.2), radius: 1.1, colors: [LumiColors.night2, LumiColors.night1]),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final e in _modes.entries)
                    _GlassPill(
                      label: s.t({'FOCUS': 'mobile.focus.focus', 'SHORT_BREAK': 'mobile.focus.short', 'LONG_BREAK': 'mobile.focus.long'}[e.key]!),
                      selected: _mode == e.key,
                      onTap: running ? null : () => setState(() => (_mode = e.key, _minutes = e.value)),
                    ),
                ],
              ),
              const Spacer(),
              SizedBox(
                width: 280,
                height: 280,
                child: CustomPaint(
                  painter: _RingPainter(progress: progress, color: accent),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          s.n('$mm:$ss'),
                          textDirection: TextDirection.ltr,
                          style: const TextStyle(color: Colors.white, fontSize: 64, fontWeight: FontWeight.w300, fontFeatures: [FontFeature.tabularFigures()]),
                        ),
                        if (!running)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                color: Colors.white54,
                                onPressed: _minutes > 5 ? () => setState(() => _minutes -= 5) : null,
                                icon: const Icon(Icons.remove_circle_outline_rounded),
                              ),
                              Text(s.t('mobile.focus.minutes', {'n': _minutes}), style: const TextStyle(color: Colors.white60)),
                              IconButton(
                                color: Colors.white54,
                                onPressed: _minutes < 120 ? () => setState(() => _minutes += 5) : null,
                                icon: const Icon(Icons.add_circle_outline_rounded),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              if (_mode == 'FOCUS')
                _GlassPill(
                  label: _task?.title ?? s.t('mobile.focus.pickTask'),
                  icon: Icons.task_alt_rounded,
                  selected: false,
                  onTap: running ? null : _pickTask,
                ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (running) ...[
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white30),
                        padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
                      ),
                      onPressed: () => _finish(false),
                      child: Text(s.t('mobile.focus.stop')),
                    ),
                    const SizedBox(width: 12),
                  ],
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: LumiColors.night1,
                      padding: const EdgeInsets.symmetric(horizontal: 34, vertical: 16),
                    ),
                    onPressed: _busy ? null : (running ? () => _finish(true) : _start),
                    icon: Icon(running ? Icons.check_rounded : Icons.play_arrow_rounded),
                    label: Text(running ? s.t('mobile.focus.finish') : s.t('mobile.focus.start'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              if (stats != null)
                Container(
                  margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .06),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      _Stat(s.t('mobile.focus.today'), s.t('mobile.focus.minutes', {'n': stats.todayMinutes})),
                      _Stat('🍅', s.t('mobile.focus.sessions', {'n': stats.todayCount})),
                      _Stat('🔥', s.t('mobile.focus.streak', {'n': stats.streak})),
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

class _GlassPill extends StatelessWidget {
  const _GlassPill({required this.label, required this.selected, this.onTap, this.icon});

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? LumiColors.night1 : Colors.white.withValues(alpha: onTap == null ? .45 : .85);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        constraints: const BoxConstraints(maxWidth: 280),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.white.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: selected ? Colors.white : Colors.white24),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 6)],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

/// Segmented progress ring with a glowing head.
class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 10;
    const segments = 60;
    for (var i = 0; i < segments; i++) {
      final a = -math.pi / 2 + i / segments * 2 * math.pi;
      final on = i / segments < progress;
      final paint = Paint()
        ..color = on ? color : Colors.white.withValues(alpha: .12)
        ..strokeWidth = i % 5 == 0 ? 4 : 2.5
        ..strokeCap = StrokeCap.round;
      final inner = r - (i % 5 == 0 ? 16 : 11);
      canvas.drawLine(c + Offset(math.cos(a) * inner, math.sin(a) * inner), c + Offset(math.cos(a) * r, math.sin(a) * r), paint);
    }
    if (progress > 0) {
      final a = -math.pi / 2 + progress * 2 * math.pi;
      final head = c + Offset(math.cos(a) * (r - 6), math.sin(a) * (r - 6));
      canvas.drawCircle(
        head,
        12,
        Paint()
          ..color = color.withValues(alpha: .35)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
      );
      canvas.drawCircle(head, 5, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}
