import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaVerifySchema,
  resetPasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type MfaVerifyInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
} from '@repo/validation';
import { loadServerEnv } from '@repo/config';
import { AuthService } from './auth.service';
import { SessionService } from '../sessions/session.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthGuard, ADMIN_SESSION_COOKIE } from '../../common/guards/admin-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function requestContext(req: Request): RequestContext {
  return {
    requestId: (req as Request & { requestId?: string }).requestId,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}

export function setSessionCookie(res: Response, name: string, token: string, maxAgeMs: number): void {
  const env = loadServerEnv();
  res.cookie(name, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, name: string): void {
  res.clearCookie(name, { path: '/' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.loginAdmin(
      body.email,
      body.password,
      body.mfaCode,
      requestContext(req),
    );
    setSessionCookie(res, ADMIN_SESSION_COOKIE, token, this.sessions.ttlFor('ADMIN'));
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mfaEnabled: user.mfaEnabled,
      },
      // Also returned for non-browser API clients (tests, tooling).
      token,
    };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    clearSessionCookie(res, ADMIN_SESSION_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.auth.getProfile(user.id);
    return {
      ...profile,
      permissions: [...user.permissions],
      branchIds: [...user.branchIds],
    };
  }

  @Patch('profile')
  @UseGuards(AdminAuthGuard)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.auth.updateProfile(user.id, body);
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    const result = await this.auth.forgotPassword(body.email);
    return {
      message: 'If that account exists, a reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && result.devToken
        ? { devToken: result.devToken }
        : {}),
    };
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    await this.auth.resetPassword(body.token, body.password);
    return { message: 'Password updated. Please sign in again.' };
  }

  @Post('change-password')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, user.sessionId);
    return { message: 'Password changed. Other sessions have been signed out.' };
  }

  // --- MFA ---

  @Post('mfa/setup')
  @UseGuards(AdminAuthGuard)
  async setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupMfa(user.id);
  }

  @Post('mfa/enable')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async enableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaVerifySchema)) body: MfaVerifyInput,
    @Req() req: Request,
  ) {
    await this.auth.enableMfa(user.id, body.code, requestContext(req));
    return { ok: true };
  }

  @Post('mfa/disable')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaVerifySchema)) body: MfaVerifyInput,
    @Req() req: Request,
  ) {
    await this.auth.disableMfa(user.id, body.code, requestContext(req));
    return { ok: true };
  }

  // --- Sessions ---

  @Get('sessions')
  @UseGuards(AdminAuthGuard)
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.sessions.listActive({ userId: user.id });
    return {
      items: sessions.map((s) => ({ ...s, isCurrent: s.id === user.sessionId })),
    };
  }

  @Delete('sessions/others')
  @UseGuards(AdminAuthGuard)
  async revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.sessions.revokeAll({ userId: user.id }, user.sessionId);
    return { revoked: count };
  }

  @Delete('sessions/:id')
  @UseGuards(AdminAuthGuard)
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    // Users may only revoke their own sessions here.
    const sessions = await this.sessions.listActive({ userId: user.id });
    if (!sessions.some((s) => s.id === id)) {
      return { ok: true }; // No information leak about other users' sessions.
    }
    await this.sessions.revoke(id);
    return { ok: true };
  }
}
