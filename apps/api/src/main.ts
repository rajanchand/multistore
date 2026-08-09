import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { loadServerEnv } from '@repo/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Load monorepo root .env (apps/api → ../../.env) then local overrides.
loadDotenv({ path: resolve(__dirname, '../../../.env') });
loadDotenv({ path: resolve(__dirname, '../.env'), override: true });

async function bootstrap(): Promise<void> {
  // Fail fast when critical environment variables are missing.
  const env = loadServerEnv();
  const workerOnly = process.env.WORKER_ONLY === '1';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Stripe webhook signature verification needs the raw body.
    rawBody: true,
    logger: ['log', 'warn', 'error'],
  });

  // Behind Traefik/Caddy/nginx, use X-Forwarded-For for throttling and audit IPs.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api/v1');
  app.use(
    helmet({
      // Production: enable HSTS. CSP for HTML is primarily enforced by Next apps.
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: false }
          : false,
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  // Allow both localhost and 127.0.0.1 — browsers treat them as different origins.
  const corsOrigins = new Set<string>([env.APP_URL, env.ADMIN_URL]);
  for (const url of [env.APP_URL, env.ADMIN_URL]) {
    try {
      const u = new URL(url);
      if (u.hostname === 'localhost') {
        u.hostname = '127.0.0.1';
        corsOrigins.add(u.toString().replace(/\/$/, ''));
      } else if (u.hostname === '127.0.0.1') {
        u.hostname = 'localhost';
        corsOrigins.add(u.toString().replace(/\/$/, ''));
      }
    } catch {
      /* ignore invalid URL */
    }
  }
  app.enableCors({
    origin: [...corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Multi-Branch Commerce API')
      .setDescription('REST API for the multi-branch e-commerce platform')
      .setVersion('1.0')
      .addCookieAuth('admin_session')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  if (workerOnly) {
    // BullMQ / reservation workers start via OnModuleInit; no public HTTP port.
    await app.init();
    // eslint-disable-next-line no-console
    console.log('API worker process ready (WORKER_ONLY=1, HTTP disabled)');
    return;
  }

  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT} (docs at /docs)`);
}

void bootstrap();
