# Deployment & disaster recovery

## Target topology

| Component | Suggested runtime |
| --- | --- |
| Storefront | Vercel / any Next.js host / `infra/docker/Dockerfile.storefront` |
| Admin | Vercel / any Next.js host / `infra/docker/Dockerfile.admin` |
| API | Container platform via `infra/docker/Dockerfile.api` |
| PostgreSQL | Managed PostgreSQL with PITR |
| Redis | Managed Redis (BullMQ + rate limiting) |
| Media | S3-compatible object storage |

Do not hardcode provider assumptions into business logic. Configure via environment variables from `.env.example`.

### Production builds (local verify)

```bash
pnpm --filter @repo/api build
pnpm --filter @repo/admin build
pnpm --filter @repo/storefront build
```

Next apps use `output: 'standalone'` and default `NEXT_PUBLIC_API_URL=http://localhost:4000` when unset (override at deploy with the public API URL).

## Migrations

Production must use:

```bash
pnpm db:migrate:deploy
```

Never use `prisma db push` in production.

## Backups

- **RPO target:** ≤ 15 minutes (managed PITR preferred)
- **RTO target:** ≤ 4 hours for regional restore
- Automated daily snapshots with weekly restore drills
- Object storage versioning enabled for product media
- Document restore steps in the runbook and test them quarterly

Backups are incomplete unless restoration is tested.

## Observability

- Structured logs with `x-request-id`
- Prepare Sentry DSN / OpenTelemetry exporters via env
- Never log passwords, tokens, MFA secrets, or card data
