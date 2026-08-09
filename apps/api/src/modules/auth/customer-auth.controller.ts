import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@repo/validation';
import { CustomerAuthService } from './customer-auth.service';
import { SessionService } from '../sessions/session.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomerAuthGuard, CUSTOMER_SESSION_COOKIE } from '../../common/guards/customer-auth.guard';
import { CurrentCustomer } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedCustomer, RequestContext } from '../../common/auth-context';
import { clearSessionCookie, setSessionCookie } from './auth.controller';

function requestContext(req: Request): RequestContext {
  return {
    requestId: (req as Request & { requestId?: string }).requestId,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}

@ApiTags('customer-auth')
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, customer } = await this.auth.register(body, requestContext(req));
    setSessionCookie(res, CUSTOMER_SESSION_COOKIE, token, this.sessions.ttlFor('CUSTOMER'));
    return { customer, token };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, customer } = await this.auth.login(body.email, body.password, requestContext(req));
    setSessionCookie(res, CUSTOMER_SESSION_COOKIE, token, this.sessions.ttlFor('CUSTOMER'));
    return { customer, token };
  }

  @Post('logout')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(200)
  async logout(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.revoke(customer.sessionId);
    clearSessionCookie(res, CUSTOMER_SESSION_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  me(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return customer;
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

  @Get('sessions')
  @UseGuards(CustomerAuthGuard)
  async listSessions(@CurrentCustomer() customer: AuthenticatedCustomer) {
    const sessions = await this.sessions.listActive({ customerId: customer.id });
    return { items: sessions.map((s) => ({ ...s, isCurrent: s.id === customer.sessionId })) };
  }

  @Delete('sessions/others')
  @UseGuards(CustomerAuthGuard)
  async revokeOthers(@CurrentCustomer() customer: AuthenticatedCustomer) {
    const count = await this.sessions.revokeAll({ customerId: customer.id }, customer.sessionId);
    return { revoked: count };
  }
}
