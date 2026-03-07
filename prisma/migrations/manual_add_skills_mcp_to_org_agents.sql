-- Add starterPrompts to OrgAgent
ALTER TABLE "OrgAgent" ADD COLUMN IF NOT EXISTS "starterPrompts" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create OrgAgentSkill join table
CREATE TABLE IF NOT EXISTS "OrgAgentSkill" (
    "id" TEXT NOT NULL,
    "orgAgentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    CONSTRAINT "OrgAgentSkill_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgAgentSkill" ADD CONSTRAINT "OrgAgentSkill_orgAgentId_skillId_key" UNIQUE ("orgAgentId", "skillId");
ALTER TABLE "OrgAgentSkill" ADD CONSTRAINT "OrgAgentSkill_orgAgentId_fkey" FOREIGN KEY ("orgAgentId") REFERENCES "OrgAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgAgentSkill" ADD CONSTRAINT "OrgAgentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create OrgAgentMcpServer join table
CREATE TABLE IF NOT EXISTS "OrgAgentMcpServer" (
    "id" TEXT NOT NULL,
    "orgAgentId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    CONSTRAINT "OrgAgentMcpServer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgAgentMcpServer" ADD CONSTRAINT "OrgAgentMcpServer_orgAgentId_mcpServerId_key" UNIQUE ("orgAgentId", "mcpServerId");
ALTER TABLE "OrgAgentMcpServer" ADD CONSTRAINT "OrgAgentMcpServer_orgAgentId_fkey" FOREIGN KEY ("orgAgentId") REFERENCES "OrgAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgAgentMcpServer" ADD CONSTRAINT "OrgAgentMcpServer_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
