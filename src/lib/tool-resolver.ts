/**
 * Tool Resolver — resolves the full hierarchy of tools, skills, and MCP servers
 * for a given agent. Traverses:
 *   agent.tools (direct)
 *   agent.skills → skill.tools
 *   agent.plugins → plugin.tools
 *   agent.plugins → plugin.skills → skill.tools
 *   agent.mcpServers (direct)
 *   agent.plugins → plugin.mcpServers
 */

import { prisma } from "@/lib/prisma";
import { BoundedMap } from "@/lib/bounded-map";
import { cacheGet, cacheSet, cacheDel, getRedis } from "@/lib/redis";

const AGENT_CONTEXT_TTL = 30_000; // 30 seconds
const REDIS_AGENT_TTL = 60; // 60 seconds in Redis (shared L2)
const REDIS_PREFIX = "agent_ctx:";
const agentContextCache = new BoundedMap<string, { context: ResolvedAgentContext; expiresAt: number }>(200);

/** Invalidate agent context cache (call after admin changes agents/tools/plugins). */
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
        } catch { /* Redis unavailable */ }
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

export interface McpToolContext {
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

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
      agentContextCache.set(agentId, { context: ctx, expiresAt: Date.now() + AGENT_CONTEXT_TTL });
      return ctx;
    }
  } catch {
    // Redis unavailable or parse error — fall through to DB
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      files: { select: { extractedText: true, fileName: true, inContext: true, fileSize: true } },
      skills: { include: { skill: { include: { tools: { include: { tool: true } } } } } },
      mcpServers: { include: { mcpServer: true } },
      tools: { include: { tool: true } },
      plugins: {
        include: {
          plugin: {
            include: {
              tools: { include: { tool: true } },
              skills: { include: { skill: { include: { tools: { include: { tool: true } } } } } },
              mcpServers: { include: { mcpServer: true } },
            },
          },
        },
      },
    },
  });

  if (!agent) {
    return { systemPrompt: "", promptTools: [], mcpTools: [], skillPrompts: [], isSystem: false };
  }

  // Build system prompt
  let systemPrompt = agent.instructions;

  // In-context files: inject content directly into system prompt
  const inContextFiles = agent.files.filter((f) => f.inContext && f.extractedText);
  const lazyFiles = agent.files.filter((f) => !f.inContext);

  const filesContext = inContextFiles
    .map((f) => `--- Файл: ${f.fileName} ---\n${f.extractedText}`)
    .join("\n\n");

  if (filesContext) {
    systemPrompt += `\n\n--- Контекст из загруженных файлов ---\n${filesContext}`;
  }

  // Lazy files: only list names, agent must use read_knowledge tool to access
  if (lazyFiles.length > 0) {
    const fileList = lazyFiles
      .map((f) => `- ${f.fileName} (${Math.round(f.fileSize / 1024)}KB)`)
      .join("\n");
    systemPrompt += `\n\n--- Файлы знаний (доступны через инструмент read_knowledge) ---\n${fileList}\nДля чтения содержимого этих файлов используй инструмент read_knowledge с поисковым запросом.`;
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

    let sp = `\n\n--- Скилл: ${skill.name} ---\n${skill.systemPrompt}`;
    if (skill.citationRules) {
      sp += `\n\nПРАВИЛА ЦИТИРОВАНИЯ:\n${skill.citationRules}`;
    }
    if (skill.jurisdiction) {
      sp += `\nЮРИСДИКЦИЯ: ${skill.jurisdiction}`;
    }
    skillPrompts.push(sp);

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

  // Helper: process MCP server
  const processMcpServer = (srv: {
    id: string;
    url: string;
    transport: string;
    apiKey: string | null;
    status: string;
    discoveredTools: unknown;
  }) => {
    if (srv.status !== "CONNECTED" || !srv.discoveredTools || !Array.isArray(srv.discoveredTools) || mcpServerMap.has(srv.id)) return;
    mcpServerMap.set(srv.id, true);

    const tools = srv.discoveredTools as Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
    for (const tool of tools) {
      mcpTools.push({
        url: srv.url,
        transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
        apiKey: srv.apiKey,
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema || {},
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

  // 3. Agent's direct MCP servers
  for (const ams of agent.mcpServers) {
    processMcpServer(ams.mcpServer);
  }

  // 4. Agent's plugins
  for (const ap of agent.plugins) {
    const plugin = ap.plugin;
    if (!plugin.isActive) continue;

    // Plugin's tools
    for (const pt of plugin.tools) {
      processTool(pt.tool);
    }

    // Plugin's skills
    for (const ps of plugin.skills) {
      processSkill(ps.skill);
    }

    // Plugin's MCP servers
    for (const pms of plugin.mcpServers) {
      processMcpServer(pms.mcpServer);
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
  agentContextCache.set(agentId, { context: result, expiresAt: Date.now() + AGENT_CONTEXT_TTL });

  // L2: Redis (fire-and-forget)
  cacheSet(`${REDIS_PREFIX}${agentId}`, JSON.stringify(result), REDIS_AGENT_TTL).catch(() => {});

  return result;
}
