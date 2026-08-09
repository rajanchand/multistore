import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { loadServerEnv } from '@repo/config';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const env = loadServerEnv();
        return new Redis(env.REDIS_URL, {
          // BullMQ requires this to be null on shared connections.
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
