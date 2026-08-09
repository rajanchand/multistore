import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import type { Prisma } from '@repo/database';
import type { BulkOperationAction } from '@repo/types';
import type { BulkOperationInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { REDIS } from '../../redis/redis.module';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

export const BULK_QUEUE = 'bulk-operations';

/**
 * Multi-branch bulk catalogue mutations. The HTTP request only validates,
 * previews impact, and enqueues work. Processing happens in BullMQ so huge
 * operations never block a request and are retry-safe per item.
 */
@Injectable()
export class BulkOperationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('BulkOperations');
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_WORKERS === '1') return;

    this.queue = new Queue(BULK_QUEUE, { connection: this.redis });
    this.worker = new Worker(
      BULK_QUEUE,
      async (job) => {
        await this.process(job.data.operationId as string);
      },
      { connection: this.redis, concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Bulk job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async preview(user: AuthenticatedUser, input: BulkOperationInput) {
    this.branchAccess.assertCanAccessAll(user, input.branchIds);
    const productIds = await this.resolveProductIds(input);
    const affected = productIds.length * input.branchIds.length;
    return {
      action: input.action,
      branchCount: input.branchIds.length,
      productCount: productIds.length,
      affectedRecords: affected,
      payload: input.payload,
      warning:
        affected > 5000
          ? 'This operation affects a large number of records and will run in the background.'
          : undefined,
    };
  }

  async enqueue(user: AuthenticatedUser, input: BulkOperationInput, ctx: RequestContext) {
    this.branchAccess.assertCanAccessAll(user, input.branchIds);
    const productIds = await this.resolveProductIds(input);
    if (productIds.length === 0) {
      throw Errors.badRequest('NO_PRODUCTS', 'No products matched the selection.');
    }

    // Destructive actions require an explicit confirmation flag in payload.
    const destructive: BulkOperationAction[] = ['ARCHIVE', 'HIDE', 'REMOVE_PROMOTION'];
    if (destructive.includes(input.action as BulkOperationAction) && input.payload.confirm !== true) {
      throw Errors.badRequest('CONFIRMATION_REQUIRED', 'Destructive bulk actions require payload.confirm = true.');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId: { in: productIds }, deletedAt: null },
      select: { id: true, productId: true },
    });

    const operation = await this.prisma.$transaction(async (tx) => {
      const op = await tx.bulkOperation.create({
        data: {
          action: input.action,
          status: 'QUEUED',
          actorUserId: user.id,
          payload: {
            branchIds: input.branchIds,
            productIds,
            categoryIds: input.categoryIds,
            payload: input.payload,
          } as Prisma.InputJsonValue,
          totalItems: variants.length * input.branchIds.length,
        },
      });

      const items = [];
      for (const branchId of input.branchIds) {
        for (const variant of variants) {
          items.push({
            operationId: op.id,
            branchId,
            productId: variant.productId,
            variantId: variant.id,
          });
        }
      }
      // Chunk inserts to avoid oversized queries.
      const chunkSize = 1000;
      for (let i = 0; i < items.length; i += chunkSize) {
        await tx.bulkOperationItem.createMany({ data: items.slice(i, i + chunkSize) });
      }
      return op;
    });

    await this.queue!.add(
      'process',
      { operationId: operation.id },
      {
        jobId: `bulk:${operation.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );

    await this.audit.log({
      actorUserId: user.id,
      action: 'BULK_OPERATION_STARTED',
      resourceType: 'BulkOperation',
      resourceId: operation.id,
      newValue: {
        action: input.action,
        branches: input.branchIds.length,
        products: productIds.length,
        totalItems: operation.totalItems,
      },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    return operation;
  }

  async get(user: AuthenticatedUser, id: string) {
    const op = await this.prisma.bulkOperation.findUnique({
      where: { id },
      include: {
        items: {
          take: 50,
          orderBy: { createdAt: 'asc' },
          where: { status: { in: ['FAILED', 'SUCCEEDED', 'PENDING'] } },
        },
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!op) throw Errors.notFound('Bulk operation');
    if (!user.isGlobal && op.actorUserId !== user.id) {
      // Branch users may inspect ops that touch their branches.
      const touches = await this.prisma.bulkOperationItem.count({
        where: { operationId: id, branchId: { in: [...user.branchIds] } },
      });
      if (touches === 0) throw Errors.forbidden();
    }
    return op;
  }

  async list(user: AuthenticatedUser, page: number, pageSize: number) {
    const where = user.isGlobal ? {} : { actorUserId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.bulkOperation.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.bulkOperation.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private async resolveProductIds(input: BulkOperationInput): Promise<string[]> {
    if (input.productIds.length > 0) return [...new Set(input.productIds)];
    if (input.categoryIds.length > 0) {
      const rows = await this.prisma.productCategory.findMany({
        where: { categoryId: { in: input.categoryIds }, product: { deletedAt: null } },
        select: { productId: true },
      });
      return [...new Set(rows.map((r) => r.productId))];
    }
    return [];
  }

  private async process(operationId: string): Promise<void> {
    const op = await this.prisma.bulkOperation.findUnique({ where: { id: operationId } });
    if (!op || op.status === 'COMPLETED' || op.status === 'FAILED') return;

    await this.prisma.bulkOperation.update({
      where: { id: operationId },
      data: { status: 'PROCESSING', startedAt: op.startedAt ?? new Date() },
    });

    const payload = op.payload as {
      payload: Record<string, unknown>;
    };
    let processed = op.processedItems;
    let failed = op.failedItems;

    // Process in batches for memory safety.
    for (;;) {
      const batch = await this.prisma.bulkOperationItem.findMany({
        where: { operationId, status: 'PENDING' },
        take: 100,
      });
      if (batch.length === 0) break;

      for (const item of batch) {
        try {
          const oldValue = await this.applyItem(op.action, item, payload.payload);
          await this.prisma.bulkOperationItem.update({
            where: { id: item.id },
            data: {
              status: 'SUCCEEDED',
              oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
              newValue: payload.payload as Prisma.InputJsonValue,
            },
          });
          processed += 1;
        } catch (error) {
          await this.prisma.bulkOperationItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error) },
          });
          failed += 1;
        }
      }

      await this.prisma.bulkOperation.update({
        where: { id: operationId },
        data: { processedItems: processed, failedItems: failed },
      });
    }

    const status =
      failed === 0 ? 'COMPLETED' : processed === 0 ? 'FAILED' : 'PARTIAL_FAILURE';
    await this.prisma.bulkOperation.update({
      where: { id: operationId },
      data: { status, completedAt: new Date(), processedItems: processed, failedItems: failed },
    });

    await this.audit.log({
      actorUserId: op.actorUserId,
      action: 'BULK_OPERATION_COMPLETED',
      resourceType: 'BulkOperation',
      resourceId: operationId,
      newValue: { status, processed, failed },
    });
  }

  private async applyItem(
    action: string,
    item: { branchId: string; productId: string; variantId: string | null },
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!item.variantId) return null;

    switch (action) {
      case 'ADD_PRODUCT':
      case 'CHANGE_PRICE':
      case 'SET_SALE_PRICE':
      case 'PERCENTAGE_ADJUSTMENT':
      case 'PUBLISH':
      case 'HIDE':
      case 'CHANGE_AVAILABILITY': {
        const existing = await this.prisma.branchProduct.findUnique({
          where: { branchId_variantId: { branchId: item.branchId, variantId: item.variantId } },
        });
        const variant = await this.prisma.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
        });
        let sellingPrice = existing?.sellingPrice ?? variant.defaultPrice;
        let salePrice = existing?.salePrice ?? null;
        let isVisible = existing?.isVisible ?? true;
        let isAvailable = existing?.isAvailable ?? true;

        if (action === 'CHANGE_PRICE' && typeof payload.sellingPrice === 'number') {
          sellingPrice = payload.sellingPrice;
        }
        if (action === 'SET_SALE_PRICE') {
          salePrice = typeof payload.salePrice === 'number' ? payload.salePrice : null;
        }
        if (action === 'PERCENTAGE_ADJUSTMENT' && typeof payload.percentBps === 'number') {
          sellingPrice = Math.max(0, Math.round((sellingPrice * (10000 + payload.percentBps)) / 10000));
        }
        if (action === 'PUBLISH') isVisible = true;
        if (action === 'HIDE') isVisible = false;
        if (action === 'CHANGE_AVAILABILITY' && typeof payload.isAvailable === 'boolean') {
          isAvailable = payload.isAvailable;
        }

        await this.prisma.branchProduct.upsert({
          where: { branchId_variantId: { branchId: item.branchId, variantId: item.variantId } },
          create: {
            branchId: item.branchId,
            productId: item.productId,
            variantId: item.variantId,
            sellingPrice,
            salePrice,
            isVisible,
            isAvailable,
          },
          update: { sellingPrice, salePrice, isVisible, isAvailable },
        });
        await this.prisma.inventory.upsert({
          where: { branchId_variantId: { branchId: item.branchId, variantId: item.variantId } },
          create: { branchId: item.branchId, productId: item.productId, variantId: item.variantId },
          update: {},
        });
        return existing
          ? {
              sellingPrice: existing.sellingPrice,
              salePrice: existing.salePrice,
              isVisible: existing.isVisible,
              isAvailable: existing.isAvailable,
            }
          : null;
      }
      case 'ARCHIVE': {
        const product = await this.prisma.product.update({
          where: { id: item.productId },
          data: { status: 'ARCHIVED', deletedAt: new Date() },
        });
        return { status: product.status };
      }
      case 'CHANGE_CATEGORY': {
        const categoryId = payload.categoryId;
        if (typeof categoryId !== 'string') throw new Error('categoryId required');
        await this.prisma.productCategory.upsert({
          where: { productId_categoryId: { productId: item.productId, categoryId } },
          create: { productId: item.productId, categoryId },
          update: {},
        });
        return null;
      }
      case 'APPLY_PROMOTION':
      case 'REMOVE_PROMOTION': {
        const promotionId = payload.promotionId;
        if (typeof promotionId !== 'string') throw new Error('promotionId required');
        if (action === 'APPLY_PROMOTION') {
          await this.prisma.promotionProduct.upsert({
            where: { promotionId_productId: { promotionId, productId: item.productId } },
            create: { promotionId, productId: item.productId },
            update: {},
          });
          await this.prisma.promotionBranch.upsert({
            where: { promotionId_branchId: { promotionId, branchId: item.branchId } },
            create: { promotionId, branchId: item.branchId },
            update: {},
          });
        } else {
          await this.prisma.promotionProduct.deleteMany({
            where: { promotionId, productId: item.productId },
          });
        }
        return null;
      }
      default:
        throw new Error(`Unsupported bulk action: ${action}`);
    }
  }
}
