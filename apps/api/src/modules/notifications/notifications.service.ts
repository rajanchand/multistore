import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';

export const NOTIFICATIONS_QUEUE = 'notifications';

export type OrderEventType =
  | 'order.created'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'order.dispatched'
  | 'order.ready_for_collection'
  | 'refund.completed';

/**
 * Notification dispatch. Checkout and payment flows only enqueue jobs — email
 * delivery happens in the background worker so no user-facing request waits
 * on an email provider.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger('Notifications');
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    this.queue = new Queue(NOTIFICATIONS_QUEUE, { connection: this.redis });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  async queueOrderEvent(type: OrderEventType, orderId: string): Promise<void> {
    try {
      await this.queue.add(
        type,
        { type, orderId },
        {
          // One job per (event, order): retried deliveries never duplicate.
          jobId: `${type}:${orderId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue notification ${type} for order ${orderId}: ${String(error)}`);
    }
  }

  /** In-app notification for admin users of a branch (e.g. low stock). */
  async notifyBranchAdmins(params: {
    branchId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [{ isGlobal: true }, { branches: { some: { branchId: params.branchId } } }],
      },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        channel: 'IN_APP' as const,
        status: 'SENT' as const,
        type: params.type,
        title: params.title,
        body: params.body,
        data: JSON.parse(JSON.stringify(params.data ?? {})),
        sentAt: new Date(),
      })),
    });
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }
}
