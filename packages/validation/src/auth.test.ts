import { describe, expect, it } from 'vitest';
import { customerLoginSchema, moneySchema, passwordSchema } from './index';

describe('customerLoginSchema', () => {
  it('accepts valid credentials and normalises email', () => {
    const result = customerLoginSchema.parse({
      email: '  Customer@Example.COM ',
      password: 'secret-password',
    });
    expect(result.email).toBe('customer@example.com');
    expect(result.password).toBe('secret-password');
  });

  it('rejects invalid email and empty password', () => {
    expect(() =>
      customerLoginSchema.parse({ email: 'not-an-email', password: 'x' }),
    ).toThrow();
    expect(() =>
      customerLoginSchema.parse({ email: 'a@b.co', password: '' }),
    ).toThrow();
  });
});

describe('passwordSchema', () => {
  it('requires length and mixed character classes', () => {
    expect(() => passwordSchema.parse('short')).toThrow();
    expect(() => passwordSchema.parse('alllowercase')).toThrow();
    expect(passwordSchema.parse('GoodPass12')).toBe('GoodPass12');
  });
});

describe('moneySchema', () => {
  it('accepts non-negative integer minor units', () => {
    expect(moneySchema.parse(0)).toBe(0);
    expect(moneySchema.parse(149)).toBe(149);
  });

  it('rejects floats and negative values', () => {
    expect(() => moneySchema.parse(1.5)).toThrow();
    expect(() => moneySchema.parse(-1)).toThrow();
  });
});
