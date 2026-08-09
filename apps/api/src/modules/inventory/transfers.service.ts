import { Injectable } from '@nestjs/common';
import type { StockTransferStatus } from '@repo/database';
import { STOCK_TRANSFER_TRANSITIONS } from '@repo/types';
import type { CreateTransferInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

/**
 * Stock transfers between branches.
 * State machine: REQUESTED → APPROVED → PREPARING → IN_TRANSIT → RECEIVED
 * (REJECTED/CANCELLED as terminal branches). Stock leaves the source at
 * IN_TRANSIT and arrives at the destination at RECEIVED — both are ledgered.
 */
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, params: { page: number; pageSize: number; status?: StockTransferStatus }) {
    const branchIds = user.isGlobal ? undefined : [...user.branchIds];
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(branchIds
        ? { OR: [{ fromBranchId: { in: branchIds } }, { toBranchId: { in: branchIds } }] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          fromBranch: { select: { id: true, name: true, code: true } },
          toBranch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { variant: { select: { id: true, name: true, sku: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }

  async create(user: AuthenticatedUser, input: CreateTransferInput, ctx: RequestContext) {
    if (input.fromBranchId === input.toBranchId) {
      throw Errors.badRequest('SAME_BRANCH', 'Source and destination branches must differ.');
    }
    // Requester needs access to at least one side; typically the requesting branch.
    if (!user.isGlobal && !user.branchIds.has(input.fromBranchId) && !user.branchIds.has(input.toBranchId)) {
      throw Errors.branchAccessDenied();
    }

    const items = await Promise.all(
      input.items.map(async (item) => {
        const variantId =
          item.variantId ??
          (
            await this.prisma.productVariant.findFirstOrThrow({
              where: { productId: item.productId, isDefault: true, deletedAt: null },
            })
          ).id;
        return { productId: item.productId, variantId, quantity: item.quantity };
      }),
    );

    const count = await this.prisma.stockTransfer.count();
    const transfer = await this.prisma.stockTransfer.create({
      data: {
        number: `TRF-${String(count + 1).padStart(6, '0')}`,
        fromBranchId: input.fromBranchId,
        toBranchId: input.toBranchId,
        notes: input.notes,
        createdById: user.id,
        items: { create: items },
      },
      include: { items: true },
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: input.fromBranchId,
      action: 'STOCK_TRANSFER_REQUESTED',
      resourceType: 'StockTransfer',
      resourceId: transfer.id,
      newValue: { number: transfer.number, to: input.toBranchId, items: items.length },
      requestId: ctx.requestId,
    });
    return transfer;
  }

  async transition(
    user: AuthenticatedUser,
    transferId: string,
    nextStatus: StockTransferStatus,
    notes: string | undefined,
    ctx: RequestContext,
  ) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });
    if (!transfer) throw Errors.notFound('Stock transfer');

    // Approval/dispatch requires source-branch access; receiving requires destination access.
    const sourceActions: StockTransferStatus[] = ['APPROVED', 'PREPARING', 'IN_TRANSIT', 'REJECTED', 'CANCELLED'];
    if (sourceActions.includes(nextStatus)) {
      this.branchAccess.assertCanAccess(user, transfer.fromBranchId);
    }
    if (nextStatus === 'RECEIVED') {
      this.branchAccess.assertCanAccess(user, transfer.toBranchId);
    }

    const allowed = STOCK_TRANSFER_TRANSITIONS[transfer.status as keyof typeof STOCK_TRANSFER_TRANSITIONS];
    if (!allowed.includes(nextStatus)) {
      throw Errors.invalidTransition(transfer.status, nextStatus);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextStatus === 'IN_TRANSIT') {
        // Deduct from source atomically; abort if any line lacks stock.
        for (const item of transfer.items) {
          const deducted = await tx.$executeRaw`
            UPDATE "Inventory"
            SET "available" = "available" - ${item.quantity}, "updatedAt" = NOW()
            WHERE "branchId" = ${transfer.fromBranchId}
              AND "variantId" = ${item.variantId}
              AND "available" >= ${item.quantity}
          `;
          if (deducted === 0) {
            const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
            throw Errors.insufficientStock(variant?.sku);
          }
          const row = await tx.inventory.findUniqueOrThrow({
            where: { branchId_variantId: { branchId: transfer.fromBranchId, variantId: item.variantId } },
          });
          await tx.stockMovement.create({
            data: {
              branchId: transfer.fromBranchId,
              productId: item.productId,
              variantId: item.variantId,
              type: 'TRANSFER_OUT',
              quantityDelta: -item.quantity,
              quantityBefore: row.available + item.quantity,
              quantityAfter: row.available,
              reference: transfer.number,
              actorUserId: user.id,
            },
          });
          // Track incoming quantity at the destination.
          await tx.inventory.upsert({
            where: { branchId_variantId: { branchId: transfer.toBranchId, variantId: item.variantId } },
            create: {
              branchId: transfer.toBranchId,
              productId: item.productId,
              variantId: item.variantId,
              incoming: item.quantity,
            },
            update: { incoming: { increment: item.quantity } },
          });
        }
      }

      if (nextStatus === 'RECEIVED') {
        for (const item of transfer.items) {
          const row = await tx.inventory.upsert({
            where: { branchId_variantId: { branchId: transfer.toBranchId, variantId: item.variantId } },
            create: { branchId: transfer.toBranchId, productId: item.productId, variantId: item.variantId },
            update: {},
          });
          await tx.inventory.update({
            where: { id: row.id },
            data: {
              available: { increment: item.quantity },
              incoming: { decrement: Math.min(item.quantity, row.incoming) },
            },
          });
          await tx.stockMovement.create({
            data: {
              branchId: transfer.toBranchId,
              productId: item.productId,
              variantId: item.variantId,
              type: 'TRANSFER_IN',
              quantityDelta: item.quantity,
              quantityBefore: row.available,
              quantityAfter: row.available + item.quantity,
              reference: transfer.number,
              actorUserId: user.id,
            },
          });
          await tx.stockTransferItem.update({
            where: { id: item.id },
            data: { receivedQuantity: item.quantity },
          });
        }
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: nextStatus,
          notes: notes ?? transfer.notes,
          ...(nextStatus === 'RECEIVED' ? { receivedAt: new Date() } : {}),
        },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: transfer.fromBranchId,
      action: `STOCK_TRANSFER_${nextStatus}`,
      resourceType: 'StockTransfer',
      resourceId: transferId,
      oldValue: { status: transfer.status },
      newValue: { status: nextStatus },
      requestId: ctx.requestId,
    });
    return updated;
  }
}
