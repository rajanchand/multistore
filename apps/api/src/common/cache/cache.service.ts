import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

const PREFIX = 'cache:';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`cache get failed for ${key}: ${String(error)}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`cache set failed for ${key}: ${String(error)}`);
    }
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.getJson<T>(key);
    if (hit !== null) return hit;
    const value = await loader();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(PREFIX + key);
    } catch (error) {
      this.logger.warn(`cache del failed for ${key}: ${String(error)}`);
    }
  }
}
