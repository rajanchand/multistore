import { Injectable, Logger } from '@nestjs/common';
import { generateToken, hashPassword, hashToken, verifyPassword } from '@repo/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../sessions/session.service';
import { Errors } from '../../common/errors';
import type { RequestContext } from '../../common/auth-context';
import type { RegisterInput } from '@repo/validation';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface PublicCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger('CustomerAuth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async register(
    input: RegisterInput,
    ctx: RequestContext,
  ): Promise<{ token: string; customer: PublicCustomer }> {
    const existing = await this.prisma.customer.findUnique({ where: { email: input.email } });
    if (existing) {
      throw Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
    }
    const customer = await this.prisma.customer.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });
    const { token } = await this.sessions.create({
      kind: 'CUSTOMER',
      customerId: customer.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { token, customer: publicCustomer(customer) };
  }

  async login(
    email: string,
    password: string,
    ctx: RequestContext,
  ): Promise<{ token: string; customer: PublicCustomer }> {
    const customer = await this.prisma.customer.findFirst({ where: { email, deletedAt: null } });
    const dummyHash =
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordOk = await verifyPassword(customer?.passwordHash ?? dummyHash, password);

    if (!customer || !customer.isActive) {
      await this.recordLogin(email, false, 'unknown_or_inactive', ctx, customer?.id);
      throw Errors.invalidCredentials();
    }
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      await this.recordLogin(email, false, 'locked', ctx, customer.id);
      throw Errors.accountLocked();
    }
    if (!passwordOk) {
      const failedCount = customer.failedLoginCount + 1;
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil:
            failedCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null,
        },
      });
      await this.recordLogin(email, false, 'bad_password', ctx, customer.id);
      throw Errors.invalidCredentials();
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    const { token } = await this.sessions.create({
      kind: 'CUSTOMER',
      customerId: customer.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.recordLogin(email, true, null, ctx, customer.id);
    return { token, customer: publicCustomer(customer) };
  }

  async forgotPassword(email: string): Promise<{ devToken?: string }> {
    const customer = await this.prisma.customer.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });
    if (!customer) return {};
    const token = generateToken();
    await this.prisma.verificationToken.create({
      data: {
        purpose: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        customerId: customer.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`DEV customer reset token for ${email}: ${token}`);
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
      !record.customerId
    ) {
      throw Errors.badRequest('INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.');
    }
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.customer.update({
        where: { id: record.customerId },
        data: {
          passwordHash: await hashPassword(newPassword),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { customerId: record.customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async recordLogin(
    email: string,
    success: boolean,
    reason: string | null,
    ctx: RequestContext,
    customerId?: string,
  ): Promise<void> {
    await this.prisma.loginLog.create({
      data: {
        email,
        customerId,
        success,
        reason,
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 500),
      },
    });
  }
}

function publicCustomer(c: { id: string; email: string; firstName: string; lastName: string }): PublicCustomer {
  return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName };
}
