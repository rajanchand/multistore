# Security decisions

## Authentication

- Argon2id password hashing
- Opaque session tokens (SHA-256 hashed at rest)
- API sets httpOnly / Secure (production) / SameSite=Lax session cookies
- Admin + storefront also set **httpOnly** same-origin cookies via `/api/session` for SSR (never `document.cookie` for session tokens)
- Client → API calls use `credentials: 'include'` (API-domain cookie); do not read session tokens from JS
- Failed-login lockouts + Nest throttling on auth routes
- Admin MFA via TOTP; secrets encrypted with AES-256-GCM derived from `AUTH_SECRET`

## Authorisation

- Permission catalogue in `@repo/types`
- `@RequirePermissions()` + `PermissionsGuard`
- `BranchAccessService` derives allowed branches from DB (`UserBranch` / `isGlobal`)
- Cross-branch IDOR attempts return 403
- Admin global search gates product/order/customer/branch results on the matching `*.read` permission

## Payments

- Stripe PaymentIntents; no card data stored
- Webhook signature verification required (`constructEvent` + raw body)
- `PaymentEvent (provider, providerEventId)` unique for idempotency; **duplicate deliveries re-enter** status-guarded handlers so a failed first attempt is not dropped
- Orders marked PAID only after server-side provider confirmation
- Coupon redemption increments are capped under `maxRedemptions` inside the payment transaction
- Mock POS card approve is **disabled in production** unless `ALLOW_MOCK_POS_TERMINAL=1`

## Other controls

- Zod validation on all mutating payloads (mass-assignment resistant)
- Helmet security headers, CORS allowlist (`APP_URL` + `ADMIN_URL`, with localhost ↔ 127.0.0.1 mirrors)
- Production: `trust proxy` enabled for correct client IPs behind reverse proxies
- Production: `STRIPE_WEBHOOK_SECRET` required when `STRIPE_SECRET_KEY` is set
- SMS `log` provider refuses to send (and does not log phones) in production
- Audit log redacts secrets
- Soft-delete for catalogue/users; hard-delete forbidden for orders/payments/audit
- Authorised branch IDs come from the DB session — never trust client-supplied branch IDs for access control
- `revokeAll` clears Redis session cache entries (not only DB `revokedAt`)

---

## Pre-launch security audit (Mayank Shah–style 5-check sequence)

App context (check 04): Stripe PaymentIntents + webhooks, customer + admin auth (sessions, MFA, branch-scoped roles), multi-branch commerce, POS, SMS, promotions/coupons, customer PII.

These automated checks are **not** a substitute for a human review / pentest before handling real money at scale. Do not treat this document as a “secure” attestation.

### 01 Secret leak prevention — findings & changes

| Finding | Severity | Action |
| --- | --- | --- |
| Local `.env` / app `.env.local` files | OK | Gitignored; not tracked |
| Hardcoded Super Admin password in seed/docs/UI | High | Unified seed default to `DevPassword123!`; override via `SEED_SUPERADMIN_*`; removed from login UI |
| Stripe/Twilio keys in examples | OK | Placeholders only (`sk_test_...`, `whsec_...`) |
| Secrets in git history | Medium | Rotate any password that ever lived in commits; history rewrite not performed |

### 02 Personal data flow — findings & changes

| Finding | Severity | Action |
| --- | --- | --- |
| Passwords hashed with Argon2id | OK | Keep |
| Notification worker logged customer email | Medium | Production logs order number only |
| SMS log provider logged phone + body | Medium | Send blocked in production without Twilio |
| Reset tokens logged only in non-production | OK | Keep |
| Stripe / Twilio / Gemini third-party flows | Info | Stripe gets receipt email; Twilio gets phone+body; Gemini gets offer copy (not customer PII) |

### 03 Pre-deploy production audit — findings & changes

| Finding | Severity | Action |
| --- | --- | --- |
| Swagger disabled in production | OK | Already gated |
| Exception filter hides stacks | OK | Keep |
| Rate-limit IPs behind proxy | Medium | `trust proxy` in production |
| Stripe webhook secret optional with Stripe key | Medium | Fail startup in production if secret missing |
| Helmet + CORS allowlist | OK | Keep; set real `APP_URL` / `ADMIN_URL` on VPS |

### 04 Deep security (Trail of Bits–style) — findings & changes

| Finding | Severity | Action |
| --- | --- | --- |
| Webhook idempotency dropped failed processing | High | Reprocess on duplicate event id |
| Mock POS approve = paid without processor | High | Disabled in production by default |
| Coupon apply ignored max redemptions | Medium | Enforce on apply + capped increment on pay |
| SMS generate could leak cross-branch coupon codes | Medium | `assertCanManageBranchScoped` on campaign/promotion |
| Admin search lacked permission gates | Medium | Gate by `product.read` / `order.read` / etc. |
| Session `revokeAll` left Redis cache live ~30s | Medium | Delete cache keys for revoked sessions |
| Customer/admin order IDOR | OK | Scoped checks verified |
| Prisma raw SQL | OK | Parameterized / `Prisma.join` only |

### 05 Attacker perspective — residual risks (human review)

| Attack | Mitigation | Residual |
| --- | --- | --- |
| XSS session theft | httpOnly cookies + no JS session writes | Login JSON still returns `token` for API clients — prefer omit in production browsers |
| Mass signup | Register throttle | CAPTCHA / email verification not implemented |
| Coupon races under extreme concurrency | Capped updateMany | Per-customer limit at pay time still best-effort vs concurrent checkouts |
| MFA optional for HQ | Supported but not forced | Enforce MFA for Super Admin / ADMIN in production ops |
| Mock POS if `ALLOW_MOCK_POS_TERMINAL=1` | Flag required | Never set on a live till |
| Full Stripe webhook payloads in DB | Ledger for ops | May contain billing PII — retention/redaction policy needed |
| Super Admin / VPS credentials historically exposed | Scrubbed from tree | **Rotate VPS SSH and Super Admin password on any deployed host** |

### Ops checklist before real money

1. Rotate Super Admin password and any credential that appeared in git/chat history  
2. Set strong `AUTH_SECRET`, Stripe **live** keys + webhook secret, Twilio if SMS is used  
3. Confirm `APP_URL` / `ADMIN_URL` / CORS match public origins  
4. Leave `ALLOW_MOCK_POS_TERMINAL` unset  
5. Enable MFA for all HQ staff  
6. Commission a human payment-flow review (webhooks, refunds, POS)
