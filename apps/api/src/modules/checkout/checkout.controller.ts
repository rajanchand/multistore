import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { checkoutSchema, type CheckoutInput } from '@repo/validation';
import { CheckoutService } from './checkout.service';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { CurrentCustomer } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer } from '../../common/auth-context';

@ApiTags('checkout')
@Controller('checkout')
@UseGuards(ThrottlerGuard, CustomerAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /** Create the order + payment intent. Requires an authenticated customer. */
  @Post()
  @HttpCode(200)
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.checkout.checkout(customer, cartToken, body);
  }

  /** Verify payment state server-side after the client-side payment flow. */
  @Post('orders/:orderId/confirm')
  @HttpCode(200)
  confirm(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.checkout.confirmOrder(customer, orderId);
  }
}
