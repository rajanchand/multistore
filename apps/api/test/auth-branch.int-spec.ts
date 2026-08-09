/**
 * Integration tests — require PostgreSQL with seed data.
 * Run: pnpm --filter @repo/api test:int
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadServerEnv, resetEnvCache } from '@repo/config';

describe('Auth + branch isolation (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    if (!process.env.AUTH_SECRET) {
      process.env.AUTH_SECRET = 'dev-only-secret-at-least-32-chars-long!!';
    }
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        'postgresql://commerce:commerce_dev_password@localhost:5432/commerce?schema=public';
    }
    if (!process.env.REDIS_URL) {
      process.env.REDIS_URL = 'redis://localhost:6379';
    }
    resetEnvCache();
    loadServerEnv();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('logs in superadmin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'rajan.chand', password: 'DevPassword123!' })
      .expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('superadmin@dev.local');
    expect(res.body.user.username).toBe('rajan.chand');
  });

  it('denies Glasgow manager access to Edinburgh branch detail', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'manager.glasgow@dev.local', password: 'DevPassword123!' })
      .expect(200);

    const branches = await request(app.getHttpServer())
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(branches.body.every((b: { code: string }) => b.code === 'GLA' || b.code === 'HQ')).toBe(true);

    // Fetch Edinburgh id via a direct DB-less approach: try listing as superadmin.
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'rajan.chand', password: 'DevPassword123!' })
      .expect(200);
    const all = await request(app.getHttpServer())
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    const edinburgh = all.body.find((b: { code: string }) => b.code === 'EDI');
    expect(edinburgh).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/branches/${edinburgh.id}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(403);
  });

  it('health endpoint reports database and redis', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.checks.database).toBe('up');
    expect(res.body.checks.redis).toBe('up');
  });
});
