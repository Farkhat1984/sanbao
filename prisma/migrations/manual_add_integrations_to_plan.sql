-- Add canUseIntegrations column to Plan
ALTER TABLE "Plan" ADD COLUMN "canUseIntegrations" BOOLEAN NOT NULL DEFAULT false;

-- Enable integrations for Pro and Business plans (non-free plans with canUseAgents = true)
UPDATE "Plan" SET "canUseIntegrations" = true WHERE "canUseAgents" = true;
