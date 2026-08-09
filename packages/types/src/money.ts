/**
 * Money utilities. All monetary amounts in the platform are integer minor units
 * (pence for GBP). Floats are never used for authoritative financial values.
 */

/** Format integer minor units as a display string, e.g. 149 -> "£1.49". */
export function formatMoney(minorUnits: number, currency = 'GBP', locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minorUnits / 100);
}

/** Parse a decimal string like "1.49" into integer minor units (149). Throws on invalid input. */
export function parseMoney(input: string): number {
  const trimmed = input.trim().replace(/^[£$€]/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid money value: ${input}`);
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
}

/**
 * Apply a percentage to an amount of minor units with banker-safe rounding.
 * E.g. percentOf(149, 10) === 15 (10% of £1.49 = 14.9p -> 15p).
 */
export function percentOf(minorUnits: number, percent: number): number {
  return Math.round((minorUnits * percent) / 100);
}

/** Distribute an amount across n parts without losing pennies (largest remainder). */
export function allocate(minorUnits: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) throw new Error('Total weight must be positive');
  const shares = weights.map((w) => Math.floor((minorUnits * w) / totalWeight));
  let remainder = minorUnits - shares.reduce((a, b) => a + b, 0);
  const remainders = weights
    .map((w, i) => ({ i, frac: (minorUnits * w) % totalWeight }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of remainders) {
    if (remainder <= 0) break;
    shares[i] = (shares[i] ?? 0) + 1;
    remainder -= 1;
  }
  return shares;
}
