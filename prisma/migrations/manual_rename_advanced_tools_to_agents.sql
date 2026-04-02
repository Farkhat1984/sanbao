-- Rename canUseAdvancedTools → canUseAgents
ALTER TABLE "Plan" RENAME COLUMN "canUseAdvancedTools" TO "canUseAgents";

-- Add canUseMultiAgents column
ALTER TABLE "Plan" ADD COLUMN "canUseMultiAgents" BOOLEAN NOT NULL DEFAULT false;

-- Set canUseMultiAgents = true for Business plan (which has canUseRag = true)
UPDATE "Plan" SET "canUseMultiAgents" = true WHERE "canUseRag" = true;
