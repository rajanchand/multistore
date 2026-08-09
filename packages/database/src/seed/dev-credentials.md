# Development credentials (NEVER use in production)

Password for most seed accounts: `DevPassword123!`

Super Admin password defaults to the same unless you set:

```bash
SEED_SUPERADMIN_USERNAME=rajan.chand
SEED_SUPERADMIN_PASSWORD='your-local-only-password'
```

Do **not** commit production passwords. On the VPS, change the Super Admin password via the admin UI or a one-off DB update — do not rely on seed defaults for live access.

## Staff

| Role | Login | Password |
| --- | --- | --- |
| Super Admin | username from `SEED_SUPERADMIN_USERNAME` (default `rajan.chand`) or email `superadmin@dev.local` | `SEED_SUPERADMIN_PASSWORD` or `DevPassword123!` |
| Admin | `admin@dev.local` | `DevPassword123!` |
| Glasgow Manager | `manager.glasgow@dev.local` | `DevPassword123!` |
| Edinburgh Manager | `manager.edinburgh@dev.local` | `DevPassword123!` |
| Paisley Manager | `manager.paisley@dev.local` | `DevPassword123!` |
| Manchester Manager | `manager.manchester@dev.local` | `DevPassword123!` |
| London Manager | `manager.london@dev.local` | `DevPassword123!` |
| Inventory (Glasgow) | `inventory.glasgow@dev.local` | `DevPassword123!` |
| Marketing | `marketing@dev.local` | `DevPassword123!` |
| Support | `support@dev.local` | `DevPassword123!` |

## Customers

| Email |
| --- |
| alice@example.dev |
| bob@example.dev |
| carol@example.dev |
| dan@example.dev |
| erin@example.dev |
| frank@example.dev |
| grace@example.dev |
| henry@example.dev |
| walk-in@pos.local (synthetic — used by POS / cash till sales) |

## POS till

- Permission: `pos.use` (included on SUPER_ADMIN, ADMIN, BRANCH_MANAGER)
- Admin URL: `/pos` (select branch first if HQ)
- Edinburgh: sign in as `manager.edinburgh@dev.local`, open **POS**
- Sample barcodes / SKUs (seed catalogue):
  - `5060166690034` / `MON-ORIG-500` — Monster Energy Original
  - `5060337500401` / `MON-ULTRA-500` — Monster Ultra (default variant)
  - `9002490100070` / `RB-ORIG-250` — Red Bull
  - `5449000000996` — Coca-Cola (see seed products)
- Cash: complete on till. Card: opens mock POS machine at `/pos/terminal/[sessionId]` (Approve / Decline).
- Re-seed after pull so `pos.use` is granted to system roles: `pnpm --filter @repo/database seed` (or project seed script).
