import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';

/**
 * TOTP MFA. Secrets are encrypted at rest with AES-256-GCM using a key
 * derived from AUTH_SECRET — never stored in plaintext.
 */

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`mfa-encryption:${secret}`).digest();
}

export function generateMfaSecret(): string {
  return authenticator.generateSecret(20);
}

export function buildOtpAuthUrl(email: string, secret: string, issuer = 'MultiBranch Commerce'): string {
  return authenticator.keyuri(email, issuer, secret);
}

export function verifyTotp(secret: string, code: string): boolean {
  // Accept one step of clock drift either side.
  authenticator.options = { window: 1 };
  return authenticator.check(code, secret);
}

export function encryptMfaSecret(plainSecret: string, authSecret: string): string {
  const key = deriveKey(authSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptMfaSecret(payload: string, authSecret: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed MFA secret payload');
  const key = deriveKey(authSecret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
