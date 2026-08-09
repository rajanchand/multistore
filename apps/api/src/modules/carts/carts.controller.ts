import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import {
  addCartItemSchema,
  applyCouponSchema,
  updateCartItemSchema,
  uuidSchema,
  type AddCartItemInput,
  type ApplyCouponInput,
  type UpdateCartItemInput,
} from '@repo/validation';
import { CartsService } from './carts.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createCartSchema = z.object({ branchId: uuidSchema });
const switchBranchSchema = z.object({ branchId: uuidSchema });

/**
 * Cart endpoints. The cart is identified by the opaque `x-cart-token` header,
 * which the storefront stores in an httpOnly cookie on its own domain.
 */
@ApiTags('carts')
@Controller('carts')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post()
  async create(@Body(new ZodValidationPipe(createCartSchema)) body: { branchId: string }) {
    const { cart, token } = await this.carts.createCart(body.branchId);
    const view = await this.carts.view(cart);
    return { cart: view, token };
  }

  @Get('current')
  async current(@Headers('x-cart-token') token?: string) {
    const cart = await this.carts.requireCart(token);
    return this.carts.view(cart);
  }

  @Post('items')
  async addItem(
    @Body(new ZodValidationPipe(addCartItemSchema)) body: AddCartItemInput,
    @Headers('x-cart-token') token?: string,
  ) {
    const cart = await this.carts.requireCart(token);
    await this.carts.addItem(cart, body);
    return this.carts.view(cart);
  }

  @Patch('items/:id')
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCartItemSchema)) body: UpdateCartItemInput,
    @Headers('x-cart-token') token?: string,
  ) {
    const cart = await this.carts.requireCart(token);
    await this.carts.updateItem(cart, id, body.quantity);
    return this.carts.view(cart);
  }

  @Delete('items/:id')
  async removeItem(@Param('id', ParseUUIDPipe) id: string, @Headers('x-cart-token') token?: string) {
    const cart = await this.carts.requireCart(token);
    await this.carts.removeItem(cart, id);
    return this.carts.view(cart);
  }

  @Post('coupon')
  @HttpCode(200)
  async applyCoupon(
    @Body(new ZodValidationPipe(applyCouponSchema)) body: ApplyCouponInput,
    @Headers('x-cart-token') token?: string,
  ) {
    const cart = await this.carts.requireCart(token);
    const updated = await this.carts.applyCoupon(cart, body.code);
    return this.carts.view(updated);
  }

  @Delete('coupon')
  async removeCoupon(@Headers('x-cart-token') token?: string) {
    const cart = await this.carts.requireCart(token);
    const updated = await this.carts.removeCoupon(cart);
    return this.carts.view(updated);
  }

  @Post('branch')
  @HttpCode(200)
  async switchBranch(
    @Body(new ZodValidationPipe(switchBranchSchema)) body: { branchId: string },
    @Headers('x-cart-token') token?: string,
  ) {
    const cart = await this.carts.requireCart(token);
    const updated = await this.carts.switchBranch(cart, body.branchId);
    return this.carts.view(updated);
  }
}
