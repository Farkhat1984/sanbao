-- Migration: Convert 4 system agents to user-created agents
-- Target: Production DB (sanbao)
-- Date: 2026-03-10
--
-- This migration:
-- 1. Converts 4 agents from system to user-owned (zfaragj@gmail.com)
-- 2. Removes old per-agent MCP servers (dead endpoints)
-- 3. Updates mcp-cortex as unified MCP → https://leema.kz/mcp
-- 4. Links all 4 agents to mcp-cortex with domain mappings

BEGIN;

-- 1a. Convert 4 agents: system → user-created
UPDATE "Agent" SET
  "isSystem" = false,
  "userId" = 'cmln2gum30000li01hzt4kcgy'
WHERE id IN (
  'system-femida-agent',
  'system-broker-agent',
  'system-accountant-agent',
  'system-1c-assistant-agent'
);

-- 1b. Delete ALL old agent-MCP links for these 4 agents
DELETE FROM "AgentMcpServer"
WHERE "agentId" IN (
  'system-femida-agent',
  'system-broker-agent',
  'system-accountant-agent',
  'system-1c-assistant-agent'
);

-- 1c. Delete old dead MCP servers (per-agent endpoints removed from orchestrator)
DELETE FROM "McpServer"
WHERE id IN ('mcp-lawyer', 'mcp-broker', 'mcp-accountingdb', 'mcp-consultant-1c');

-- 1d. Update mcp-cortex as unified MCP endpoint
UPDATE "McpServer" SET
  url = 'https://leema.kz/mcp',
  name = 'AI Cortex',
  "userId" = 'cmln2gum30000li01hzt4kcgy',
  "isGlobal" = false,
  status = 'CONNECTED'
WHERE id = 'mcp-cortex';

-- 1e. Link 4 agents to mcp-cortex with domain mappings
INSERT INTO "AgentMcpServer" (id, "agentId", "mcpServerId", "domainMappings")
VALUES
  (gen_random_uuid()::text, 'system-femida-agent', 'mcp-cortex',
   '{"defaultDomain":"legal_kz","toolDomains":{"get_law":"laws_kz","sql_query":"legal_ref_kz"}}'),
  (gen_random_uuid()::text, 'system-broker-agent', 'mcp-cortex',
   '{"defaultDomain":"tnved","toolDomains":{"sql_query":"tnved"}}'),
  (gen_random_uuid()::text, 'system-accountant-agent', 'mcp-cortex',
   '{"defaultDomain":"accounting_1c","toolDomains":{"sql_query":"accounting_ref_kz"}}'),
  (gen_random_uuid()::text, 'system-1c-assistant-agent', 'mcp-cortex',
   '{"defaultDomain":"platform_1c"}');

COMMIT;
