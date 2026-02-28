import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fireAndForget, logger } from "@/lib/logger";
import { isUrlSafeAsync } from "@/lib/ssrf";

const MCP_CONNECT_TIMEOUT = 15_000; // 15s
const MCP_TOOL_CALL_TIMEOUT = 30_000; // 30s
const MCP_POOL_MAX_IDLE_MS = 5 * 60_000; // 5 min — close idle connections
const MCP_POOL_CLEANUP_INTERVAL_MS = 60_000; // Check for stale connections every 60s

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

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------

interface PoolEntry {
  client: Client;
  transport: SSEClientTransport | StreamableHTTPClientTransport;
  lastUsed: number;
  tools: McpToolInfo[];
}

/** Module-level connection cache keyed by URL */
const pool = new Map<string, PoolEntry>();

/** Build a unique pool key from URL + transport type + apiKey */
function poolKey(url: string, transport: "SSE" | "STREAMABLE_HTTP", apiKey?: string | null): string {
  return `${transport}:${apiKey ?? ""}:${url}`;
}

function createTransport(
  url: string,
  transport: "SSE" | "STREAMABLE_HTTP",
  apiKey?: string | null
): SSEClientTransport | StreamableHTTPClientTransport {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return transport === "SSE"
    ? new SSEClientTransport(new URL(url), { requestInit: { headers } })
    : new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
}

/** Close a single pool entry and remove it from the pool */
async function evictEntry(key: string, entry: PoolEntry): Promise<void> {
  pool.delete(key);
  try {
    await entry.client.close();
  } catch {
    // Already disconnected — ignore
  }
}

/**
 * Get or create a pooled MCP connection.
 * Returns a PoolEntry with an active client and cached tools list.
 * If the cached entry is stale (> 5 min idle) or missing, creates a fresh connection.
 */
async function getOrConnect(
  url: string,
  transport: "SSE" | "STREAMABLE_HTTP",
  apiKey?: string | null
): Promise<PoolEntry> {
  const key = poolKey(url, transport, apiKey);
  const cached = pool.get(key);

  if (cached && (Date.now() - cached.lastUsed) < MCP_POOL_MAX_IDLE_MS) {
    cached.lastUsed = Date.now();
    return cached;
  }

  // Stale entry — evict before reconnecting
  if (cached) {
    await evictEntry(key, cached);
  }

  const transportInstance = createTransport(url, transport, apiKey);
  const client = new Client({ name: "sanbao", version: "1.0.0" });
  await withTimeout(client.connect(transportInstance), MCP_CONNECT_TIMEOUT, "MCP connect");

  const { tools } = await withTimeout(client.listTools(), MCP_TOOL_CALL_TIMEOUT, "MCP listTools");
  const toolInfos: McpToolInfo[] = tools.map((t) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: (t.inputSchema as Record<string, unknown>) || {},
  }));

  const entry: PoolEntry = {
    client,
    transport: transportInstance,
    lastUsed: Date.now(),
    tools: toolInfos,
  };
  pool.set(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Periodic cleanup of idle connections
// ---------------------------------------------------------------------------

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pool.entries()) {
      if (now - entry.lastUsed > MCP_POOL_MAX_IDLE_MS) {
        logger.info("MCP pool: evicting idle connection", { key });
        evictEntry(key, entry);
      }
    }
    // Stop the interval if pool is empty (will restart on next connection)
    if (pool.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, MCP_POOL_CLEANUP_INTERVAL_MS);

  // Allow the Node.js process to exit even if interval is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function connectAndDiscoverTools(
  url: string,
  transport: "SSE" | "STREAMABLE_HTTP",
  apiKey?: string | null
): Promise<{ tools: McpToolInfo[]; error?: string }> {
  // SSRF protection: block internal/private URLs (async — DNS rebinding safe)
  if (!(await isUrlSafeAsync(url))) {
    return { tools: [], error: "URL blocked by SSRF protection" };
  }

  try {
    startCleanupInterval();
    const entry = await getOrConnect(url, transport, apiKey);
    return { tools: entry.tools };
  } catch (e) {
    // On failure, make sure any half-open entry is evicted
    const key = poolKey(url, transport, apiKey);
    const entry = pool.get(key);
    if (entry) await evictEntry(key, entry);

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
  // SSRF protection: block internal/private URLs (async — DNS rebinding safe)
  if (!(await isUrlSafeAsync(url))) {
    return { result: "", error: "URL blocked by SSRF protection" };
  }

  const start = Date.now();
  try {
    startCleanupInterval();

    let entry: PoolEntry;
    try {
      entry = await getOrConnect(url, transport, apiKey);
    } catch (connErr) {
      // Fresh connection failed — propagate
      throw connErr;
    }

    let response;
    try {
      response = await withTimeout(
        entry.client.callTool({ name: toolName, arguments: args }),
        MCP_TOOL_CALL_TIMEOUT,
        `MCP callTool(${toolName})`
      );
    } catch (callErr) {
      // Connection may be dead — evict and retry once with a fresh connection
      const key = poolKey(url, transport, apiKey);
      logger.info("MCP pool: call failed, retrying with fresh connection", {
        key,
        tool: toolName,
        error: callErr instanceof Error ? callErr.message : String(callErr),
      });
      await evictEntry(key, entry);

      entry = await getOrConnect(url, transport, apiKey);
      response = await withTimeout(
        entry.client.callTool({ name: toolName, arguments: args }),
        MCP_TOOL_CALL_TIMEOUT,
        `MCP callTool(${toolName}) retry`
      );
    }

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

/**
 * Close all pooled MCP connections.
 * Call during graceful shutdown to release resources.
 */
export async function closeMcpPool(): Promise<void> {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  const entries = Array.from(pool.entries());
  pool.clear();

  await Promise.allSettled(
    entries.map(async ([key, entry]) => {
      try {
        await entry.client.close();
      } catch {
        logger.warn("MCP pool: error closing connection during shutdown", { key });
      }
    })
  );

  logger.info("MCP pool: all connections closed", { count: entries.length });
}
