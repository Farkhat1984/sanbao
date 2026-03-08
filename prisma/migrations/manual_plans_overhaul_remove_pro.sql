-- 1. Add canUseSkills to Plan
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "canUseSkills" BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrate PRO users to USER before removing enum value
UPDATE "User" SET "role" = 'USER' WHERE "role" = 'PRO';

-- 3. Replace UserRole enum (Postgres cannot remove enum values directly)
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
DROP TYPE "UserRole_old";
