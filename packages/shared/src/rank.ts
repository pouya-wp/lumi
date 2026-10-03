const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Returns a key strictly between `a` and `b` in lexicographic order, for drag & drop ordering
 * without rewriting siblings. `null` means unbounded. Keys never end with '0'.
 */
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) throw new Error(`rankBetween: ${a} >= ${b}`);
  return midpoint(a ?? '', b);
}

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)];
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}
