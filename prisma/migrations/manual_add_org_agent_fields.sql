-- Add icon, iconColor, instructions fields to OrgAgent
ALTER TABLE "OrgAgent" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "OrgAgent" ADD COLUMN IF NOT EXISTS "iconColor" TEXT;
ALTER TABLE "OrgAgent" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
