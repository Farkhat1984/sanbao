// ─── Agent & tool resolution for chat route ─────────────
// Extracted from route.ts — handles agent context resolution,
// org agent loading (via loadOrgAgentContext), MCP tool loading,
// deduplication, skill loading, and prompt augmentation.

import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { resolveAgentContext } from "@/lib/tool-resolver";
import { resolveWithExperiment } from "@/lib/ab-experiment";
import { getPrompt, PROMPT_REGISTRY } from "@/lib/prompts";
import { loadOrgAgentContext, checkOrgAgentAccess } from "@/lib/swarm/agent-loader";
import type { McpToolContext } from "@/lib/types/mcp";
import type { NextResponse } from "next/server";

// ─── Types ──────────────────────────────────────────────

export interface AgentResolutionResult {
  systemPrompt: string;
  mcpTools: McpToolContext[];
  /** Updated orgAgentId (may be resolved from conversation fallback) */
  orgAgentId?: string;
}

// ─── MCP tool deduplication ─────────────────────────────

/** Namespace prefix from MCP server URL path (e.g. "/accountant" -> "accountant") */
function urlNamespace(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segment = path.split("/").filter(Boolean).pop() || "mcp";
    return segment.replace(/[^a-zA-Z0-9_]/g, "_");
  } catch {
    return "mcp";
  }
}

/** Sanitize tool name for LLM API compatibility: must start with letter, only [a-zA-Z0-9_-] */
function sanitizeToolName(name: string): string {
  let s = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!s || !/^[a-zA-Z]/.test(s)) s = "t_" + s;
  return s;
}

/**
 * Deduplicate MCP tools by name. When multiple servers expose tools with the same
 * name (e.g. "search"), prefix them with a namespace derived from the URL path.
 */
export function deduplicateMcpTools(tools: McpToolContext[]): McpToolContext[] {
  // 1. Detect which names collide
  const nameCount = new Map<string, number>();
  for (const tool of tools) {
    nameCount.set(tool.name, (nameCount.get(tool.name) || 0) + 1);
  }

  // 2. Deduplicate: namespace colliding tools, keep unique ones as-is
  const seen = new Set<string>();
  const deduped: McpToolContext[] = [];
  for (const tool of tools) {
    const isCollision = (nameCount.get(tool.name) || 0) > 1;
    const rawName = isCollision
      ? `${urlNamespace(tool.url)}_${tool.name}`
      : tool.name;
    const finalName = sanitizeToolName(rawName);

    if (!seen.has(finalName)) {
      seen.add(finalName);
      deduped.push({
        ...tool,
        originalName: tool.name,
        name: finalName,
      });
    }
  }
  return deduped;
}

// ─── MCP server tool extraction ─────────────────────────

interface McpServerRecord {
  id: string;
  url: string;
  transport: string;
  apiKey: string | null;
  status: string;
  discoveredTools: unknown;
  isGlobal?: boolean;
  isEnabled?: boolean;
}

function extractToolsFromServer(srv: McpServerRecord, existing: McpToolContext[]): McpToolContext[] {
  if (srv.status !== "CONNECTED" || !Array.isArray(srv.discoveredTools)) return [];
  const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  const result: McpToolContext[] = [];
  for (const tool of tools) {
    if (!existing.some((t) => t.name === tool.name) && !result.some((t) => t.name === tool.name)) {
      result.push({
        url: srv.url,
        transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
        apiKey: srv.apiKey,
        mcpServerId: srv.id,
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema || {},
      });
    }
  }
  return result;
}

// ─── User MCP servers ───────────────────────────────────

async function loadUserMcpTools(userId: string, existing: McpToolContext[]): Promise<McpToolContext[]> {
  const result: McpToolContext[] = [];

  // User-enabled global MCP servers
  const userGlobalMcps = await prisma.userMcpServer.findMany({
    where: { userId, isActive: true },
    include: {
      mcpServer: {
        select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true, isGlobal: true, isEnabled: true },
      },
    },
  });
  for (const link of userGlobalMcps) {
    const srv = link.mcpServer;
    if (!srv.isGlobal || !srv.isEnabled) continue;
    result.push(...extractToolsFromServer(srv, [...existing, ...result]));
  }

  // User's own connected MCP servers
  const userOwnMcps = await prisma.mcpServer.findMany({
    where: { userId, status: "CONNECTED", isGlobal: false },
    select: { id: true, url: true, transport: true, apiKey: true, discoveredTools: true },
  });
  for (const srv of userOwnMcps) {
    if (!Array.isArray(srv.discoveredTools)) continue;
    result.push(...extractToolsFromServer(
      { ...srv, status: "CONNECTED" } as McpServerRecord,
      [...existing, ...result]
    ));
  }

  return result;
}

// ─── Org agent resolution ───────────────────────────────

/**
 * Load org agent context and check access. Returns tools + prompt additions,
 * or an error response if access denied.
 */
