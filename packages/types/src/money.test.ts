import { describe, expect, it } from 'vitest';
import { allocate, formatMoney, parseMoney, percentOf } from './money';

describe('money', () => {
  it('formats minor units as GBP', () => {
    expect(formatMoney(149)).toBe('£1.49');
    expect(formatMoney(0)).toBe('£0.00');
  });

  it('parses decimal strings into minor units', () => {
    expect(parseMoney('1.49')).toBe(149);
    expect(parseMoney('£10')).toBe(1000);
    expect(parseMoney('0.05')).toBe(5);
  });

  it('rejects invalid money strings', () => {
    expect(() => parseMoney('1.999')).toThrow();
    expect(() => parseMoney('abc')).toThrow();
  });

  it('applies percentages with rounding', () => {
    expect(percentOf(149, 10)).toBe(15);
    expect(percentOf(100, 50)).toBe(50);
  });

  it('allocates without losing pennies', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(5, [1, 1])).toEqual([3, 2]);
  });
});
