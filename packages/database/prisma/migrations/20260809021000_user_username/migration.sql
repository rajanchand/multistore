-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill unique usernames from email local-part (collision-safe)
UPDATE "User" AS u
SET "username" = sub.uname
FROM (
  SELECT
    id,
    CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY lower(split_part(email, '@', 1)) ORDER BY "createdAt") = 1
        THEN lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]', '', 'g'))
      ELSE lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]', '', 'g'))
           || '-' || substr(replace(id::text, '-', ''), 1, 6)
    END AS uname
  FROM "User"
) AS sub
WHERE u.id = sub.id;

-- Ensure no empties
UPDATE "User" SET "username" = 'user-' || substr(replace(id::text, '-', ''), 1, 8)
WHERE "username" IS NULL OR "username" = '';

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
