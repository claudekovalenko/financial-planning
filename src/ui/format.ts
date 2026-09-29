export function money(n: number, compact = false): string {
  if (!Number.isFinite(n)) return '–';
  const sign = n < 0 ? '−' : '';
  const v = Math.abs(n);
  if (compact) {
    if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M`;
    if (v >= 1e3) return `${sign}$${Math.round(v / 1e3)}k`;
    return `${sign}$${Math.round(v)}`;
  }
  return `${sign}$${Math.round(v).toLocaleString('en-US')}`;
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
