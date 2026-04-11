-- Add instructions field to MultiAgent (system prompt for multi-agent teams)
ALTER TABLE "MultiAgent" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
