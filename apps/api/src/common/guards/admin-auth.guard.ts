import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission } from '@repo/types';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../../modules/sessions/session.service';
import type { AuthenticatedUser } from '../auth-context';

export const ADMIN_SESSION_COOKIE = 'admin_session';

/**
 * Authenticates admin/staff requests via the admin session cookie
 * (or Authorization: Bearer for API clients/tests). Loads the user's
 * permissions and authorised branch IDs from the database — the client
 * can never influence its own authorisation context.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractToken(request, ADMIN_SESSION_COOKIE);
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });

    const session = await this.sessions.resolve(token, 'ADMIN');
    if (!session?.userId) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Session is invalid or expired.' });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
        branches: { select: { branchId: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Account is disabled.' });
    }

    const permissions = new Set<Permission>();
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        permissions.add(rp.permission.key as Permission);
      }
    }

    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isGlobal: user.isGlobal,
      mfaEnabled: user.mfaEnabled,
      permissions,
      branchIds: new Set(user.branches.map((b) => b.branchId)),
      sessionId: session.id,
    };
    return true;
  }
}

export function extractToken(request: Request, cookieName: string): string | null {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  const cookieToken = cookies?.[cookieName];
  if (cookieToken) return cookieToken;
  const header = request.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}
