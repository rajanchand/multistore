import type { Prisma, PrismaClient } from '@repo/database';

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Ensure Postgres sequence used for ORD-###### numbers exists and is aligned
 * with existing orders. Safe to call repeatedly (CREATE IF NOT EXISTS + setval).
 */
export async function ensureOrderNumberSequence(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS order_number_seq`);
  await db.$executeRawUnsafe(`
    SELECT setval(
      'order_number_seq',
      GREATEST(
        (
          SELECT COALESCE(
            MAX(NULLIF(regexp_replace("orderNumber", '\\D', '', 'g'), '')::bigint),
            0
          )
          FROM "Order"
        ),
        (SELECT last_value FROM order_number_seq)
      ),
      true
    )
  `);
}

/**
 * Allocate the next ORD-###### value from Postgres sequence `order_number_seq`.
 */
export async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  // DDL inside an aborted/rolled-back transaction would disappear — create outside
  // callers when possible. Still attempt IF NOT EXISTS here as a safety net.
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS order_number_seq`);
  const seqRows = await tx.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT nextval('order_number_seq') AS n
  `;
  const seq = Number(seqRows[0]?.n ?? 0);
  return `ORD-${String(seq).padStart(6, '0')}`;
}