async function resolveOrgAgent(
  orgAgentId: string,
  userId: string,
): Promise<{ tools: McpToolContext[]; promptAddition: string } | { error: NextResponse }> {
  const ctx = await loadOrgAgentContext(orgAgentId, userId);
  if (!ctx) {
    return { tools: [], promptAddition: "" };
  }

  // Verify user is member of the org
  const orgAgent = await prisma.orgAgent.findUnique({
    where: { id: orgAgentId },
    select: { orgId: true, accessMode: true },
  });
  if (!orgAgent) {
    return { tools: [], promptAddition: "" };
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: orgAgent.orgId, userId } },
  });
  if (!membership) {
    return { error: jsonError("Нет доступа к этому агенту", 403) };
  }

  // Check access mode
  if (orgAgent.accessMode === "SPECIFIC" && membership.role === "MEMBER") {
    const access = await prisma.orgAgentMember.findUnique({
      where: { orgAgentId_userId: { orgAgentId, userId } },
    });
    if (!access) {
      return { error: jsonError("Нет доступа к этому агенту", 403) };
    }
  }

  // Build prompt addition from the loaded context
  let promptAddition = `\n\n${ctx.systemPrompt}`;
  promptAddition += "\n\nIMPORTANT: You are a specialized organization agent. Do NOT create documents (<sanbao-doc>) without explicit user request. Respond with plain text.";

  // Apply skill prompts
  for (const sp of ctx.skillPrompts) {
    promptAddition += sp;
  }

  return { tools: ctx.mcpTools, promptAddition };
}

// ─── Main resolution function ───────────────────────────

/**
 * Resolve agent context: system prompt, MCP tools, skills, and prompt augmentations.
 * Handles regular agents, org agents, user MCP servers, skill loading,
 * A/B experiments, and mode-specific prompts.
 */
export async function resolveAgentAndTools(params: {
  agentId?: string;
  orgAgentId?: string;
  skillId?: string;
  conversationId?: string;
  userId: string;
  planId: string;
  thinkingEnabled: boolean;
  maxMcpTools: number;
}): Promise<{ data: AgentResolutionResult } | { error: NextResponse }> {
  const { userId, planId, thinkingEnabled, maxMcpTools } = params;
  let { agentId, orgAgentId, skillId, conversationId } = params;

  // Load admin-editable system prompt from DB (cached 60s)
  let systemPrompt = await getPrompt("prompt_system_global");
  const agentMcpTools: McpToolContext[] = [];

  // ─── Regular agent resolution ───────────────────────
  if (agentId) {
    const ctx = await resolveAgentContext(agentId);
    if (ctx.systemPrompt) {
      // Global system prompt is always prepended to agent-specific instructions
      systemPrompt = systemPrompt + "\n\n" + ctx.systemPrompt + ctx.skillPrompts.join("");
      agentMcpTools.push(...ctx.mcpTools);
      // Custom (non-system) agents: suppress artifact creation unless explicitly requested
      if (!ctx.isSystem) {
        systemPrompt += "\n\nIMPORTANT: You are a specialized agent. Do NOT create documents (<sanbao-doc>) without explicit user request. Respond with plain text. Create a document ONLY if the user explicitly asks.";
      }
    }
  }

  // ─── Org agent fallback from conversation ───────────
  if (!orgAgentId && !agentId && conversationId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { orgAgentId: true },
    });
    if (conv?.orgAgentId) {
      orgAgentId = conv.orgAgentId;
    }
  }

  // ─── Org agent loading ─────────────────────────────
  if (orgAgentId && !agentId) {
    const result = await resolveOrgAgent(orgAgentId, userId);
    if ("error" in result) {
      return { error: result.error };
    }
    systemPrompt += result.promptAddition;
    agentMcpTools.push(...result.tools);
  }

  // ─── User MCP servers ──────────────────────────────
  const userTools = await loadUserMcpTools(userId, agentMcpTools);
  agentMcpTools.push(...userTools);

  // ─── Deduplicate MCP tools ─────────────────────────
  const dedupedTools = deduplicateMcpTools(agentMcpTools);

  // Cap MCP tools to prevent unbounded growth
  const cappedTools = dedupedTools.slice(0, maxMcpTools);

  // ─── Skill loading ─────────────────────────────────
  if (skillId) {
    const skill = await prisma.skill.findFirst({
      where: {
        id: skillId,
        OR: [{ isBuiltIn: true }, { userId }, { isPublic: true }],
      },
    });
    if (skill) {
      let skillPrompt = skill.systemPrompt;
      if (skill.citationRules) {
        skillPrompt += `\n\nCITATION RULES:\n${skill.citationRules}`;
      }
      if (skill.jurisdiction) {
        skillPrompt += `\n\nJURISDICTION: ${skill.jurisdiction}`;
      }
      systemPrompt = `${skillPrompt}\n\n${systemPrompt}`;
    }
  }

  // ─── A/B experiment augmentation ───────────────────
  {
    const ab = await resolveWithExperiment("prompt_system_global", systemPrompt, userId);
    if (ab.experimentId && ab.value && ab.value !== systemPrompt) {
      systemPrompt = `${ab.value}\n\n${systemPrompt}`;
    }
  }

  // ─── Mode-specific prompts ─────────────────────────

  // Web search prompt is always included
  systemPrompt += "\n\n" + await getPrompt("prompt_mode_websearch");

  if (thinkingEnabled) {
    systemPrompt += "\n\n" + await getPrompt("prompt_mode_thinking");
  }

  return {
    data: {
      systemPrompt,
      mcpTools: cappedTools,
      orgAgentId,
    },
  };
}
