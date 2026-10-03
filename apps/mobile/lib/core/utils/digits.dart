const _fa = '۰۱۲۳۴۵۶۷۸۹';

String toFaDigits(String input) => input.replaceAllMapped(RegExp(r'[0-9]'), (m) => _fa[int.parse(m[0]!)]);

String toEnDigits(String input) => input
    .replaceAllMapped(RegExp('[۰-۹]'), (m) => _fa.indexOf(m[0]!).toString())
    .replaceAllMapped(RegExp('[٠-٩]'), (m) => (m[0]!.codeUnitAt(0) - 0x0660).toString());
