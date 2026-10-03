import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../providers.dart';
import '../theme/lumi_colors.dart';
import '../widgets/widgets.dart';

const _prefKey = 'lumi.lock';

/// Locks again after the app has been in the background this long.
const lockAfter = Duration(seconds: 30);

class AppLockState {
  const AppLockState({required this.enabled, required this.locked});

  final bool enabled;
  final bool locked;
}

/// Biometric/device-credential lock. Enabled per device; locks on cold start and after [lockAfter] in background.
class AppLockNotifier extends Notifier<AppLockState> {
  final _auth = LocalAuthentication();
  DateTime? _pausedAt;

  @override
  AppLockState build() {
    final enabled = ref.watch(prefsProvider)?.getBool(_prefKey) ?? false;
    return AppLockState(enabled: enabled, locked: enabled);
  }

  Future<bool> get supported async {
    if (kIsWeb) return false;
    try {
      return await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> _authenticate(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, persistAcrossBackgrounding: true);
    } catch (_) {
      return false;
    }
  }

  /// Turns the lock on only after a successful authentication, so nobody can lock themselves out.
  Future<bool> setEnabled(bool on, String reason) async {
    if (on && !await _authenticate(reason)) return false;
    await ref.read(prefsProvider)?.setBool(_prefKey, on);
    state = AppLockState(enabled: on, locked: false);
    return true;
  }

  Future<void> unlock(String reason) async {
    if (await _authenticate(reason)) state = AppLockState(enabled: state.enabled, locked: false);
  }

  void onLifecycle(AppLifecycleState s) {
    if (!state.enabled) return;
    if (s == AppLifecycleState.paused || s == AppLifecycleState.hidden) _pausedAt ??= DateTime.now();
    if (s == AppLifecycleState.resumed) {
      final away = _pausedAt == null ? Duration.zero : DateTime.now().difference(_pausedAt!);
      _pausedAt = null;
      if (away >= lockAfter) state = AppLockState(enabled: true, locked: true);
    }
  }
}

final appLockProvider = NotifierProvider<AppLockNotifier, AppLockState>(AppLockNotifier.new);

/// Covers the app with a frosted lock screen while locked.
class AppLockGate extends ConsumerStatefulWidget {
  const AppLockGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _prompt());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    ref.read(appLockProvider.notifier).onLifecycle(state);
    if (state == AppLifecycleState.resumed) _prompt();
  }

  void _prompt() {
    if (ref.read(appLockProvider).locked) ref.read(appLockProvider.notifier).unlock(ref.read(stringsProvider).t('mobile.lock.reason'));
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(appLockProvider);
    final s = ref.watch(stringsProvider);
    return Stack(
      children: [
        widget.child,
        if (lock.locked)
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [LumiColors.night1, LumiColors.night2]),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Pulse(color: LumiColors.lumi, size: 14),
                    const SizedBox(height: 28),
                    Container(
                      width: 84,
                      height: 84,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .08),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 44),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      'Lumi',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(s.t('mobile.lock.title'), style: const TextStyle(color: Colors.white60)),
                    const SizedBox(height: 28),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: LumiColors.night1,
                        padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
                      ),
                      onPressed: _prompt,
                      icon: const Icon(Icons.lock_open_rounded),
                      label: Text(s.t('mobile.lock.unlock')),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
