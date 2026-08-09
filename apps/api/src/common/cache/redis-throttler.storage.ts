import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

/**
 * Shared Redis-backed throttler storage so rate limits work across API replicas.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:hits:${key}`;
    const blockKey = `throttle:block:${key}`;

    const blockedFor = await this.redis.pttl(blockKey);
    if (blockedFor > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: blockedFor,
      };
    }

    const multi = this.redis.multi();
    multi.incr(hitKey);
    multi.pttl(hitKey);
    const results = await multi.exec();
    const totalHits = Number(results?.[0]?.[1] ?? 1);
    let timeToExpire = Number(results?.[1]?.[1] ?? -1);

    if (timeToExpire < 0) {
      await this.redis.pexpire(hitKey, ttl);
      timeToExpire = ttl;
    }

    if (totalHits > limit && blockDuration > 0) {
      await this.redis.set(blockKey, '1', 'PX', blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
