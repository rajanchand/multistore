# Implementation Status

Legend: `[ ]` Not started · `[~]` In progress · `[x]` Complete · `[!]` Blocked

**Last verified:** 2026-08-11 — Report PDF download + email-to-managers/staff on all HQ reports; SMTP/log email provider.

## Runtime (verified)

| Service | URL | Status |
| --- | --- | --- |
| API | http://localhost:4000/api/v1 | Running |
| API docs | http://localhost:4000/docs | Running |
| Health | http://localhost:4000/api/v1/health | `database` + `redis` up |
| Storefront | http://localhost:3000 | Running |
| Admin | http://localhost:3001 | Running |
| Postgres | localhost:5432 | Docker healthy |
| Redis | localhost:6379 | Docker healthy |

### Start commands

```bash
pnpm infra:up
cp .env.example .env   # set AUTH_SECRET (openssl rand -base64 48)
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev               # or: pnpm dev:api / dev:admin / dev:storefront
```

### Seed credentials (dev only)

Most seed passwords: `DevPassword123!` (override Super Admin with `SEED_SUPERADMIN_*` env vars)

- Super Admin: username `rajan.chand` (default)
- Glasgow Manager: `manager.glasgow@dev.local`
- Customer: `demo@dev.local` (primary demo checkout) / `alice@example.dev`

## Phase 1 — Project Foundation

- [x] Monorepo (pnpm workspaces + Turborepo)
- [x] Apps scaffolding (storefront, admin, api)
- [x] Shared packages (database, ui, auth, validation, config, types, tsconfig, eslint-config)
- [x] Strict TypeScript, ESLint, Prettier
- [x] Docker Compose (PostgreSQL 17, Redis 7)
- [x] Environment validation
- [x] Health endpoints
- [x] README

## Phase 2 — Database Foundation

- [x] Prisma schema (core commerce entities)
- [x] First migration applied (`20260809001805_init`)
- [x] Seed: HQ + Glasgow, Edinburgh, Paisley, Manchester, London
- [x] Seed: products, variants, categories, inventory, customers, orders
- [x] Development accounts per role

## Phase 3 — Authentication

- [x] Email + password (Argon2id)
- [x] Login / logout / session handling
- [x] Forgot / reset password (hashed tokens)
- [x] Session list + revoke one/all
- [x] TOTP MFA setup/enable/disable (encrypted secrets)
- [x] Rate limiting, failed-login tracking, lockouts

## Phase 4 — RBAC & Branch Authorization

- [x] Permission catalogue (`@repo/types`)
- [x] Roles ↔ permissions
- [x] Permission guards/decorators
- [x] Branch-scope enforcement (`BranchAccessService`)
- [x] Cross-branch access denied for Glasgow → Edinburgh (verified via API)

## Phase 5–7 — Admin Shell, Dashboard, Branches

- [x] Admin app shell (sidebar, topbar, permission-aware nav)
- [x] Super admin dashboard (KPIs, charts, branch performance)
- [x] Branch list UI + API CRUD
- [x] Branch create (`/branches/new`) + detail/edit (`/branches/[id]`) with enable/disable/archive
- [x] Branch list surfaces API errors (no silent empty table)

## Phase 8–10 — Products, Bulk Ops, Inventory

- [x] Product list API + admin table
- [x] Product create (`/products/new`) + detail/edit (`/products/[id]`)
- [x] Create product: original/sale price + % discount UX, multi-store attach (`branchIds` → BranchProduct + inventory)
- [x] Branch product matrix API
- [x] Categories admin (`/categories`): image, hide/unhide, edit, archive, branch-wise visibility
- [x] Brands admin (`/brands`): Brand model + image, hide/unhide, edit, archive, branch-wise visibility
- [x] Bulk operations (BullMQ queue + processor)
- [x] Inventory dashboard API + stock movement ledger
- [x] Stock transfers state machine API
- [x] Admin stock transfer UI (`/inventory/transfers`, create + status transitions)
- [~] Rich product editor (API complete; admin UI basic)

