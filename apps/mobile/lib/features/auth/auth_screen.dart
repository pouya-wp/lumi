import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/lumi_colors.dart';
import '../../core/widgets/widgets.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, required this.register});

  final bool register;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _workspace = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _password, _workspace]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = ref.read(apiProvider);
    try {
      final body = widget.register
          ? await api.post<Map<String, dynamic>>('/auth/register', {
              'name': _name.text.trim(),
              'email': _email.text.trim(),
              'password': _password.text,
              if (_workspace.text.trim().isNotEmpty) 'workspaceName': _workspace.text.trim(),
              'locale': ref.read(localeProvider),
            })
          : await api.post<Map<String, dynamic>>('/auth/login', {'email': _email.text.trim(), 'password': _password.text});
      await ref.read(sessionProvider.notifier).signIn(body);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final p = context.palette;
    final register = widget.register;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(14),
          children: [
            _NightHero(title1: s.t('hero.title1'), title2: s.t('hero.title2'), proposal: s.t('task.proposalFor', {'name': 'Sara'}), accept: s.t('task.accept')),
            const SizedBox(height: 14),
            Panel(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          s.t(register ? 'auth.registerTitle' : 'auth.loginTitle'),
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                        ),
                      ),
                      TextButton(onPressed: () => ref.read(localeProvider.notifier).state = s.isFa ? 'en' : 'fa', child: Text(s.isFa ? 'EN' : 'فا')),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(s.t(register ? 'auth.registerSub' : 'auth.loginSub'), style: TextStyle(color: p.muted)),
                  const SizedBox(height: 22),
                  if (register) ...[
                    TextField(
                      controller: _name,
                      decoration: InputDecoration(hintText: s.t('auth.name')),
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(hintText: s.t('auth.email')),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(hintText: register ? '${s.t('auth.password')} — ${s.t('auth.passwordHint')}' : s.t('auth.password')),
                    onSubmitted: (_) => _submit(),
                  ),
                  if (register) ...[
                    const SizedBox(height: 10),
                    TextField(
                      controller: _workspace,
                      decoration: InputDecoration(hintText: '${s.t('auth.workspace')} (Beyondex)'),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: p.dangerSoft, borderRadius: BorderRadius.circular(LumiRadius.inner)),
                      child: Text(_error!, style: const TextStyle(color: LumiColors.danger)),
                    ),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: p.onInk))
                        : Text(s.t(register ? 'auth.register' : 'auth.login')),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => context.go(register ? '/login' : '/register'),
                    child: Text('${s.t(register ? 'auth.haveAccount' : 'auth.noAccount')} ${s.t(register ? 'auth.login' : 'auth.register')}'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Center(
              child: Text(s.t('by'), style: TextStyle(color: p.muted, fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Starry night card with floating glass tiles, echoing the web auth scene.
class _NightHero extends StatelessWidget {
  const _NightHero({required this.title1, required this.title2, required this.proposal, required this.accept});

  final String title1;
  final String title2;
  final String proposal;
  final String accept;

  @override
  Widget build(BuildContext context) {
    Widget glass(Widget child) => Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .07),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: .1)),
      ),
      child: child,
    );
    return Container(
      height: 280,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LumiRadius.frame),
        gradient: const RadialGradient(center: Alignment(.7, -1), radius: 1.6, colors: [LumiColors.night2, LumiColors.night1, Color(0xFF05060F)]),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          for (var i = 0; i < 40; i++)
            Positioned(
              left: (i * 37 % 100) / 100 * 400,
              top: (i * 61 % 100) / 100 * 280,
              child: Container(
                width: (i % 3) + 1.0,
                height: (i % 3) + 1.0,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: .25 + (i % 4) * .15),
                ),
              ),
            ),
          PositionedDirectional(
            top: 26,
            end: 20,
            child: Transform.rotate(
              angle: .08,
              child: glass(
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '+68%',
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700),
                    ),
                    Container(
                      width: 80,
                      height: 4,
                      margin: const EdgeInsets.only(top: 6),
                      decoration: BoxDecoration(color: const Color(0xFFA5B4FC), borderRadius: BorderRadius.circular(9)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PositionedDirectional(
            top: 40,
            start: 20,
            child: Transform.rotate(
              angle: -.07,
              child: glass(
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(proposal, style: const TextStyle(color: Colors.white70, fontSize: 11)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
                      child: Text(
                        accept,
                        style: const TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PositionedDirectional(
            bottom: 22,
            start: 22,
            end: 22,
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '$title1\n'),
                  TextSpan(
                    text: title2,
                    style: const TextStyle(color: Color(0xFFA5B4FC)),
                  ),
                ],
              ),
              style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700, height: 1.15),
            ),
          ),
        ],
      ),
    );
  }
}
