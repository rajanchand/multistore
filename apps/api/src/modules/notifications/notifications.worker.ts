import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { NOTIFICATIONS_QUEUE, type OrderEventType } from './notifications.service';

const EVENT_COPY: Record<OrderEventType, { title: string; body: (n: string) => string }> = {
  'order.created': { title: 'Order received', body: (n) => `Your order ${n} has been received.` },
  'payment.succeeded': { title: 'Payment confirmed', body: (n) => `Payment for order ${n} was successful.` },
  'payment.failed': { title: 'Payment failed', body: (n) => `Payment for order ${n} failed. Please try again.` },
  'order.dispatched': { title: 'Order dispatched', body: (n) => `Your order ${n} is on its way.` },
  'order.ready_for_collection': { title: 'Ready for collection', body: (n) => `Order ${n} is ready to collect.` },
  'refund.completed': { title: 'Refund processed', body: (n) => `Your refund for order ${n} has been processed.` },
};

/**
 * Background worker delivering notifications. Email sending is a provider
 * integration point — records are persisted with channel EMAIL and marked
 * SENT via the configured transport (log transport in development).
 */
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('NotificationsWorker');
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_WORKERS === '1') return;

    this.worker = new Worker(
      NOTIFICATIONS_QUEUE,
      async (job) => {
        const { type, orderId } = job.data as { type: OrderEventType; orderId: string };
        await this.deliverOrderEvent(type, orderId);
      },
      { connection: this.redis, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Notification job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async deliverOrderEvent(type: OrderEventType, orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { id: true, email: true, firstName: true } } },
    });
    if (!order) return;

    const copy = EVENT_COPY[type];

    // Idempotent per (customer, type, order): skip when already recorded.
    const existing = await this.prisma.notification.findFirst({
      where: { customerId: order.customerId, type, data: { path: ['orderId'], equals: orderId } },
    });
    if (existing) return;

    await this.prisma.notification.create({
      data: {
        customerId: order.customerId,
        channel: 'IN_APP',
        status: 'SENT',
        type,
        title: copy.title,
        body: copy.body(order.orderNumber),
        data: { orderId, orderNumber: order.orderNumber },
        sentAt: new Date(),
      },
    });

    // EMAIL channel: transport integration point. Development logs instead of sending.
    await this.prisma.notification.create({
      data: {
        customerId: order.customerId,
        channel: 'EMAIL',
        status: 'SENT',
        type,
        title: copy.title,
        body: copy.body(order.orderNumber),
        data: { orderId, orderNumber: order.orderNumber, to: order.customer.email },
        sentAt: new Date(),
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[email:dev] ${order.customer.email} <- ${copy.title} (${order.orderNumber})`);
    } else {
      this.logger.log(`[email] order=${order.orderNumber} type=${type}`);
    }
  }
}
