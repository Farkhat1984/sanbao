-- Add swarm mode fields to Conversation
ALTER TABLE "Conversation" ADD COLUMN "isSwarmMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "swarmOrgId" TEXT;
CREATE INDEX "Conversation_swarmOrgId_idx" ON "Conversation"("swarmOrgId");

-- Add swarm fields to Organization
ALTER TABLE "Organization" ADD COLUMN "swarmEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "swarmStarterPrompts" TEXT[] DEFAULT ARRAY[]::TEXT[];
