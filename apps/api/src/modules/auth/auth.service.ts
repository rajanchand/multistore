import { Injectable, Logger } from '@nestjs/common';
import {
  buildOtpAuthUrl,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
  verifyTotp,
} from '@repo/auth';
import { loadServerEnv } from '@repo/config';
import type { User } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../sessions/session.service';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../../common/errors';
import type { RequestContext } from '../../common/auth-context';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Admin login. Enforces lockout, verifies Argon2id hash, then MFA when enabled.
   * Returns the raw session token for cookie issuance.
   */
  async loginAdmin(
    emailOrUsername: string,
    password: string,
    mfaCode: string | undefined,
    ctx: RequestContext,
  ): Promise<{ token: string; user: User }> {
    const identifier = emailOrUsername.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    // Always verify against some hash to keep timing uniform for unknown emails.
    const dummyHash =
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordOk = await verifyPassword(user?.passwordHash ?? dummyHash, password);

    if (!user || !user.isActive) {
      await this.recordLogin(identifier, false, 'unknown_or_inactive', ctx, user?.id);
      throw Errors.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLogin(identifier, false, 'locked', ctx, user.id);
      throw Errors.accountLocked();
    }

    if (!passwordOk) {
      const failedCount = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil:
            failedCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null,
        },
      });
      await this.recordLogin(identifier, false, 'bad_password', ctx, user.id);
      throw Errors.invalidCredentials();
    }

    if (user.mfaEnabled) {
      if (!mfaCode) throw Errors.mfaRequired();
      const env = loadServerEnv();
      const secret = decryptMfaSecret(user.mfaSecretEnc!, env.AUTH_SECRET);
      if (!verifyTotp(secret, mfaCode)) {
        await this.recordLogin(identifier, false, 'bad_mfa', ctx, user.id);
        throw Errors.invalidMfaCode();
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { token } = await this.sessions.create({
      kind: 'ADMIN',
      userId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    await this.recordLogin(identifier, true, null, ctx, user.id);
    await this.audit.log({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { token, user };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  /** Begin MFA enrolment: generate a secret, store encrypted, return otpauth URL. */
  async setupMfa(userId: string): Promise<{ otpauthUrl: string; secret: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw Errors.conflict('MFA_ALREADY_ENABLED', 'MFA is already enabled.');
    const env = loadServerEnv();
    const secret = generateMfaSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encryptMfaSecret(secret, env.AUTH_SECRET), mfaEnabled: false },
    });
    return { otpauthUrl: buildOtpAuthUrl(user.email, secret), secret };
  }

  /** Confirm MFA enrolment with a valid TOTP code. */
  async enableMfa(userId: string, code: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEnc) throw Errors.badRequest('MFA_NOT_SETUP', 'Run MFA setup first.');
    const env = loadServerEnv();
    const secret = decryptMfaSecret(user.mfaSecretEnc, env.AUTH_SECRET);
    if (!verifyTotp(secret, code)) throw Errors.invalidMfaCode();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.log({
      actorUserId: userId,
      action: 'AUTH_MFA_ENABLED',
      resourceType: 'User',
      resourceId: userId,
      requestId: ctx.requestId,
    });
  }

  async disableMfa(userId: string, code: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabled || !user.mfaSecretEnc) return;
    const env = loadServerEnv();
    const secret = decryptMfaSecret(user.mfaSecretEnc, env.AUTH_SECRET);
    if (!verifyTotp(secret, code)) throw Errors.invalidMfaCode();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null },
    });
    await this.audit.log({
      actorUserId: userId,
      action: 'AUTH_MFA_DISABLED',
      resourceType: 'User',
      resourceId: userId,
      requestId: ctx.requestId,
    });
  }

  /**
   * Forgot password. Response is identical whether or not the account exists
   * (no user enumeration). The raw token would be emailed; only its hash is stored.
   */
  async forgotPassword(email: string): Promise<{ devToken?: string }> {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null, isActive: true } });
    if (!user) return {};

    const token = generateToken();
    await this.prisma.verificationToken.create({
      data: {
        purpose: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    // Email delivery is queued by the notifications module; in development the
    // token is logged so the flow can be exercised without an email provider.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`DEV password reset token for ${email}: ${token}`);
      return { devToken: token };
    }
    return {};
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (
      !record ||
      record.purpose !== 'PASSWORD_RESET' ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      !record.userId
    ) {
      throw Errors.badRequest('INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      // Password change revokes every existing session.
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw Errors.invalidCredentials();
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.sessions.revokeAll({ userId }, keepSessionId);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isGlobal: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: { select: { id: true, name: true, description: true } } } },
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!user) throw Errors.notFound('User');
    return user;
  }

  async updateProfile(
    userId: string,
    input: { firstName: string; lastName: string; username: string; email: string },
  ) {
    const existing = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!existing) throw Errors.notFound('User');

    if (input.email !== existing.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: input.email, deletedAt: null, NOT: { id: userId } },
      });
      if (taken) throw Errors.conflict('EMAIL_IN_USE', 'A user with this email already exists.');
    }
    if (input.username !== existing.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: input.username, deletedAt: null, NOT: { id: userId } },
      });
      if (taken) throw Errors.conflict('USERNAME_IN_USE', 'A user with this username already exists.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        email: input.email,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'PROFILE_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      newValue: {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        email: input.email,
      },
    });

    return this.getProfile(userId);
  }

  private async recordLogin(
    email: string,
    success: boolean,
    reason: string | null,
    ctx: RequestContext,
    userId?: string,
  ): Promise<void> {
    await this.prisma.loginLog.create({
      data: {
        email,
        userId,
        success,
        reason,
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 500),
      },
    });
    if (!success) {
      await this.audit.log({
        actorUserId: userId ?? null,
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'User',
        resourceId: userId ?? null,
        metadata: { email, reason },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
    }
  }
}
