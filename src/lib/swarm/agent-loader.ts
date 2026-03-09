import { prisma } from "@/lib/prisma";
import type { McpToolContext } from "@/lib/types/mcp";

export interface OrgAgentContext {
  agentId: string;
  name: string;
  description: string | null;
  orgName: string;
  systemPrompt: string;
  mcpTools: McpToolContext[];
  skillPrompts: string[];
}

/**
 * Load full context for an org agent — system prompt, MCP tools, skills.
 * Extracted from chat route.ts for reuse in Swarm Mother multi-agent mode.
 */
export async function loadOrgAgentContext(
  orgAgentId: string,
  userId: string
): Promise<OrgAgentContext | null> {
  const orgAgent = await prisma.orgAgent.findUnique({
    where: { id: orgAgentId },
    include: {
      org: { select: { id: true, name: true } },
      mcpServer: {
        select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true },
      },
      skills: {
        include: {
          skill: {
            include: { tools: { include: { tool: true } } },
          },
        },
      },
      mcpServers: {
        include: {
          mcpServer: {
            select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true },
          },
        },
      },
    },
  });

  if (!orgAgent) return null;

  // Build system prompt
  let systemPrompt = `You are an AI agent of organization "${orgAgent.org.name}": ${orgAgent.name}.`;
  if (orgAgent.description) {
    systemPrompt += ` ${orgAgent.description}`;
  }
  if (orgAgent.instructions) {
    systemPrompt += `\n\n${orgAgent.instructions}`;
  }
  systemPrompt += "\nUse the search tool to find information in the organization's knowledge base. Use get_source for full context of a found chunk.";
  systemPrompt += "\n\nKNOWLEDGE BASE SEARCH RULES:";
  systemPrompt += "\n- Make ONE search query per user question. Do NOT make 3-4 queries in a row — it overflows context.";
  systemPrompt += "\n- If the first query returns no results, rephrase and try ONE more. Max 2 search calls per message.";
  systemPrompt += "\n- Use get_source ONLY when you need extended context of a specific found chunk.";
  systemPrompt += "\n- Search results may contain OCR artifacts (distorted text) — interpret them by meaning.";
  systemPrompt += "\n\nWhen citing data from the knowledge base, reference the source:\n[description](source://domain/file/chunk_number)\nExample: [Chapter 3](source://ns_proj123/report.pdf/5)";

  // Load MCP tools from org agent's pipeline server
  const mcpTools: McpToolContext[] = [];
  const srv = orgAgent.mcpServer;
  if (srv && srv.status === "CONNECTED" && Array.isArray(srv.discoveredTools)) {
    const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    for (const tool of tools) {
      mcpTools.push({
        url: srv.url,
        transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
        apiKey: srv.apiKey,
        mcpServerId: srv.id,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
  }

  // Apply skill prompts
  const skillPrompts: string[] = [];
  if (orgAgent.skills && orgAgent.skills.length > 0) {
    for (const as of orgAgent.skills) {
      const skill = as.skill;
      let sp = `\n\n--- Skill: ${skill.name} ---\n${skill.systemPrompt}`;
      if (skill.citationRules) sp += `\n\nCITATION RULES:\n${skill.citationRules}`;
      if (skill.jurisdiction) sp += `\nJURISDICTION: ${skill.jurisdiction}`;
      skillPrompts.push(sp);
    }
  }

  // Load additional MCP servers (beyond the pipeline-generated one)
  if (orgAgent.mcpServers && orgAgent.mcpServers.length > 0) {
    for (const ams of orgAgent.mcpServers) {
      const addSrv = ams.mcpServer;
      if (addSrv.status === "CONNECTED" && Array.isArray(addSrv.discoveredTools)) {
        const addTools = addSrv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
        for (const tool of addTools) {
          if (!mcpTools.some((t) => t.name === tool.name)) {
            mcpTools.push({
              url: addSrv.url,
              transport: addSrv.transport as "SSE" | "STREAMABLE_HTTP",
              apiKey: addSrv.apiKey,
              mcpServerId: addSrv.id,
              name: tool.name,
              description: tool.description || "",
              inputSchema: tool.inputSchema || {},
            });
          }
        }
      }
    }
  }

  return {
    agentId: orgAgent.id,
    name: orgAgent.name,
    description: orgAgent.description,
    orgName: orgAgent.org.name,
    systemPrompt,
    mcpTools,
    skillPrompts,
  };
}

/**
 * Universal agent context loader for multi-agent mode.
 * Supports system agents (Agent table, isSystem=true), user agents (Agent table), and org agents (OrgAgent table).
 */
export async function loadAgentContext(
  agentType: string,
  agentId: string,
  userId: string,
): Promise<OrgAgentContext | null> {
  if (agentType === "org") {
    return loadOrgAgentContext(agentId, userId);
  }

  // Load from Agent table (system or user agent)
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      mcpServers: {
        include: {
          mcpServer: {
            select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true },
          },
        },
      },
      skills: {
        include: {
          skill: {
            include: { tools: { include: { tool: true } } },
          },
        },
      },
    },
  });

  if (!agent) return null;

  // Build system prompt
  let systemPrompt = `You are ${agent.name}.`;
  if (agent.description) systemPrompt += ` ${agent.description}`;
  if (agent.instructions) systemPrompt += `\n\n${agent.instructions}`;

  // Load MCP tools
  const mcpTools: McpToolContext[] = [];
  if (agent.mcpServers) {
    for (const ams of agent.mcpServers) {
      const srv = ams.mcpServer;
      if (srv.status === "CONNECTED" && Array.isArray(srv.discoveredTools)) {
        const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
        for (const tool of tools) {
          if (!mcpTools.some((t) => t.name === tool.name)) {
            mcpTools.push({
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
      }
    }
  }

  // Load skill prompts
  const skillPrompts: string[] = [];
  if (agent.skills) {
    for (const as2 of agent.skills) {
      const skill = as2.skill;
      let sp = `\n\n--- Skill: ${skill.name} ---\n${skill.systemPrompt}`;
      if (skill.citationRules) sp += `\n\nCITATION RULES:\n${skill.citationRules}`;
      if (skill.jurisdiction) sp += `\nJURISDICTION: ${skill.jurisdiction}`;
      skillPrompts.push(sp);
    }
  }

  return {
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    orgName: agent.isSystem ? "Sanbao" : "Personal",
    systemPrompt,
    mcpTools,
    skillPrompts,
  };
}

/**
 * Check if a user has access to an org agent.
 * Returns true if accessible, false otherwise.
 */
export async function checkOrgAgentAccess(
  orgAgentId: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership) return false;

  const orgAgent = await prisma.orgAgent.findUnique({
    where: { id: orgAgentId },
    select: { accessMode: true },
  });
  if (!orgAgent) return false;

  if (orgAgent.accessMode === "ALL_MEMBERS") return true;
  if (membership.role === "OWNER" || membership.role === "ADMIN") return true;

  const access = await prisma.orgAgentMember.findUnique({
    where: { orgAgentId_userId: { orgAgentId, userId } },
  });
  return !!access;
}
