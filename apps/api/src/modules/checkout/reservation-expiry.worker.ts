import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { CheckoutService } from './checkout.service';

const QUEUE_NAME = 'reservation-expiry';

/**
 * Periodic sweep releasing expired checkout reservations. Runs every minute;
 * orders still awaiting payment past their reservation expiry are cancelled
 * and their stock returned. Payment success (webhook) marks reservations
 * COMMITTED first, so a paid order can never be swept.
 */
@Injectable()
export class ReservationExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ReservationExpiry');
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    // Skip background workers in unit/integration tests so Jest can exit cleanly.
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_WORKERS === '1') return;

    this.queue = new Queue(QUEUE_NAME, { connection: this.redis });
    await this.queue.upsertJobScheduler('sweep', { every: 60_000 }, { name: 'sweep' });

    this.worker = new Worker(
      QUEUE_NAME,
      async () => {
        await this.sweep();
      },
      { connection: this.redis, concurrency: 1 },
    );
    this.worker.on('failed', (_job, err) => {
      this.logger.error(`Reservation sweep failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async sweep(): Promise<void> {
    const expired = await this.prisma.stockReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() }, orderId: { not: null } },
      select: { orderId: true },
      distinct: ['orderId'],
      take: 100,
    });
    for (const { orderId } of expired) {
      if (!orderId) continue;
      try {
        await this.checkout.releaseOrder(orderId, 'Checkout reservation expired');
        await this.prisma.stockReservation.updateMany({
          where: { orderId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });
        this.logger.log(`Released expired reservation for order ${orderId}`);
      } catch (error) {
        this.logger.error(`Failed to release order ${orderId}: ${String(error)}`);
      }
    }
  }
}
