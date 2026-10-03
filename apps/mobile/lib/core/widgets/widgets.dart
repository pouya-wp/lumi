import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/strings.dart';
import '../models/models.dart';
import '../providers.dart';
import '../theme/lumi_colors.dart';
import '../utils/dates.dart';

/// White panel on the canvas with a hairline border and an optional aurora bloom in one corner.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.aurora, this.aurora2, this.onTap});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? aurora;
  final Color? aurora2;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: p.panel,
        borderRadius: BorderRadius.circular(LumiRadius.panel),
        border: Border.all(color: p.line),
        boxShadow: dark ? null : [BoxShadow(color: Colors.black.withValues(alpha: .05), blurRadius: 24, offset: const Offset(0, 10), spreadRadius: -14)],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: [
              if (aurora != null)
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: AlignmentDirectional.topEnd.resolve(Directionality.of(context)),
                        radius: 1.1,
                        colors: [aurora!.withValues(alpha: .14), aurora!.withValues(alpha: 0)],
                      ),
                    ),
                  ),
                ),
              if (aurora2 != null)
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: AlignmentDirectional.topStart.resolve(Directionality.of(context)),
                        radius: .9,
                        colors: [aurora2!.withValues(alpha: .10), aurora2!.withValues(alpha: 0)],
                      ),
                    ),
                  ),
                ),
              Padding(padding: padding, child: child),
            ],
          ),
        ),
      ),
    );
  }
}

class PanelHeader extends StatelessWidget {
  const PanelHeader({super.key, required this.icon, required this.title, this.trailing});

  final IconData icon;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: p.line),
            color: p.panel,
          ),
          child: Icon(icon, size: 17, color: p.ink2),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        ),
        ?trailing,
      ],
    );
  }
}

enum PillTone { neutral, success, warn, danger, info, ink, lumi }

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.tone = PillTone.neutral, this.icon});

  final String label;
  final PillTone tone;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (bg, fg) = switch (tone) {
      PillTone.success => (p.successSoft, LumiColors.success),
      PillTone.warn => (p.warnSoft, LumiColors.warn),
      PillTone.danger => (p.dangerSoft, LumiColors.danger),
      PillTone.info => (p.infoSoft, LumiColors.info),
      PillTone.ink => (p.ink, p.onInk),
      PillTone.lumi => (LumiColors.lumi.withValues(alpha: .12), LumiColors.lumi),
      PillTone.neutral => (p.sunken, p.ink2),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[icon!, const SizedBox(width: 4)],
          Text(
            label,
            style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

class Delta extends ConsumerWidget {
  const Delta(this.value, {super.key});

  final int value;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Pill('${value >= 0 ? '+' : ''}${s.n(value)}%', tone: value >= 0 ? PillTone.success : PillTone.warn),
    );
  }
}

const _avatarHues = [Color(0xFF4F5BFF), Color(0xFFF43F5E), Color(0xFF16A34A), Color(0xFFF97316), Color(0xFF8B5CF6), Color(0xFF0EA5E9), Color(0xFFEAB308)];

class LumiAvatar extends StatelessWidget {
  const LumiAvatar({super.key, required this.name, this.size = 28, this.ring = false});

  final String name;
  final double size;
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final hue = _avatarHues[name.runes.fold<int>(0, (a, c) => a + c) % _avatarHues.length];
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => String.fromCharCode(w.runes.first)).join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(colors: [hue, Color.lerp(hue, Colors.black, .4)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
        border: ring ? Border.all(color: context.palette.panel, width: 2) : null,
      ),
      child: Text(
        initials,
        style: TextStyle(color: Colors.white, fontSize: size * .38, fontWeight: FontWeight.w600, height: 1),
      ),
    );
  }
}

class AvatarStack extends ConsumerWidget {
  const AvatarStack({super.key, required this.users, this.size = 26, this.max = 3});

