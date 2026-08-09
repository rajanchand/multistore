-- Scale readiness: Customer list/filter indexes + order number sequence
CREATE INDEX IF NOT EXISTS "Customer_isActive_idx" ON "Customer"("isActive");
CREATE INDEX IF NOT EXISTS "Customer_deletedAt_idx" ON "Customer"("deletedAt");
CREATE INDEX IF NOT EXISTS "Customer_preferredBranchId_idx" ON "Customer"("preferredBranchId");

-- Contiguous order numbers without SELECT count(*) under checkout load
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Align sequence with existing orders so numbers do not collide after deploy
SELECT setval(
  'order_number_seq',
  COALESCE(
    (
      SELECT MAX(NULLIF(regexp_replace("orderNumber", '\D', '', 'g'), '')::bigint)
      FROM "Order"
    ),
    0
  ),
  true
);
