-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'POS', 'CASH');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'ONLINE';

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");