  final List<UserBrief> users;
  final double size;
  final int max;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (users.isEmpty) return const SizedBox.shrink();
    final shown = users.take(max).toList();
    final rest = users.length - shown.length;
    final step = size * .68;
    final count = shown.length + (rest > 0 ? 1 : 0);
    return SizedBox(
      width: size + step * (count - 1),
      height: size,
      child: Stack(
        children: [
          for (var i = 0; i < shown.length; i++)
            PositionedDirectional(
              start: i * step,
              child: LumiAvatar(name: shown[i].name, size: size, ring: true),
            ),
          if (rest > 0)
            PositionedDirectional(
              start: shown.length * step,
              child: Container(
                width: size,
                height: size,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: context.palette.sunken,
                  border: Border.all(color: context.palette.panel, width: 2),
                ),
                child: Text(
                  '+${ref.watch(stringsProvider).n(rest)}',
                  style: TextStyle(fontSize: size * .36, color: context.palette.ink2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Signal bars; urgent is a filled alert square.
class PriorityGlyph extends StatelessWidget {
  const PriorityGlyph(this.priority, {super.key, this.size = 14});

  final String priority;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = LumiColors.priority(priority);
    if (priority == 'URGENT') {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
        child: Text(
          '!',
          style: TextStyle(color: Colors.white, fontSize: size * .72, fontWeight: FontWeight.w700, height: 1),
        ),
      );
    }
    final level = switch (priority) {
      'HIGH' => 3,
      'MEDIUM' => 2,
      'LOW' => 1,
      _ => 0,
    };
    return SizedBox(
      width: size,
      height: size,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        textDirection: TextDirection.ltr,
        children: [
          for (var i = 1; i <= 3; i++) ...[
            Expanded(
              child: Container(
                height: size * (.3 + i * .23),
                decoration: BoxDecoration(color: i <= level ? color : context.palette.line, borderRadius: BorderRadius.circular(1.5)),
              ),
            ),
            if (i < 3) const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }
}

/// Live pulse used for work in progress.
class Pulse extends StatefulWidget {
  const Pulse({super.key, this.color = LumiColors.lumi, this.size = 8});

  final Color color;
  final double size;

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size * 3,
      height: widget.size * 3,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Stack(
          alignment: Alignment.center,
          children: [
            Transform.scale(
              scale: .6 + _c.value * 1.6,
              child: Container(
                width: widget.size * 1.6,
                height: widget.size * 1.6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color.withValues(alpha: .4 * (1 - _c.value)),
                ),
              ),
            ),
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color),
            ),
          ],
        ),
      ),
    );
  }
}

class StatusDot extends StatelessWidget {
  const StatusDot(this.status, {super.key, this.size = 10});

  final Status status;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = LumiColors.parse(status.color);
    if (status.category == 'IN_PROGRESS') return Pulse(color: color, size: size - 2);
    if (status.category == 'DONE') {
      return Container(
        width: size + 2,
        height: size + 2,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        child: Icon(Icons.check_rounded, size: size - 1, color: Colors.white),
      );
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 2),
      ),
    );
  }
}

/// Round checkbox with a green bloom when completed.
class CheckCircle extends StatefulWidget {
  const CheckCircle({super.key, required this.checked, required this.onChanged, this.size = 22});

  final bool checked;
  final ValueChanged<bool> onChanged;
  final double size;

  @override
  State<CheckCircle> createState() => _CheckCircleState();
}

class _CheckCircleState extends State<CheckCircle> with SingleTickerProviderStateMixin {
  late final _bloom = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));

  @override
  void dispose() {
    _bloom.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final checked = widget.checked;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (!checked) _bloom.forward(from: 0);
        widget.onChanged(!checked);
      },
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: AnimatedBuilder(
          animation: _bloom,
          builder: (_, child) => Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: _bloom.isAnimating
                  ? [
                      BoxShadow(
                        color: LumiColors.success.withValues(alpha: .5 * (1 - _bloom.value)),
                        spreadRadius: 14 * _bloom.value,
                      ),
                    ]
                  : null,
            ),
            child: child,
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: checked ? LumiColors.success : Colors.transparent,
              border: Border.all(color: checked ? LumiColors.success : context.palette.muted.withValues(alpha: .6), width: 1.5),
            ),
            child: checked ? Icon(Icons.check_rounded, size: widget.size * .65, color: Colors.white) : null,
          ),
        ),
      ),
    );
  }
}

class DueChip extends ConsumerWidget {
  const DueChip(this.due, {super.key, this.compact = true});

  final DateTime? due;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    if (due == null) return compact ? const SizedBox.shrink() : Pill(s.t('task.noDue'), icon: const Icon(Icons.event_outlined, size: 12));
    final info = dueInfo(due!, s);
    final tone = switch (info.tone) {
      DueTone.late => PillTone.danger,
      DueTone.today => PillTone.warn,
      DueTone.soon => PillTone.info,
      DueTone.later => PillTone.neutral,
    };
    return Pill(info.label, tone: tone, icon: const Icon(Icons.event_outlined, size: 11));
  }
}

class LabelChip extends StatelessWidget {
  const LabelChip(this.label, {super.key});

  final Label label;

  @override
  Widget build(BuildContext context) {
    final c = LumiColors.parse(label.color);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withValues(alpha: .14), borderRadius: BorderRadius.circular(99)),
      child: Text(
        '#${label.name}',
        style: TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w500),
      ),
    );
  }
}

class Sticker extends StatelessWidget {
  const Sticker(this.label, {super.key, this.bg, this.fg, this.angle = -6});

