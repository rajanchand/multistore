# Development credentials (NEVER use in production)

Password for all seed accounts: `DevPassword123!`

## Staff

| Role | Email |
| --- | --- |
| Super Admin | superadmin@dev.local |
| Glasgow Manager | manager.glasgow@dev.local |
| Edinburgh Manager | manager.edinburgh@dev.local |
| Paisley Manager | manager.paisley@dev.local |
| Manchester Manager | manager.manchester@dev.local |
| London Manager | manager.london@dev.local |
| Inventory (Glasgow) | inventory.glasgow@dev.local |
| Marketing | marketing@dev.local |
| Support | support@dev.local |

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
