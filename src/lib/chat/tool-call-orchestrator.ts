// ─── Tool call orchestrator ───────────────────────────────
// Executes collected tool calls (MCP, native, built-in) and
// appends results to the message array for the next LLM turn.

import { callMcpTool } from "@/lib/mcp-client";
import {
  isNativeTool,
  executeNativeTool,
  type NativeToolContext,
} from "@/lib/native-tools";
import type { McpToolContext } from "@/lib/types/mcp";
import { logger } from "@/lib/logger";
import { truncateToolResult } from "@/lib/chat/truncate-tool-result";

// ─── Types ───────────────────────────────────────────────

export interface CollectedToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

export interface ToolExecutionContext {
  mcpTools: McpToolContext[];
  nativeToolCtx?: NativeToolContext;
  mcpCallContext?: { userId: string; conversationId?: string };
  mcpToolTimeoutMs: number;
  toolResultMaxChars: number;
  toolResultTailChars: number;
}

export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

/**
 * Callback to emit status notifications to the client stream.
 * @param type - NDJSON type field ('s' for status)
 * @param payload - Object to JSON-serialize and send
 */
export type StatusEmitter = (payload: Record<string, unknown>) => void;

// ─── Tool execution ──────────────────────────────────────

/**
 * Execute all collected tool calls and return result messages
 * to append to the conversation.
 *
 * Handles three tool types:
 * 1. MCP tools — remote tool calls via MCP protocol
 * 2. Native tools — built-in platform tools (tasks, memory, etc.)
 * 3. Built-in tools — provider built-ins like $web_search
 */
export async function executeToolCalls(
  collectedCalls: CollectedToolCall[],
  ctx: ToolExecutionContext,
  emitStatus: StatusEmitter
): Promise<ToolResultMessage[]> {
  const mcpToolMap = new Map(ctx.mcpTools.map((t) => [t.name, t]));
  const results: ToolResultMessage[] = [];

  for (const tc of collectedCalls) {
    const mcpDef = mcpToolMap.get(tc.function.name);

    if (mcpDef) {
      results.push(
        await executeMcpToolCall(tc, mcpDef, ctx, emitStatus)
      );
    } else if (isNativeTool(tc.function.name) && ctx.nativeToolCtx) {
      results.push(
        await executeNativeToolCall(tc, ctx, emitStatus)
      );
    } else {
      // Built-in tool (web search) — pass arguments as content
      results.push({
        role: "tool",
        tool_call_id: tc.id,
        content: tc.function.arguments,
      });
    }
  }

  return results;
}

// ─── MCP tool execution ─────────────────────────────────

async function executeMcpToolCall(
  tc: CollectedToolCall,
  mcpDef: McpToolContext,
  ctx: ToolExecutionContext,
  emitStatus: StatusEmitter
): Promise<ToolResultMessage> {
  emitStatus({ t: "s", v: "using_tool", n: tc.function.name });

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tc.function.arguments || "{}");
  } catch {
    // fallback empty
  }

  // Inject domain from agent config (only if not already set by LLM)
  if (mcpDef.defaultDomain && !args.domain) {
    const toolName = mcpDef.originalName || tc.function.name;
    args.domain = mcpDef.toolDomains?.[toolName] ?? mcpDef.defaultDomain;
  }

  let mcpResult: { result?: string; error?: string };
  try {
    mcpResult = await Promise.race([
      callMcpTool(
        mcpDef.url,
        mcpDef.transport,
        mcpDef.apiKey,
        mcpDef.originalName || tc.function.name,
        args,
        {
          mcpServerId: mcpDef.mcpServerId,
          userId: ctx.mcpCallContext?.userId,
          conversationId: ctx.mcpCallContext?.conversationId,
        }
      ),
      new Promise<{ error: string }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              error: `MCP tool ${tc.function.name} timed out after ${ctx.mcpToolTimeoutMs / 1000}s`,
            }),
          ctx.mcpToolTimeoutMs
        )
      ),
    ]);
  } catch (mcpErr) {
    logger.warn("MCP tool call failed", {
      tool: tc.function.name,
      error: mcpErr instanceof Error ? mcpErr.message : String(mcpErr),
    });
    mcpResult = {
      error: `MCP tool ${tc.function.name} failed: ${mcpErr instanceof Error ? mcpErr.message : "unknown error"}`,
    };
  }

  return {
    role: "tool",
    tool_call_id: tc.id,
    content: mcpResult.error
      ? `Error: ${mcpResult.error}`
      : truncateToolResult(
          mcpResult.result ?? "",
          ctx.toolResultMaxChars,
          ctx.toolResultTailChars
        ),
  };
}

// ─── Native tool execution ──────────────────────────────

async function executeNativeToolCall(
  tc: CollectedToolCall,
  ctx: ToolExecutionContext,
  emitStatus: StatusEmitter
): Promise<ToolResultMessage> {
  emitStatus({ t: "s", v: "using_tool", n: tc.function.name });

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tc.function.arguments || "{}");
  } catch {
    // fallback empty
  }

  const result = await executeNativeTool(
    tc.function.name,
    args,
    ctx.nativeToolCtx!
  );

  return {
    role: "tool",
    tool_call_id: tc.id,
    content: truncateToolResult(
      result,
      ctx.toolResultMaxChars,
      ctx.toolResultTailChars
    ),
  };
}
