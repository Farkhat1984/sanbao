import type { Prisma } from "@prisma/client";

/**
 * Discover MCP tools via raw JSON-RPC HTTP (no SDK dependency).
 * Used during seeding to auto-populate MCP server tool lists.
 */
export async function discoverMcpTools(
  url: string,
  apiKey: string | null
): Promise<{
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    // Step 1: Initialize
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "sanbao-seed", version: "1.0.0" },
        },
      }),
    });
    if (!initRes.ok) throw new Error(`Initialize failed: ${initRes.status}`);

    // Extract session ID from response header if present
    const sessionId = initRes.headers.get("mcp-session-id");
    if (sessionId) headers["mcp-session-id"] = sessionId;

    // Step 2: Send initialized notification
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    // Step 3: List tools
    const listRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    if (!listRes.ok) throw new Error(`tools/list failed: ${listRes.status}`);

    const listBody = await listRes.json();
    const rawTools = listBody?.result?.tools || [];
    const tools = rawTools.map(
      (t: {
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }) => ({
        name: t.name,
        description: t.description || "",
        inputSchema: (t.inputSchema || {}) as Record<string, unknown>,
      })
    );

    return { tools };
  } catch (e) {
    return { tools: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Type alias for the tool discovery result */
export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** Prisma JSON input type re-export for convenience */
export type JsonInputValue = Prisma.InputJsonValue;

/** Tool definition used across seed modules */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  sortOrder: number;
}

/** Tool definition with agent binding */
export interface ToolWithAgent extends ToolDefinition {
  agentId: string;
}

/** Specialized agent definition with MCP server config */
export interface SpecializedAgentDef {
  id: string;
  name: string;
  description: string;
  instructions: string;
  icon: string;
  iconColor: string;
  sortOrder: number;
  starterPrompts: string[];
  mcp: {
    id: string;
    name: string;
    url: string;
    transport: "SSE" | "STREAMABLE_HTTP";
    apiKey: string | null;
  };
}

/**
 * Upsert a tool and optionally link it to an agent.
 * Shared logic to avoid repeating the upsert pattern.
 */
export async function upsertToolsWithAgentLink(
  prisma: import("@prisma/client").PrismaClient,
  tools: ToolDefinition[],
  agentId?: string
): Promise<void> {
  for (const t of tools) {
    await prisma.tool.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
    });

    if (agentId) {
      const agentExists = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true } });
      if (agentExists) {
        await prisma.agentTool.upsert({
          where: { agentId_toolId: { agentId, toolId: t.id } },
          update: {},
          create: { agentId, toolId: t.id },
        });
      } else {
        console.warn(`Agent ${agentId} not found — skipping tool link for ${t.id}`);
      }
    }
  }
}
