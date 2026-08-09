import { Injectable } from '@nestjs/common';
import { generateToken, hashToken } from '@repo/auth';
import type { Session, SessionKind } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Sliding renewal: extend when less than half the TTL remains. */
const RENEW_THRESHOLD = 0.5;
/** Short Redis cache of resolved sessions to cut DB hits on authenticated browsing. */
const SESSION_CACHE_TTL_SEC = 30;

export interface CreateSessionInput {
  kind: SessionKind;
  userId?: string;
  customerId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  ttlFor(kind: SessionKind): number {
    return kind === 'ADMIN' ? ADMIN_SESSION_TTL_MS : CUSTOMER_SESSION_TTL_MS;
  }

  /** Create a session and return the RAW token (only time it exists in plaintext). */
  async create(input: CreateSessionInput): Promise<{ token: string; session: Session }> {
    const token = generateToken();
    const session = await this.prisma.session.create({
      data: {
        kind: input.kind,
        tokenHash: hashToken(token),
        userId: input.userId,
        customerId: input.customerId,
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 500),
        deviceName: deviceNameFrom(input.userAgent),
        expiresAt: new Date(Date.now() + this.ttlFor(input.kind)),
      },
    });
    return { token, session };
  }

  /** Resolve a raw token to a live session; touches lastActiveAt and slides expiry. */
  async resolve(rawToken: string, kind: SessionKind): Promise<Session | null> {
    const tokenHash = hashToken(rawToken);
    const cacheKey = `session:${kind}:${tokenHash}`;
    const cached = await this.cache.getJson<Session>(cacheKey);
    if (cached) {
      if (cached.revokedAt || new Date(cached.expiresAt) < new Date()) {
        await this.cache.del(cacheKey);
        return null;
      }
      return {
        ...cached,
        expiresAt: new Date(cached.expiresAt),
        lastActiveAt: new Date(cached.lastActiveAt),
        createdAt: new Date(cached.createdAt),
        revokedAt: cached.revokedAt ? new Date(cached.revokedAt) : null,
      };
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });
    if (!session || session.kind !== kind) return null;
    if (session.revokedAt || session.expiresAt < new Date()) return null;

    const ttl = this.ttlFor(kind);
    const remaining = session.expiresAt.getTime() - Date.now();
    const shouldSlide = remaining < ttl * RENEW_THRESHOLD;
    // Avoid a write on every request: only update when sliding or stale by >5min.
    let resolved = session;
    if (shouldSlide || Date.now() - session.lastActiveAt.getTime() > 5 * 60 * 1000) {
      resolved = await this.prisma.session.update({
        where: { id: session.id },
        data: {
          lastActiveAt: new Date(),
          ...(shouldSlide ? { expiresAt: new Date(Date.now() + ttl) } : {}),
        },
      });
    }
    await this.cache.setJson(cacheKey, resolved, SESSION_CACHE_TTL_SEC);
    return resolved;
  }

  async revoke(sessionId: string): Promise<void> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { kind: true, tokenHash: true },
    });
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (existing) {
      await this.cache.del(`session:${existing.kind}:${existing.tokenHash}`);
    }
  }

  /** Revoke all sessions for a principal, optionally keeping one alive. */
  async revokeAll(
    principal: { userId?: string; customerId?: string },
    exceptSessionId?: string,
  ): Promise<number> {
    const targets = await this.prisma.session.findMany({
      where: {
        userId: principal.userId,
        customerId: principal.customerId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      select: { kind: true, tokenHash: true },
    });
    const result = await this.prisma.session.updateMany({
      where: {
        userId: principal.userId,
        customerId: principal.customerId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await Promise.all(
      targets.map((s) => this.cache.del(`session:${s.kind}:${s.tokenHash}`)),
    );
    return result.count;
  }

  /** List active sessions for display (no token material). */
  async listActive(principal: { userId?: string; customerId?: string }) {
    return this.prisma.session.findMany({
      where: {
        userId: principal.userId,
        customerId: principal.customerId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ip: true,
        lastActiveAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}

/** Best-effort human-readable device label from the user agent. */
function deviceNameFrom(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  const ua = userAgent.toLowerCase();
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('safari/') && !ua.includes('chrome')
        ? 'Safari'
        : ua.includes('firefox/')
          ? 'Firefox'
          : 'Browser';
  const os = ua.includes('mac os')
    ? 'macOS'
    : ua.includes('windows')
      ? 'Windows'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad')
          ? 'iOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}
