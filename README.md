# Multi-Branch E-Commerce & HQ Management Platform

Production-oriented monorepo for a multi-branch retailer:

- **Storefront** (`apps/storefront`) — Next.js customer shop with branch-aware pricing/stock
- **Admin** (`apps/admin`) — HQ / branch management portal
- **API** (`apps/api`) — NestJS REST API (`/api/v1`) with OpenAPI at `/docs`
- **Shared packages** — database (Prisma), auth, validation, types, UI, config

## Quick start

```bash
# 1. Infrastructure
pnpm infra:up

# 2. Environment
cp .env.example .env
# Generate AUTH_SECRET:
# openssl rand -base64 48

# 3. Install & migrate
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Develop (API :4000, storefront :3000, admin :3001)
pnpm dev
```

Health check: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

## Development accounts

Most seeded passwords: `DevPassword123!` (development only). Override Super Admin via `SEED_SUPERADMIN_USERNAME` / `SEED_SUPERADMIN_PASSWORD`.

| Account | Login |
| --- | --- |
| Super Admin | `rajan.chand` (default username) |
| Glasgow Manager | `manager.glasgow@dev.local` |
| Edinburgh Manager | `manager.edinburgh@dev.local` |
| Customer | `alice@example.dev` |

See `packages/database/src/seed/dev-credentials.md`.

## Architecture highlights

- **Master Product + BranchProduct** — catalogue is shared; price/visibility/stock are per branch
- **Money as integer pence** — no floating-point financial math
- **Permission RBAC** — never `if (role === 'ADMIN')`; guards enforce permission keys
- **Branch isolation** — authorised branch IDs come from the DB, never trusted from the client
- **Inventory ledger** — every mutation writes `StockMovement`; reservations use conditional SQL updates
- **Stripe via PaymentProvider** — webhook signature verification + `PaymentEvent` idempotency

Details: `docs/architecture-decisions.md` · Progress: `docs/IMPLEMENTATION_STATUS.md`

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start all apps |
| `pnpm build` | Production builds |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality gates |
| `pnpm db:migrate` | Create/apply migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (prod) |
| `pnpm db:seed` | Seed branches, catalogue, orders, accounts |
| `pnpm infra:up` / `pnpm infra:down` | PostgreSQL + Redis via Docker Compose |

## Stripe (optional in local dev)

Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env` (see `.env.example`).

```bash
stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe
```

Without keys, catalogue/admin still work; storefront checkout shows a clear configuration banner and the API returns `PAYMENT_PROVIDER_NOT_CONFIGURED`. Orders become **PAID** only after verified server-side Stripe confirmation (webhook or `/checkout/orders/:id/confirm`).

## Deployment sketch

- Storefront / Admin → Vercel (or any Next host)
- API → container platform
- Managed PostgreSQL + Redis
- S3-compatible object storage for media

See `docs/` for security, backup, and deployment notes.
