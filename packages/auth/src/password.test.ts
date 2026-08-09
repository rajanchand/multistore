import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { generateToken, hashToken, safeEqualHex } from './tokens';

describe('password hashing', () => {
  it('hashes and verifies with argon2id', async () => {
    const hash = await hashPassword('DevPassword123!');
    expect(hash).toContain('argon2id');
    expect(await verifyPassword(hash, 'DevPassword123!')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});

describe('tokens', () => {
  it('generates unique opaque tokens and hashes them', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toEqual(b);
    expect(hashToken(a)).toHaveLength(64);
    expect(safeEqualHex(hashToken(a), hashToken(a))).toBe(true);
    expect(safeEqualHex(hashToken(a), hashToken(b))).toBe(false);
  });
});
