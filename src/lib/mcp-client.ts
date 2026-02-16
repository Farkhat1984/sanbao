import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fireAndForget } from "@/lib/logger";

const MCP_CONNECT_TIMEOUT = 15_000; // 15s
const MCP_TOOL_CALL_TIMEOUT = 30_000; // 30s

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export async function connectAndDiscoverTools(
  url: string,
  transport: "SSE" | "STREAMABLE_HTTP",
  apiKey?: string | null
): Promise<{ tools: McpToolInfo[]; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const transportInstance =
      transport === "SSE"
        ? new SSEClientTransport(new URL(url), {
            requestInit: { headers },
          })
        : new StreamableHTTPClientTransport(new URL(url), {
            requestInit: { headers },
          });

    const client = new Client({ name: "sanbao", version: "1.0.0" });
    await withTimeout(client.connect(transportInstance), MCP_CONNECT_TIMEOUT, "MCP connect");

    const { tools } = await withTimeout(client.listTools(), MCP_TOOL_CALL_TIMEOUT, "MCP listTools");

    const result: McpToolInfo[] = tools.map((t) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: (t.inputSchema as Record<string, unknown>) || {},
    }));

    await client.close().catch(() => {});
    return { tools: result };
  } catch (e) {
    return {
      tools: [],
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

export async function callMcpTool(
  url: string,
  transport: "SSE" | "STREAMABLE_HTTP",
  apiKey: string | null | undefined,
  toolName: string,
  args: Record<string, unknown>,
  context?: { mcpServerId?: string; userId?: string; conversationId?: string }
): Promise<{ result: string; error?: string }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const transportInstance =
      transport === "SSE"
        ? new SSEClientTransport(new URL(url), {
            requestInit: { headers },
          })
        : new StreamableHTTPClientTransport(new URL(url), {
            requestInit: { headers },
          });

    const client = new Client({ name: "sanbao", version: "1.0.0" });
    await withTimeout(client.connect(transportInstance), MCP_CONNECT_TIMEOUT, "MCP connect");

    const response = await withTimeout(
      client.callTool({ name: toolName, arguments: args }),
      MCP_TOOL_CALL_TIMEOUT,
      `MCP callTool(${toolName})`
    );

    await client.close().catch(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentArr = Array.isArray(response.content) ? response.content : [];
    const textContent = contentArr
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => c.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => c.text)
      .join("\n") || "";

    // Log tool call
    if (context?.mcpServerId) {
      fireAndForget(
        prisma.mcpToolLog.create({
          data: {
            mcpServerId: context.mcpServerId,
            toolName,
            input: args as Prisma.InputJsonValue,
            output: { text: textContent.slice(0, 10000) } as Prisma.InputJsonValue,
            durationMs: Date.now() - start,
            success: true,
            userId: context.userId || null,
            conversationId: context.conversationId || null,
          },
        }),
        "mcp-client:logToolCall"
      );
    }

    return { result: textContent };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Tool call failed";

    // Log failed tool call
    if (context?.mcpServerId) {
      fireAndForget(
        prisma.mcpToolLog.create({
          data: {
            mcpServerId: context.mcpServerId,
            toolName,
            input: args as Prisma.InputJsonValue,
            durationMs: Date.now() - start,
            success: false,
            error: errorMsg,
            userId: context.userId || null,
            conversationId: context.conversationId || null,
          },
        }),
        "mcp-client:logFailedToolCall"
      );
    }

    return { result: "", error: errorMsg };
  }
}
