-- Add canUseMcp column to Plan
ALTER TABLE "Plan" ADD COLUMN "canUseMcp" BOOLEAN NOT NULL DEFAULT false;

-- Fix defaults per spec:
-- Free: only canUseReasoning = true, rest false
-- Pro: canUseAgents, canUseReasoning, canUseSkills, canUseMcp = true; canUseMultiAgents, canUseIntegrations, canUseRag = false
-- Business: all true

-- Enable reasoning for Free plan
UPDATE "Plan" SET "canUseReasoning" = true WHERE "slug" = 'free';

-- Pro: enable MCP, disable integrations
UPDATE "Plan" SET "canUseMcp" = true, "canUseIntegrations" = false WHERE "slug" = 'pro';

-- Business: enable all
UPDATE "Plan" SET "canUseMcp" = true WHERE "slug" = 'business';
