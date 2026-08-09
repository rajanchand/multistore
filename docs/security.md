# Security decisions

## Authentication

- Argon2id password hashing
- Opaque session tokens (SHA-256 hashed at rest), httpOnly cookies
- Failed-login lockouts + Nest throttling on auth routes
- Admin MFA via TOTP; secrets encrypted with AES-256-GCM derived from `AUTH_SECRET`

## Authorisation

- Permission catalogue in `@repo/types`
- `@RequirePermissions()` + `PermissionsGuard`
- `BranchAccessService` derives allowed branches from DB (`UserBranch` / `isGlobal`)
- Cross-branch IDOR attempts return 403

## Payments

- Stripe PaymentIntents; no card data stored
- Webhook signature verification required
- `PaymentEvent (provider, providerEventId)` unique for idempotency
- Orders marked PAID only after server-side provider confirmation

## Other controls

- Zod validation on all mutating payloads (mass-assignment resistant)
- Helmet security headers, CORS allowlist (`APP_URL` + `ADMIN_URL`, with localhost ↔ 127.0.0.1 mirrors), CSP-ready Next apps
- In production, set `APP_URL` / `ADMIN_URL` to the real storefront and admin origins or credentialed browser calls fail CORS
- Audit log redacts secrets
- Soft-delete for catalogue/users; hard-delete forbidden for orders/payments/audit
- Authorised branch IDs come from the DB session — never trust client-supplied branch IDs for access control
