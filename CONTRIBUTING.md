# Contributing

## Local setup

```bash
pnpm infra:up
cp .env.example .env
# Generate AUTH_SECRET: openssl rand -base64 48
pnpm install
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev   # API :4000 · storefront :3000 · admin :3001
```

Health: `http://localhost:4000/api/v1/health`  
API docs: `http://localhost:4000/docs`

Seed passwords (dev only): default `DevPassword123!`; Super Admin override via `SEED_SUPERADMIN_*` — see `packages/database/src/seed/dev-credentials.md`.

### Stripe checkout (optional)

Fill `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` from `.env.example`. Forward webhooks with:

```bash
stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe
```

Without keys, the storefront shows a clear configuration message; do not expect silent payment success.

## Non-negotiables

- **Money is integer pence** in the API and DB. Format with `formatMoney` only at the UI edge.
- **Never trust client branch IDs** for authorisation. Allowed branches come from the session + `BranchAccessService` / DB (`UserBranch`, `isGlobal`). Client-supplied `branchId` is a filter hint at most — still assert access server-side.
- **Permissions, not role strings** — use `@RequirePermissions('…')` and the shared catalogue in `@repo/types`.
- **Orders become PAID only** after verified server-side Stripe confirmation (webhook or confirm endpoint), never from a client “paid” claim alone.
- **Never commit real secrets** (`.env`, live Stripe keys, `AUTH_SECRET`).

## CORS / production URLs

The API CORS allowlist is derived from `APP_URL` and `ADMIN_URL` (plus localhost ↔ 127.0.0.1 mirrors). Set those to the real storefront and admin origins in production or browsers will block credentialed API calls.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Playwright (optional, not in CI)

With API + storefront running and DB seeded:

```bash
pnpm --filter @repo/storefront exec playwright install chromium
pnpm --filter @repo/storefront test:e2e
```

Prefer focused changes; update `docs/IMPLEMENTATION_STATUS.md` when you close a known gap.
