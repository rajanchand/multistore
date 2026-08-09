import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque token utilities. Raw tokens are handed to clients; only SHA-256
 * hashes are persisted, so a database leak cannot be replayed as sessions.
 */

/** Generate a 256-bit URL-safe random token. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hash of a token for at-rest storage/lookup. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
