import 'dart:convert';

import 'package:flutter/services.dart';

import '../utils/digits.dart';

/// Message catalogs shared with the web app (assets/i18n, synced by tool/sync_i18n.sh).
class Strings {
  Strings._(this.locale, this._dict);

  final String locale;
  final Map<String, dynamic> _dict;

  bool get isFa => locale == 'fa';

  static Future<Strings> load(String locale) async {
    final raw = await rootBundle.loadString('assets/i18n/$locale.json');
    return Strings._(locale, jsonDecode(raw) as Map<String, dynamic>);
  }

  /// Resolves "section.key" (the key may itself contain dots) and fills {params}.
  String t(String key, [Map<String, Object> params = const {}]) {
    final value = raw(key);
    if (value is! String) return key;
    return value.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
      final p = params[m[1]];
      if (p == null) return m[0]!;
      return p is num ? n(p) : p.toString();
    });
  }

  /// Resolves dotted keys whose segments may contain dots (e.g. "notif.task.assigned"), longest match first.
  dynamic raw(String key) => _resolve(_dict, key.split('.'));

  dynamic _resolve(dynamic node, List<String> parts) {
    if (parts.isEmpty) return node;
    if (node is List) {
      final i = int.tryParse(parts.first);
      return i == null || i >= node.length ? null : _resolve(node[i], parts.sublist(1));
    }
    if (node is! Map) return null;
    for (var i = parts.length; i > 0; i--) {
      final k = parts.sublist(0, i).join('.');
      if (node.containsKey(k)) {
        final found = _resolve(node[k], parts.sublist(i));
        if (found != null) return found;
      }
    }
    return null;
  }

  /// Number in the locale's digits.
  String n(Object value) => isFa ? toFaDigits(value.toString()) : value.toString();
}
