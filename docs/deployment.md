# Deployment & disaster recovery

## Target topology

| Component | Suggested runtime |
| --- | --- |
| Storefront | Vercel / any Next.js host / `infra/docker/Dockerfile.storefront` |
| Admin | Vercel / any Next.js host / `infra/docker/Dockerfile.admin` |
| API (HTTP) | `infra/docker/Dockerfile.api` with `DISABLE_WORKERS=1` |
| API (worker) | Same image with `WORKER_ONLY=1` (BullMQ / reservation expiry) |
| PostgreSQL | Managed PostgreSQL with PITR (or Docker + volume on a VPS) |
| Connection pooler | PgBouncer (`session` mode for Prisma `$transaction`) |
| Redis | Managed Redis / Docker (BullMQ + catalogue cache + shared throttling + session cache) |
| Media | S3-compatible object storage |

Do not hardcode provider assumptions into business logic. Configure via environment variables from `.env.example`.

### Single-VPS Compose (current production path)

Use [`infra/docker/docker-compose.prod.yml`](../infra/docker/docker-compose.prod.yml):

```bash
docker compose --env-file .env -f infra/docker/docker-compose.prod.yml up -d --build
pnpm db:migrate:deploy   # or via the API image entrypoint / one-off run
```

Point production `DATABASE_URL` at PgBouncer, for example:

```text
postgresql://commerce:PASSWORD@pgbouncer:5432/commerce?schema=public&pgbouncer=true&connection_limit=5
```

Optional Nginx edge cache for anonymous catalogue GETs: [`infra/nginx/storefront-api-cache.conf`](../infra/nginx/storefront-api-cache.conf).

### Capacity expectations (honest)

On a **4 CPU / ~4 GB RAM** VPS that also runs other containers:

| Goal | Status |
| --- | --- |
| ~10 lakh **registered** customer rows | Supported (indexes + pagination; disk/RAM for the table itself) |
| Flash-sale browsing (cached catalogue) | Hardened (Redis cache, shared rate limits, short Next revalidate) |
| ~1k concurrent browsers on cached pages | Possible with cache hit rate; not guaranteed under mixed load |
| 10 lakh **concurrent** online users | **Not supported** — needs multi-node cloud, managed DB replicas, CDN |

Checkout / payment remains intentionally rate-limited and transactional; do not expect flash-sale browse capacity to equal flash-sale checkout capacity.

### Load test

```bash
k6 run -e BASE_URL=https://shop.zero-trust-security.org scripts/load/storefront-smoke.js
```

See [`scripts/load/storefront-smoke.js`](../scripts/load/storefront-smoke.js).

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
