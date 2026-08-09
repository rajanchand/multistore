import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import type { GenerateSmsInput, SendSmsInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { REDIS } from '../../redis/redis.module';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';
import { createSmsProviderFromEnv, type SmsProvider } from './sms-provider';
import { generateSmsWithGemini, type SmsGenerateContext } from './gemini-sms.provider';
import { DEFAULT_STORE_DETAILS, SETTING_KEYS } from '../content/settings.defaults';

export const SMS_QUEUE = 'sms';

@Injectable()
export class SmsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SMS');
  private readonly queue: Queue;
  private worker: Worker | null = null;
  private readonly provider: SmsProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    this.queue = new Queue(SMS_QUEUE, { connection: this.redis });
    this.provider = createSmsProviderFromEnv();
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_WORKERS === '1') return;
    this.worker = new Worker(
      SMS_QUEUE,
      async (job) => {
        const messageId = job.data.messageId as string;
        await this.deliver(messageId);
      },
      { connection: this.redis, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`SMS job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }

  list(user: AuthenticatedUser, page = 1, pageSize = 50) {
    const where = user.isGlobal ? {} : { branchId: { in: [...user.branchIds] } };
    return Promise.all([
      this.prisma.smsMessage.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.smsMessage.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }));
  }

  async generate(user: AuthenticatedUser, input: GenerateSmsInput) {
    if (input.branchId) this.branchAccess.assertCanAccess(user, input.branchId);

    const [storeSetting, branch, campaign, promotion] = await Promise.all([
      this.prisma.setting.findFirst({
        where: { key: SETTING_KEYS.store, branchId: null },
        select: { value: true },
      }),
      input.branchId
        ? this.prisma.branch.findFirst({
            where: { id: input.branchId, deletedAt: null },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
      input.campaignId
        ? this.prisma.campaign.findFirst({
            where: { id: input.campaignId, deletedAt: null },
            select: { id: true, name: true, description: true, content: true, audience: true },
          })
        : Promise.resolve(null),
      input.promotionId
        ? this.prisma.promotion.findFirst({
            where: { id: input.promotionId, deletedAt: null },
            include: {
              coupons: {
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (input.campaignId && !campaign) throw Errors.notFound('Campaign');
    if (input.promotionId && !promotion) throw Errors.notFound('Promotion');
    if (input.branchId && !branch) throw Errors.notFound('Branch');

    const storeValue = (storeSetting?.value ?? {}) as Record<string, unknown>;
    const storeName =
      typeof storeValue.storeName === 'string' && storeValue.storeName.trim()
        ? storeValue.storeName.trim()
        : DEFAULT_STORE_DETAILS.storeName;

    const content = (campaign?.content ?? null) as { body?: string; subject?: string } | null;
    const audience = (campaign?.audience ?? null) as { segment?: string } | null;
    const segment = input.segment ?? audience?.segment;

    const offerSummary = promotion ? this.formatOfferSummary(promotion) : undefined;

    const genCtx: SmsGenerateContext = {
      storeName,
      mode: input.mode,
      segment,
      branchName: branch ? `${branch.name} (${branch.code})` : undefined,
      campaignName: campaign?.name,
      campaignDescription: campaign?.description ?? undefined,
      campaignBodyHint: content?.body ?? content?.subject,
      offerName: promotion?.name,
      offerDescription: promotion?.description ?? undefined,
      offerSummary,
      couponCode: promotion?.coupons[0]?.code,
      notes: input.notes,
    };

    const result = await generateSmsWithGemini(genCtx);
    return {
      body: result.body,
      provider: result.provider,
      model: result.model ?? null,
      context: {
        storeName,
        mode: input.mode,
        segment: segment ?? null,
        branchId: branch?.id ?? null,
        campaignId: campaign?.id ?? null,
        promotionId: promotion?.id ?? null,
        couponCode: promotion?.coupons[0]?.code ?? null,
      },
    };
  }

  private formatOfferSummary(promotion: {
    type: string;
    value: number;
    buyQuantity: number | null;
    getQuantity: number | null;
    minimumSpend: number | null;
  }): string {
    switch (promotion.type) {
      case 'PERCENTAGE':
        return `${(promotion.value / 100).toFixed(promotion.value % 100 === 0 ? 0 : 1)}% off`;
      case 'FIXED_AMOUNT':
        return `£${(promotion.value / 100).toFixed(2)} off`;
      case 'BOGO':
        return 'Buy one get one';
      case 'BUY_X_GET_Y':
        return `Buy ${promotion.buyQuantity ?? 'X'} get ${promotion.getQuantity ?? 'Y'}`;
      case 'FREE_DELIVERY':
        return 'Free delivery';
      default:
        return promotion.type.replace(/_/g, ' ').toLowerCase();
    }
  }

  async send(user: AuthenticatedUser, input: SendSmsInput, ctx: RequestContext) {
    if (input.branchId) this.branchAccess.assertCanAccess(user, input.branchId);

    const recipients = await this.resolveRecipients(user, input);
    if (recipients.length === 0) {
      throw Errors.badRequest('NO_RECIPIENTS', 'No recipients matched the send criteria.');
    }

    const batchId = recipients.length > 1 ? randomUUID() : null;
    const created = await this.prisma.smsMessage.createManyAndReturn({
      data: recipients.map((r) => ({
        batchId,
        toPhone: r.phone,
        body: input.body,
        status: 'QUEUED' as const,
        provider: this.provider.name,
        customerId: r.customerId,
        branchId: r.branchId ?? input.branchId ?? null,
        campaignId: input.campaignId ?? null,
        segment: input.segment ? { segment: input.segment } : undefined,
        createdById: user.id,
      })),
    });

    for (const msg of created) {
      await this.queue.add(
        'send',
        { messageId: msg.id },
        {
          jobId: `sms:${msg.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 3_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    }

    await this.audit.log({
      actorUserId: user.id,
      branchId: input.branchId,
      action: 'SMS_QUEUED',
      resourceType: 'SmsMessage',
      resourceId: batchId ?? created[0]?.id,
      newValue: { count: created.length, segment: input.segment ?? null },
      requestId: ctx.requestId,
    });

    return { batchId, queued: created.length, items: created };
  }

  private async assertCustomerInScope(user: AuthenticatedUser, customerId: string): Promise<void> {
    if (user.isGlobal) return;
    const accessible = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        OR: [
          { preferredBranchId: { in: [...user.branchIds] } },
          { orders: { some: { branchId: { in: [...user.branchIds] } } } },
        ],
      },
      select: { id: true },
    });
    if (!accessible) throw Errors.branchAccessDenied();
  }

  private async resolveRecipients(
    user: AuthenticatedUser,
    input: SendSmsInput,
  ): Promise<Array<{ phone: string; customerId?: string; branchId?: string }>> {
    if (input.toPhone) {
      if (input.customerId) await this.assertCustomerInScope(user, input.customerId);
      else if (!user.isGlobal) {
        throw Errors.forbidden('Branch users must send SMS to customers within their branches.');
      }
      return [{ phone: input.toPhone.replace(/\s+/g, ''), customerId: input.customerId }];
    }

    if (input.customerId) {
      await this.assertCustomerInScope(user, input.customerId);
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, deletedAt: null },
        select: { id: true, phone: true, preferredBranchId: true },
      });
      if (!customer?.phone) {
        throw Errors.badRequest('NO_PHONE', 'Customer has no phone number on file.');
      }
      return [
        {
          phone: customer.phone.replace(/\s+/g, ''),
          customerId: customer.id,
          branchId: customer.preferredBranchId ?? undefined,
        },
      ];
    }

    if (!input.segment) return [];

    const where = {
      deletedAt: null,
      isActive: true,
      phone: { not: null },
      ...(input.segment === 'marketing_opt_in' ? { marketingOptIn: true } : {}),
      ...(input.segment === 'branch_customers' && input.branchId
        ? {
            OR: [
              { preferredBranchId: input.branchId },
              { orders: { some: { branchId: input.branchId } } },
            ],
          }
        : {}),
    };

    if (!user.isGlobal && input.segment !== 'branch_customers') {
      // Non-global users may only bulk-send within their branches.
      throw Errors.forbidden('Branch users must use the branch_customers segment.');
    }

    const customers = await this.prisma.customer.findMany({
      where,
      select: { id: true, phone: true, preferredBranchId: true },
      take: 500,
    });

    return customers
      .filter((c): c is typeof c & { phone: string } => Boolean(c.phone))
      .map((c) => ({
        phone: c.phone.replace(/\s+/g, ''),
        customerId: c.id,
        branchId: c.preferredBranchId ?? input.branchId ?? undefined,
      }));
  }

  private async deliver(messageId: string): Promise<void> {
    const msg = await this.prisma.smsMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.status === 'SENT' || msg.status === 'CANCELLED') return;

    await this.prisma.smsMessage.update({
      where: { id: messageId },
      data: { status: 'SENDING' },
    });

    try {
      const result = await this.provider.send(msg.toPhone, msg.body);
      await this.prisma.smsMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      await this.prisma.smsMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
