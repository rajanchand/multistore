-- AlterTable Category
ALTER TABLE "Category" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "allBranches" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable Brand
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "allBranches" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE INDEX "Brand_isVisible_idx" ON "Brand"("isVisible");
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

-- CreateTable CategoryBranch
CREATE TABLE "CategoryBranch" (
    "categoryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "CategoryBranch_pkey" PRIMARY KEY ("categoryId","branchId")
);

CREATE INDEX "CategoryBranch_branchId_idx" ON "CategoryBranch"("branchId");

ALTER TABLE "CategoryBranch" ADD CONSTRAINT "CategoryBranch_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryBranch" ADD CONSTRAINT "CategoryBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable BrandBranch
CREATE TABLE "BrandBranch" (
    "brandId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "BrandBranch_pkey" PRIMARY KEY ("brandId","branchId")
);

CREATE INDEX "BrandBranch_branchId_idx" ON "BrandBranch"("branchId");

ALTER TABLE "BrandBranch" ADD CONSTRAINT "BrandBranch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandBranch" ADD CONSTRAINT "BrandBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Category_isVisible_idx" ON "Category"("isVisible");
