-- Add allowedTools and domainMappings to AgentMcpServer
-- for unified MCP endpoint domain routing

ALTER TABLE "AgentMcpServer" ADD COLUMN IF NOT EXISTS "allowedTools" JSONB;
ALTER TABLE "AgentMcpServer" ADD COLUMN IF NOT EXISTS "domainMappings" JSONB;