  final String label;
  final Color? bg;
  final Color? fg;
  final double angle;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: angle * math.pi / 180,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: bg ?? context.palette.warnSoft,
          borderRadius: BorderRadius.circular(99),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .18), blurRadius: 14, offset: const Offset(0, 6), spreadRadius: -6)],
        ),
        child: Text(
          label,
          style: TextStyle(color: fg ?? LumiColors.warn, fontWeight: FontWeight.w700, fontSize: 12),
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.emoji, required this.text});

  final String emoji;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 38)),
          const SizedBox(height: 10),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: context.palette.muted),
          ),
        ],
      ),
    );
  }
}

class Loading extends StatelessWidget {
  const Loading({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: context.palette.ink)),
  );
}

class ErrorView extends ConsumerWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('⚠️', style: TextStyle(fontSize: 32)),
          const SizedBox(height: 8),
          Text(
            '$error',
            textAlign: TextAlign.center,
            style: TextStyle(color: context.palette.muted),
          ),
          if (onRetry != null) TextButton(onPressed: onRetry, child: const Icon(Icons.refresh_rounded)),
        ],
      ),
    );
  }
}

/// Hatched day columns; the selected one is ink with a tooltip.
class HatchBars extends StatefulWidget {
  const HatchBars({super.key, required this.days, required this.strings});

  final List<({DateTime date, int count, int delta})> days;
  final Strings strings;

  @override
  State<HatchBars> createState() => _HatchBarsState();
}

class _HatchBarsState extends State<HatchBars> {
  late int selected = widget.days.length - 1;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = widget.strings;
    final peak = widget.days.fold<int>(0, (a, d) => math.max(a, d.count));
    final max = math.max(3, (peak / 3).ceil() * 3);
    return SizedBox(
      height: 190,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < widget.days.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => selected = i),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (i == selected)
                        Center(
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(color: p.ink, borderRadius: BorderRadius.circular(10)),
                            child: Text(
                              s.n(widget.days[i].count),
                              style: TextStyle(color: p.onInk, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: math.max(.12, widget.days[i].count / max)),
                        duration: Duration(milliseconds: 500 + i * 60),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, __) => Container(
                          height: 130 * v,
                          decoration: BoxDecoration(
                            color: i == selected ? p.ink : p.sunken,
                            borderRadius: BorderRadius.circular(12),
                            border: i == selected ? null : Border.all(color: p.line),
                          ),
                          child: CustomPaint(painter: _HatchPainter(i == selected ? p.onInk.withValues(alpha: .14) : p.ink.withValues(alpha: .07))),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        weekday(widget.days[i].date, s).characters.take(s.isFa ? 1 : 3).toString(),
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11, color: i == selected ? p.ink : p.muted, fontWeight: i == selected ? FontWeight.w600 : FontWeight.w400),
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

class _HatchPainter extends CustomPainter {
  _HatchPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.clipRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12)));
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;
    for (double x = -size.height; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, size.height), Offset(x + size.height, 0), paint);
    }
  }

  @override
  bool shouldRepaint(_HatchPainter old) => old.color != color;
}

/// Semicircle of rounded segments filled to `value` percent.
class SegmentGauge extends StatelessWidget {
  const SegmentGauge({super.key, required this.value, required this.label, required this.strings});

  final int value;
  final String label;
  final Strings strings;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value / 100),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => SizedBox(
        height: 130,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            Positioned.fill(child: CustomPaint(painter: _GaugePainter(v, p.sunken, p.line))),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text('${strings.n((v * 100).round())}%', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w700, height: 1)),
                ),
                Text(label, style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter(this.progress, this.empty, this.line);

  final double progress;
  final Color empty;
  final Color line;

  @override
  void paint(Canvas canvas, Size size) {
    const segments = 14;
    final center = Offset(size.width / 2, size.height);
    final r1 = math.min(size.width / 2, size.height) - 2;
    final r0 = r1 * .66;
    for (var i = 0; i < segments; i++) {
      final a0 = math.pi + (i / segments) * math.pi + .03;
      final a1 = math.pi + ((i + 1) / segments) * math.pi - .03;
      final path = Path()
        ..arcTo(Rect.fromCircle(center: center, radius: r1), a0, a1 - a0, true)
        ..arcTo(Rect.fromCircle(center: center, radius: r0), a1, a0 - a1, false)
        ..close();
      final on = i < (progress * segments).round();
      canvas.drawPath(path, Paint()..color = on ? Color.lerp(LumiColors.success, const Color(0xFF052E16), .35 - i / segments * .35)! : empty);
      if (!on) {
        canvas.drawPath(
          path,
          Paint()
            ..color = line
            ..style = PaintingStyle.stroke,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.progress != progress;
}