## Phase 11–13 — Storefront, Cart, Checkout

- [x] Storefront pages (home, products, PDP, cart, account, track, legal)
- [x] Branch selector with per-branch catalogue
- [x] Cart (server-authoritative pricing)
- [x] Checkout API with concurrency-safe stock reservation
- [x] Multi-step checkout UI (fulfilment/address → review → Stripe Payment Element)
- [x] `GET /storefront/payment-config` (publishable key + configured flag; clear message when unset)

## Phase 14–15 — Payments & Orders

- [x] PaymentProvider abstraction + StripePaymentProvider
- [x] Webhook signature verification + PaymentEvent idempotency
- [x] Payment state machine (server-confirmed PAID)
- [x] Order lifecycle + status history
- [x] Admin orders list + order detail (`/orders/[id]`)
- [x] Order source channel: Online / POS / Cash (schema, seed, list filters, detail badges, reports)
- [!] Live Stripe checkout needs test keys in `.env` (optional for local catalogue/admin; UI banners when missing)

## Phase 16–22 — Commerce Operations

- [x] Promotion engine (server-side pricing)
- [x] Banner CMS API + admin list
- [x] Campaign CRUD API + admin (`campaign.manage`)
- [x] SMS send (individual + bulk) via BullMQ + LogSmsProvider / Twilio (`sms.send`)
- [x] Analytics (DB aggregation dashboard)
- [x] HQ Reports API + admin (`report.read`) — sales / orders / inventory
- [x] Report PDF download (`GET /reports/:kind/pdf`) + one-click email send to managers/staff (`POST /reports/:kind/send`, `GET /reports/recipients`)
- [x] Email provider (`log` default; SMTP via `EMAIL_SMTP_*`)
- [x] Login sessions UI (`GET/DELETE /auth/sessions`)
- [x] Settings hub: Staff, Branches, About, FAQs, Payment methods
- [x] Content CMS models: Faq, AboutContent, PaymentMethodConfig
- [x] Audit system + activity log UI
- [x] User & role management API + admin users table
- [x] Returns request + refunds (create/approve with idempotency)
- [x] Notifications abstraction (BullMQ + in-app/email log)

## Phase 23–29 — Hardening & Delivery

- [x] Security headers / CORS / Zod validation / audit redaction (baseline)
- [x] Unit tests (money, auth tokens, pricing, branch access) — passing
- [~] Integration tests present; workers skipped under `NODE_ENV=test`
- [~] Playwright smoke config + one path test (`apps/storefront/e2e`) — **CI-optional** (`pnpm --filter @repo/storefront test:e2e`; not in `.github/workflows/ci.yml`)
- [x] CI workflow scaffold (`.github/workflows/ci.yml`)
- [x] Production Dockerfiles (`Dockerfile.api`, `Dockerfile.admin`, `Dockerfile.storefront`)
- [x] Next.js `output: 'standalone'` + default `NEXT_PUBLIC_API_URL` for production builds
- [x] Admin `/api/logout` route (clears session + redirects to login)
- [x] Menu/route audit: all admin sidebar + storefront header/footer links resolve (no 404)
- [x] Deployment & security docs
- [x] `CONTRIBUTING.md` (local setup + never trust client branch IDs)

## Fixes (2026-08-09) — Product create pricing & stores

Create product now accepts original price (pence), optional sale price + % discount UX in admin, and optional `branchIds[]` so save upserts `BranchProduct` + inventory for each selected store (verified GLA+EDI with £1.49 / 10% → £1.34).

## UX refresh (2026-08-09)

