import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { loadServerEnv } from '@repo/config';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async health() {
    const checks: Record<string, 'up' | 'down'> = { database: 'down', redis: 'down' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      /* reported below */
    }
    try {
      if ((await this.redis.ping()) === 'PONG') checks.redis = 'up';
    } catch {
      /* reported below */
    }
    const healthy = Object.values(checks).every((s) => s === 'up');
    const geminiConfigured = Boolean(loadServerEnv().GEMINI_API_KEY?.trim());
    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
      integrations: {
        gemini: geminiConfigured ? 'configured' : 'missing',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }
}
