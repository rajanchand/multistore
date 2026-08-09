import { Injectable } from '@nestjs/common';
import type { Prisma, StockMovementType } from '@repo/database';
import type { AdjustInventoryInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

type Tx = Prisma.TransactionClient;

export interface InventoryListQuery {
  page: number;
  pageSize: number;
  branchId?: string;
  search?: string;
  lowStockOnly?: boolean;
}

/**
 * All inventory mutations flow through this service:
 * - every change is wrapped in a transaction,
 * - oversell is prevented with conditional UPDATEs (atomic row-level checks),
 * - every change writes a StockMovement ledger row with before/after quantities.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, query: InventoryListQuery) {
    if (query.branchId) this.branchAccess.assertCanAccess(user, query.branchId);
    const where: Prisma.InventoryWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : this.branchAccess.branchFilter(user)),
      ...(query.search
        ? {
            variant: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
                { product: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
    };

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              product: { select: { id: true, name: true, images: true } },
            },
          },
        },
        orderBy: [{ available: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    // "Low stock" is relative to each row's threshold, so filter after fetch when requested.
    const items = query.lowStockOnly
      ? rawItems.filter((i) => i.available <= i.lowStockThreshold)
      : rawItems;

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async movements(user: AuthenticatedUser, params: { branchId?: string; variantId?: string; page: number; pageSize: number }) {
    if (params.branchId) this.branchAccess.assertCanAccess(user, params.branchId);
    const where: Prisma.StockMovementWhereInput = {
      ...(params.branchId ? { branchId: params.branchId } : this.branchAccess.branchFilter(user)),
      ...(params.variantId ? { variantId: params.variantId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          variant: { select: { id: true, name: true, sku: true } },
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }

  /** Manual adjustment (receiving, damage, loss, correction). */
  async adjust(user: AuthenticatedUser, input: AdjustInventoryInput, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, input.branchId);

    const variantId = await this.resolveVariantId(input.productId, input.variantId ?? null);

    const result = await this.prisma.$transaction(async (tx) => {
      const inventory = await this.ensureRow(tx, input.branchId, input.productId, variantId);

      if (input.delta < 0 && inventory.available + input.delta < 0) {
        throw Errors.conflict('NEGATIVE_STOCK', 'Adjustment would make available stock negative.');
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          available: { increment: input.delta },
          ...(input.movementType === 'DAMAGED' && input.delta < 0
            ? { damaged: { increment: -input.delta } }
            : {}),
        },
      });

      await tx.stockMovement.create({
        data: {
          branchId: input.branchId,
          productId: input.productId,
          variantId,
          type: input.movementType,
          quantityDelta: input.delta,
          quantityBefore: inventory.available,
          quantityAfter: updated.available,
          reason: input.reason,
          actorUserId: user.id,
        },
      });
      return updated;
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: input.branchId,
      action: 'INVENTORY_ADJUSTED',
      resourceType: 'Inventory',
      resourceId: result.id,
      newValue: { delta: input.delta, movementType: input.movementType, reason: input.reason },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return result;
  }

  /**
   * Reserve stock atomically (checkout). The conditional UPDATE is the oversell
   * guard: it only succeeds when enough unreserved stock exists at that instant.
   * Returns false when stock is insufficient — never throws mid-transaction.
   */
  async reserveWithinTx(
    tx: Tx,
    params: { branchId: string; productId: string; variantId: string; quantity: number; reference: string },
  ): Promise<boolean> {
    const updated = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "available" = "available" - ${params.quantity},
          "reserved" = "reserved" + ${params.quantity},
          "updatedAt" = NOW()
      WHERE "branchId" = ${params.branchId}
        AND "variantId" = ${params.variantId}
        AND "available" >= ${params.quantity}
    `;
    if (updated === 0) return false;

    const row = await tx.inventory.findUniqueOrThrow({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
    });
    await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        productId: params.productId,
        variantId: params.variantId,
        type: 'RESERVATION',
        quantityDelta: -params.quantity,
        quantityBefore: row.available + params.quantity,
        quantityAfter: row.available,
        reference: params.reference,
      },
    });
    return true;
  }

  /** Release a reservation back to available stock (payment failed / expired). */
  async releaseWithinTx(
    tx: Tx,
    params: { branchId: string; productId: string; variantId: string; quantity: number; reference: string },
  ): Promise<void> {
    const row = await tx.inventory.findUnique({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
    });
    if (!row) return;
    const releasable = Math.min(params.quantity, row.reserved);
    if (releasable <= 0) return;

    await tx.inventory.update({
      where: { id: row.id },
      data: { available: { increment: releasable }, reserved: { decrement: releasable } },
    });
    await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        productId: params.productId,
        variantId: params.variantId,
        type: 'RESERVATION_RELEASE',
        quantityDelta: releasable,
        quantityBefore: row.available,
        quantityAfter: row.available + releasable,
        reference: params.reference,
      },
    });
  }

  /** Convert a reservation into a sale (payment succeeded): reserved stock leaves the building. */
  async commitSaleWithinTx(
    tx: Tx,
    params: { branchId: string; productId: string; variantId: string; quantity: number; reference: string },
  ): Promise<void> {
    const row = await tx.inventory.findUnique({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
    });
    if (!row) return;
    const commit = Math.min(params.quantity, row.reserved);
    await tx.inventory.update({
      where: { id: row.id },
      data: { reserved: { decrement: commit } },
    });
    await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        productId: params.productId,
        variantId: params.variantId,
        type: 'SALE',
        quantityDelta: -commit,
        quantityBefore: row.available + row.reserved,
        quantityAfter: row.available + row.reserved - commit,
        reference: params.reference,
      },
    });
  }

  /** Restock after an approved refund/return. */
  async restock(
    user: AuthenticatedUser | null,
    params: { branchId: string; productId: string; variantId: string; quantity: number; reference: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const inventory = await this.ensureRow(tx, params.branchId, params.productId, params.variantId);
      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { available: { increment: params.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          branchId: params.branchId,
          productId: params.productId,
          variantId: params.variantId,
          type: 'REFUND_RESTOCK',
          quantityDelta: params.quantity,
          quantityBefore: inventory.available,
          quantityAfter: updated.available,
          reference: params.reference,
          actorUserId: user?.id,
        },
      });
    });
  }

  async setLowStockThreshold(
    user: AuthenticatedUser,
    params: { branchId: string; productId: string; variantId: string | null; lowStockThreshold: number },
  ) {
    this.branchAccess.assertCanAccess(user, params.branchId);
    const variantId = await this.resolveVariantId(params.productId, params.variantId);
    return this.prisma.inventory.update({
      where: { branchId_variantId: { branchId: params.branchId, variantId } },
      data: { lowStockThreshold: params.lowStockThreshold },
    });
  }

  private async resolveVariantId(productId: string, variantId: string | null): Promise<string> {
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId, deletedAt: null },
      });
      if (!variant) throw Errors.notFound('Variant');
      return variant.id;
    }
    const defaultVariant = await this.prisma.productVariant.findFirst({
      where: { productId, isDefault: true, deletedAt: null },
    });
    if (!defaultVariant) throw Errors.notFound('Default variant');
    return defaultVariant.id;
  }

  private async ensureRow(tx: Tx, branchId: string, productId: string, variantId: string) {
    return tx.inventory.upsert({
      where: { branchId_variantId: { branchId, variantId } },
      create: { branchId, productId, variantId },
      update: {},
    });
  }
}

export type { StockMovementType };
