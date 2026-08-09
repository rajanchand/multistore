import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BranchAccessService } from '../../common/services/branch-access.service';
import type { AuthenticatedUser } from '../../common/auth-context';

const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/**
 * Admin global search (Cmd/Ctrl+K). Abstraction is DB ILIKE for now;
 * can be swapped for OpenSearch/Typesense without changing the API.
 */
@ApiTags('search')
@Controller('search')
@UseGuards(AdminAuthGuard)
export class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get()
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(searchSchema)) query: z.infer<typeof searchSchema>,
  ) {
    const q = query.q;
    const branchFilter = user.isGlobal ? {} : { id: { in: [...user.branchIds] } };
    const orderBranchFilter = this.branchAccess.branchFilter(user);
    const productBranchScope = user.isGlobal
      ? {}
      : { branchProducts: { some: { branchId: { in: [...user.branchIds] } } } };
    const customerBranchScope = user.isGlobal
      ? {}
      : {
          OR: [
            { preferredBranchId: { in: [...user.branchIds] } },
            { orders: { some: { branchId: { in: [...user.branchIds] } } } },
          ],
        };

    const [products, orders, customers, branches] = await Promise.all([
      user.permissions.has('product.read')
        ? this.prisma.product.findMany({
            where: {
              deletedAt: null,
              ...productBranchScope,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, sku: true, status: true },
            take: query.limit,
          })
        : Promise.resolve([]),
      user.permissions.has('order.read')
        ? this.prisma.order.findMany({
            where: {
              ...orderBranchFilter,
              OR: [
                { orderNumber: { contains: q, mode: 'insensitive' } },
                { contactEmail: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, orderNumber: true, status: true, total: true },
            take: query.limit,
          })
        : Promise.resolve([]),
      user.permissions.has('customer.read')
        ? this.prisma.customer.findMany({
            where: {
              deletedAt: null,
              ...customerBranchScope,
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, email: true, firstName: true, lastName: true },
            take: query.limit,
          })
        : Promise.resolve([]),
      user.permissions.has('branch.read')
        ? this.prisma.branch.findMany({
            where: {
              deletedAt: null,
              ...branchFilter,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, code: true, city: true },
            take: query.limit,
          })
        : Promise.resolve([]),
    ]);

    return {
      products: products.map((p) => ({ type: 'product' as const, ...p })),
      orders: orders.map((o) => ({ type: 'order' as const, ...o })),
      customers: customers.map((c) => ({ type: 'customer' as const, ...c })),
      branches: branches.map((b) => ({ type: 'branch' as const, ...b })),
    };
  }
}
