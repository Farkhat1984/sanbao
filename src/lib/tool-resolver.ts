/**
 * Tool Resolver — resolves the full hierarchy of tools, skills, and MCP servers
 * for a given agent. Traverses:
 *   agent.tools (direct)
 *   agent.skills → skill.tools
 *   agent.mcpServers (direct)
 */

import { prisma } from "@/lib/prisma";
import { BoundedMap } from "@/lib/bounded-map";
import { cacheGet, cacheSet, cacheDel, getRedis } from "@/lib/redis";
import { getSettingNumber } from "@/lib/settings";
import { logger } from "@/lib/logger";

const REDIS_PREFIX = "agent_ctx:";
const agentContextCache = new BoundedMap<string, { context: ResolvedAgentContext; expiresAt: number }>(200);

/** Invalidate agent context cache (call after admin changes agents/tools/skills). */
export function invalidateAgentContextCache(agentId?: string) {
  if (agentId) {
    agentContextCache.delete(agentId);
    cacheDel(`${REDIS_PREFIX}${agentId}`).catch(() => {});
  } else {
    agentContextCache.clear();
    // Flush all agent_ctx:* keys from Redis using SCAN (non-blocking)
    const client = getRedis();
    if (client) {
      (async () => {
        try {
          let cursor = "0";
          do {
            const [next, keys] = await client.scan(cursor, "MATCH", `${REDIS_PREFIX}*`, "COUNT", 100);
            cursor = next;
            if (keys.length > 0) await client.del(...keys);
          } while (cursor !== "0");
        } catch (err) {
          logger.warn("Redis SCAN failed during agent context cache flush", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
  }
}

export interface PromptTool {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

import type { McpToolContext } from "@/lib/types/mcp";
export type { McpToolContext } from "@/lib/types/mcp";

export interface ResolvedAgentContext {
  systemPrompt: string;
  promptTools: PromptTool[];
  mcpTools: McpToolContext[];
  skillPrompts: string[];
  isSystem: boolean;
}

export async function resolveAgentContext(
  agentId: string
): Promise<ResolvedAgentContext> {
  const agentContextTtl = await getSettingNumber("cache_agent_context_ttl_ms");
  const redisAgentTtl = await getSettingNumber("cache_agent_context_redis_ttl_s");

  // L1: in-memory cache (per-process, ~30s TTL)
  const cached = agentContextCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  // L2: Redis cache (shared across replicas, ~60s TTL)
  try {
    const redisVal = await cacheGet(`${REDIS_PREFIX}${agentId}`);
    if (redisVal) {
      const ctx = JSON.parse(redisVal) as ResolvedAgentContext;
      agentContextCache.set(agentId, { context: ctx, expiresAt: Date.now() + agentContextTtl });
      return ctx;
    }
  } catch (err) {
    // Redis unavailable or parse error — fall through to DB
    logger.warn("Agent context L2 Redis cache miss", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      files: { select: { extractedText: true, fileName: true, inContext: true, fileSize: true } },
      skills: { include: { skill: { include: { tools: { include: { tool: true } } } } } },
      mcpServers: { include: { mcpServer: true } },
      tools: { include: { tool: true } },
      integrations: { include: { integration: true } },
    },
  });

  if (!agent) {
    return { systemPrompt: "", promptTools: [], mcpTools: [], skillPrompts: [], isSystem: false };
  }

  // Build system prompt
  let systemPrompt = agent.instructions;

  // In-context files: inject content directly into system prompt (with budget cap)
  const MAX_CONTEXT_CHARS = await getSettingNumber('tool_agent_max_context_chars');

  const contextFiles = agent.files.filter((f) => f.extractedText);

  // Fit files into context budget; overflow files get truncated previews
  let contextBudget = MAX_CONTEXT_CHARS;
  const parts: string[] = [];

  for (const f of contextFiles) {
    const text = f.extractedText!;
    if (text.length <= contextBudget) {
      // Full file fits
      parts.push(`--- File: ${f.fileName} ---\n${text}`);
      contextBudget -= text.length;
    } else if (contextBudget > 500) {
      // Include truncated preview with remaining budget
      const truncated = text.slice(0, contextBudget - 50);
      parts.push(`--- File: ${f.fileName} (truncated) ---\n${truncated}\n... [file truncated, ${Math.round(text.length / 1024)}KB total]`);
      contextBudget = 0;
    }
    // else: no budget left, skip silently
  }

  if (parts.length > 0) {
    systemPrompt += `\n\n--- Uploaded files context ---\n${parts.join("\n\n")}`;
  }

  // Collect tools (deduplicate by id)
  const toolMap = new Map<string, PromptTool>();
  const mcpServerMap = new Map<string, boolean>(); // track deduplication
  const mcpTools: McpToolContext[] = [];
  const skillPrompts: string[] = [];
  const seenSkillIds = new Set<string>();

  // Helper: process a skill
  const processSkill = (skill: {
    id: string;
    name: string;
    systemPrompt: string;
    citationRules: string | null;
    jurisdiction: string | null;
    tools: Array<{ tool: { id: string; name: string; description: string | null; icon: string; iconColor: string; type: string; config: unknown; sortOrder: number; isActive: boolean } }>;
  }) => {
    if (seenSkillIds.has(skill.id)) return;
    seenSkillIds.add(skill.id);

    let sp = `\n\n--- Skill: ${skill.name} ---\n${skill.systemPrompt}`;
    if (skill.citationRules) {
      sp += `\n\nCITATION RULES:\n${skill.citationRules}`;
    }
    if (skill.jurisdiction) {
      sp += `\nJURISDICTION: ${skill.jurisdiction}`;
    }
    skillPrompts.push(sp);

    // Fire-and-forget usage tracking
    prisma.skill.update({ where: { id: skill.id }, data: { usageCount: { increment: 1 } } }).catch(() => {});

    // Skill's tools
    for (const st of skill.tools) {
      if (st.tool.isActive && !toolMap.has(st.tool.id)) {
        toolMap.set(st.tool.id, {
          id: st.tool.id,
          name: st.tool.name,
          description: st.tool.description,
          icon: st.tool.icon,
          iconColor: st.tool.iconColor,
          type: st.tool.type,
          config: st.tool.config as Record<string, unknown>,
          sortOrder: st.tool.sortOrder,
        });
      }
    }
  };

  // Helper: process a tool record
  const processTool = (tool: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    iconColor: string;
    type: string;
    config: unknown;
    sortOrder: number;
    isActive: boolean;
  }) => {
    if (!tool.isActive || toolMap.has(tool.id)) return;
    toolMap.set(tool.id, {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      icon: tool.icon,
      iconColor: tool.iconColor,
      type: tool.type,
      config: tool.config as Record<string, unknown>,
      sortOrder: tool.sortOrder,
    });
  };

  /** Domain mapping config from AgentMcpServer link */
  interface DomainMappingsConfig {
    defaultDomain?: string;
    toolDomains?: Record<string, string>;
  }

  // Helper: process MCP server (with optional allowedTools filter and domain mappings)
  const processMcpServer = (
    srv: {
      id: string;
      url: string;
      transport: string;
      apiKey: string | null;
      status: string;
      discoveredTools: unknown;
    },
    allowedTools?: string[] | null,
    domainMappings?: DomainMappingsConfig | null,
  ) => {
    if (srv.status !== "CONNECTED" || !srv.discoveredTools || !Array.isArray(srv.discoveredTools) || mcpServerMap.has(srv.id)) return;
    mcpServerMap.set(srv.id, true);

    const allowedSet = allowedTools && allowedTools.length > 0
      ? new Set(allowedTools)
      : null;

    const tools = srv.discoveredTools as Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
    for (const tool of tools) {
      // Skip tools not in the whitelist (if whitelist is set)
      if (allowedSet && !allowedSet.has(tool.name)) continue;

      mcpTools.push({
        url: srv.url,
        transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
        apiKey: srv.apiKey,
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema || {},
        mcpServerId: srv.id,
        defaultDomain: domainMappings?.defaultDomain,
        toolDomains: domainMappings?.toolDomains,
      });
    }
  };

  // 1. Agent's direct tools
  for (const at of agent.tools) {
    processTool(at.tool);
  }

  // 2. Agent's direct skills
  for (const as of agent.skills) {
    processSkill(as.skill);
  }

  // 3. Agent's direct MCP servers (with allowedTools filter + domain mappings)
  for (const ams of agent.mcpServers) {
    processMcpServer(
      ams.mcpServer,
      ams.allowedTools as string[] | null,
      ams.domainMappings as DomainMappingsConfig | null,
    );
  }

  // 4. Agent's integrations — inject compact catalog index into system prompt
  const catalogPreviewChars = await getSettingNumber('tool_catalog_preview_chars');
  if ("integrations" in agent && Array.isArray(agent.integrations)) {
    for (const ai of agent.integrations as Array<{ integration: { status: string; type: string; catalog: string | null; name: string; baseUrl: string } }>) {
      const intg = ai.integration;
      if (intg.status !== "CONNECTED") continue;

      if (intg.type === "WHATSAPP") {
        systemPrompt += `\n\n--- Интеграция: ${intg.name} (WhatsApp) ---`;
        systemPrompt += `\nУ вас есть WhatsApp интеграция "${intg.name}". Доступные инструменты:`;
        systemPrompt += `\n- whatsapp_send(phone, message) — отправить текстовое сообщение`;
        systemPrompt += `\n- whatsapp_send_media(phone, url, caption) — отправить медиа (изображение, видео, документ) по URL`;
        systemPrompt += `\n- whatsapp_contacts(search?) — поиск и список контактов`;
        systemPrompt += `\n- whatsapp_messages(phone?, limit?) — последние сообщения`;
        systemPrompt += `\n\nФормат номера: международный без «+» (например: 77001234567)`;
      } else if (intg.type === "TELEGRAM") {
        systemPrompt += `\n\n--- Интеграция: ${intg.name} (Telegram) ---`;
        systemPrompt += `\nУ вас есть Telegram бот "${intg.name}". Доступные инструменты:`;
        systemPrompt += `\n- telegram_send(chatId, message, parseMode?) — отправить текстовое сообщение`;
        systemPrompt += `\n- telegram_send_media(chatId, url, type?, caption?) — отправить медиа (photo/document/voice/video)`;
        systemPrompt += `\n- telegram_send_keyboard(chatId, message, buttons) — отправить сообщение с inline-кнопками`;
        systemPrompt += `\n- telegram_chats(limit?) — список недавних чатов`;
        systemPrompt += `\n- telegram_messages(chatId?, limit?) — последние сообщения`;
        systemPrompt += `\n- telegram_bot_info() — информация о боте`;
        systemPrompt += `\n\nchatId — числовой ID чата Telegram. Можно отправлять inline-кнопки (keyboard).`;
      } else if (intg.catalog) {
        let indexText: string;
        try {
          const parsed = JSON.parse(intg.catalog);
          if (parsed.version === 2 && parsed.index) {
            indexText = parsed.index;
          } else {
            indexText = intg.catalog.slice(0, catalogPreviewChars) + "\n... (catalog outdated, run rediscovery)";
          }
        } catch {
          indexText = intg.catalog.slice(0, catalogPreviewChars) + "\n... (catalog outdated, run rediscovery)";
        }
        systemPrompt += `\n\n--- Integration: ${intg.name} (${intg.baseUrl}) ---\n${indexText}`;
        systemPrompt += `\n\nTo browse entities in a category: odata_catalog(section="..."). To query data: odata_query(entity="...").`;
      }
    }
  }

  // Sort tools by sortOrder
  const promptTools = Array.from(toolMap.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const result: ResolvedAgentContext = {
    systemPrompt,
    promptTools,
    mcpTools,
    skillPrompts,
    isSystem: agent.isSystem,
  };

  // L1: in-memory
  agentContextCache.set(agentId, { context: result, expiresAt: Date.now() + agentContextTtl });

  // L2: Redis (fire-and-forget)
  cacheSet(`${REDIS_PREFIX}${agentId}`, JSON.stringify(result), redisAgentTtl).catch(() => {});

  return result;
}
