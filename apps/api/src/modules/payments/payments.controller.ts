import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { paginationSchema, uuidSchema } from '@repo/validation';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BranchAccessService } from '../../common/services/branch-access.service';
import type { AuthenticatedUser } from '../../common/auth-context';

const paymentsQuerySchema = paginationSchema.extend({
  branchId: uuidSchema.optional(),
  status: z
    .enum([
      'PENDING',
      'REQUIRES_ACTION',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ])
    .optional(),
});

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  /** Stripe webhook — signature-verified, idempotent. Public endpoint by design. */
  @Post('webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException({ code: 'MISSING_SIGNATURE', message: 'Missing webhook signature.' });
    }
    return this.payments.handleWebhook(req.rawBody, signature);
  }

  /** Admin payment ledger, branch-scoped. */
  @Get()
  @UseGuards(AdminAuthGuard, PermissionsGuard)
  @RequirePermissions('payment.read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paymentsQuerySchema)) query: z.infer<typeof paymentsQuerySchema>,
  ) {
    if (query.branchId) this.branchAccess.assertCanAccess(user, query.branchId);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      order: query.branchId
        ? { branchId: query.branchId }
        : user.isGlobal
          ? {}
          : { branchId: { in: [...user.branchIds] } },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              branchId: true,
              branch: { select: { name: true, code: true } },
              customer: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          refunds: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
