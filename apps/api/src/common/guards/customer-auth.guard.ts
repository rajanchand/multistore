import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../../modules/sessions/session.service';
import type { AuthenticatedCustomer } from '../auth-context';
import { extractToken } from './admin-auth.guard';

export const CUSTOMER_SESSION_COOKIE = 'customer_session';

/** Authenticates storefront customers via the customer session cookie. */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { customer?: AuthenticatedCustomer }>();
    const token = extractToken(request, CUSTOMER_SESSION_COOKIE);
    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Please sign in.' });
    }

    const session = await this.sessions.resolve(token, 'CUSTOMER');
    if (!session?.customerId) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Session is invalid or expired.' });
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: session.customerId, isActive: true, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!customer) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Account is disabled.' });
    }

    request.customer = { ...customer, sessionId: session.id };
    return true;
  }
}
