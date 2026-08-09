# Architecture Decision Log

Concise, practical records of significant decisions.

## ADR-001: Monorepo with pnpm workspaces + Turborepo

**Decision:** Single repository with `apps/` (storefront, admin, api) and `packages/` (database, ui, auth, validation, config, types, tsconfig, eslint-config).

**Why:** Shared types between API and frontends eliminate contract drift; one dependency graph; Turborepo caches builds/lint/tests per package. The repo was empty, so no migration cost.

## ADR-002: NestJS REST API separate from Next.js apps

**Decision:** Dedicated NestJS API (`apps/api`) at `/api/v1/*`; Next.js apps are thin clients doing server-side fetching.

**Why:** Branch authorization, inventory concurrency, payments, and background jobs need one authoritative backend. Two frontends (admin + storefront) sharing one API avoids duplicated business logic in Next.js server actions.

## ADR-003: Master Product + BranchProduct

**Decision:** `Product`/`ProductVariant` hold shared catalogue data. `BranchProduct` holds per-branch commercial config (price, sale price, visibility, availability, fulfilment flags, order quantity limits). Inventory is per branch × variant.

**Why:** Products must not be duplicated per branch. HQ manages the master catalogue once; branches override only commercial fields. Adding branch #100 is a row insert, not a catalogue copy.

## ADR-004: Money as integer minor units (pence)

**Decision:** All monetary values are stored and computed as integers in minor units (`Int` in Prisma → `INTEGER` in PostgreSQL). Currency code stored alongside where relevant.

**Why:** Eliminates floating-point rounding errors entirely. Matches Stripe's API (amounts in pence). Formatting to £x.xx happens only at the presentation edge.

## ADR-005: Sessions over stateless JWTs

**Decision:** Opaque session tokens (random 256-bit, SHA-256 hashed at rest) in a `Session` table, delivered via httpOnly secure cookies to browsers and `Authorization: Bearer` for API tests. Sliding expiry with rotation.

**Why:** Instant revocation (single session or all sessions) is a hard requirement; stateless JWTs cannot be revoked without a denylist that reintroduces state anyway. DB lookup per request is acceptable and cacheable.

## ADR-006: Permission-based RBAC, not role checks

**Decision:** `Permission` strings (e.g. `product.update`) grouped into `Role`s; users get roles (optionally branch-scoped via `UserBranch`). Authorization is enforced with a `@RequirePermissions()` decorator + guard; branch scope with a `BranchScopeGuard` that derives allowed branch IDs from the DB, never from the request.

**Why:** `if (role === 'ADMIN')` scattered through code is unmaintainable and unsafe. Permissions compose; custom roles become data, not code.

## ADR-007: Branch isolation enforced in services

**Decision:** Every branch-scoped query filters by branch IDs resolved server-side from the authenticated user's `UserBranch` rows. Requested branch IDs from URL/body are validated against that set; mismatch → 403. Users with the `*` global scope (HQ) bypass the filter.

**Why:** Cross-branch IDOR is the top security risk in this product. Trusting any client-supplied branch ID is forbidden; tests assert 403 on cross-branch access.

## ADR-008: Inventory ledger + atomic reservations

**Decision:** `Inventory` rows hold `available`/`reserved` counters. Every mutation goes through a service that (a) runs in a transaction, (b) uses conditional `UPDATE ... WHERE available >= qty` (row-level atomic) to prevent oversell, and (c) writes a `StockMovement` ledger entry with before/after quantities. Reservations expire via a BullMQ delayed job.

**Why:** Two customers must not buy the last unit. Conditional updates under READ COMMITTED are race-safe without table locks; the ledger makes history auditable and reconstructable.

## ADR-009: Stripe via PaymentProvider abstraction

**Decision:** `PaymentProvider` interface (`createPayment`, `confirmPayment`, `refundPayment`, `getPayment`, `verifyWebhook`) with `StripePaymentProvider` using PaymentIntents. Webhooks verified by signature; `PaymentEvent` table stores `providerEventId` with a unique constraint for idempotent processing. Orders become PAID only from verified server-side webhook/API confirmation.

**Why:** Future providers (PayPal, eSewa, Khalti) plug in without touching order logic. Unique event IDs make replayed webhooks no-ops.

## ADR-010: Audit log as append-only table

**Decision:** `AuditLog` rows record actor, action, resource, branch, old/new values (JSON, secrets redacted), IP, user agent, request ID. Written from a dedicated service; never updated or deleted.

**Why:** Traceability of admin/business operations is a compliance and operations requirement. Append-only keeps it trustworthy.

## ADR-011: Tailwind CSS v3 + hand-rolled shadcn-style UI package

**Decision:** `packages/ui` contains shadcn/ui-pattern components (Radix primitives + Tailwind + cva) consumed by both Next.js apps with a shared Tailwind preset.

**Why:** Consistent design system across admin and storefront with one source of truth; shadcn's copy-in model fits a shared package better than a runtime dependency.