- **Storefront:** sticky header + mobile drawer, promo ribbon, horizontal categories bar, forest/sand atmosphere, product cards with primary image + click & collect badge, PDP image gallery/lightbox, Fraunces + DM Sans via `next/font`.
- **Location gate:** first visit redirects to `/select-location` until `preferred_branch` cookie is set; enter UK postcode (nearest via Haversine on Branch lat/lng) or pick a store; confirm “Welcome to {Branch}”; legal pages stay public. API: `GET /storefront/branches/nearest?postcode=`.
- **Admin branch switcher:** top-bar one-click filter (`admin_branch_id` cookie) applied to dashboard, orders, products, inventory, reports via `branchId` / `branchIds`.
- **Dashboard:** today strip, clickable KPIs, branch compare, recent activity, low-stock links.
- **Product images:** admin URL/upload + reorder (primary first); list thumbnails; storefront gallery; validation accepts http(s) or `data:image`; seed refreshes picsum galleries.

## Checkout + Stripe (2026-08-09)

- Storefront `/checkout`: login gate → fulfilment (delivery address or click & collect) → review → Stripe Payment Element pay.
- API `GET /storefront/payment-config` exposes publishable key + `configured` flag (never secret/webhook keys).
- Without `STRIPE_*` keys: amber banner on checkout + API `PAYMENT_PROVIDER_NOT_CONFIGURED` (no silent failure).
- After client `confirmPayment`, storefront calls `POST /checkout/orders/:id/confirm`; order **PAID** only after server verifies provider state (webhook idempotent via `PaymentEvent`).
- `.env.example` documents `stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe`.

## Admin areas added (2026-08-09)

| Area | Admin routes | API | Permission |
| --- | --- | --- | --- |
| Settings hub | `/settings` + Staff / Branches / About / FAQs / Payment methods | `/faqs`, `/about`, `/payment-methods` | `settings.manage` |
| Reports | `/reports`, `/reports/sales`, `/orders`, `/inventory` | `/reports/*` | `report.read` |
| Login sessions | `/sessions` | `GET/DELETE /auth/sessions` | `settings.manage` (nav) |
| Campaigns | `/campaigns`, `/new`, `/[id]` | `/campaigns` | `campaign.manage` |
| SMS | `/sms` | `GET /sms`, `POST /sms/send` | `sms.send` |
| Stock transfers | `/inventory/transfers`, `/new` | `/inventory/transfers` | `inventory.transfer` |

**How to use:** log in as Super Admin (see `packages/database/src/seed/dev-credentials.md`). Sidebar shows permission-gated items. SMS defaults to `LogSmsProvider` (API console); set `SMS_PROVIDER=twilio` + `TWILIO_*` for live send. Seed includes demo FAQs, about sections, payment methods, and campaign `spring-energy-push`.

## Fixes (2026-08-09) — Branches & menu 404s

**Root cause:** Admin list pages linked to detail/create routes that had no `page.tsx`, so Next.js returned 404. Logout posted to a missing `/api/logout` route.

| Issue | Fix |
| --- | --- |
| `/branches/new`, `/branches/[id]` 404 | Added create form + detail/edit with enable/disable/archive |
| `/products/new`, `/products/[id]` 404 | Added create + detail/edit pages wired to products API |
| `/orders/[id]` 404 | Added order detail page |
| `/api/logout` 404 | Added Next route handler |
| Empty Branches when API errors | Show error banner instead of silent `[]` |
| Deploy builds | Admin/storefront/api `pnpm build` green; Dockerfiles for all three |

## Known gaps (non-blocking for local run)

1. Stripe test keys still required in `.env` for live PaymentIntents (UI/API now explain clearly when missing).
2. Some admin screens remain list/read-focused vs full API surface (promotions create/edit still thin; banners already have editors).
3. Playwright: smoke scaffold only (location → browse → cart); not wired into CI.
4. Next.js apps use ESLint 9 with `eslint-config-next` peer warnings (non-blocking).
5. Production VPS deploy remains a separate track.
6. Promotions admin remains list/status-focused (create API exists; richer editor still open).
