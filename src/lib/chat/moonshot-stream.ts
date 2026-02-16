// ─── Moonshot/Kimi K2.5 streaming handler ────────────────
// Extracted from route.ts — handles SSE streaming with tool calling
// (web search via $web_search, MCP tools, native tools).

import { callMcpTool } from "@/lib/mcp-client";
import {
  getNativeToolDefinitions,
  isNativeTool,
  executeNativeTool,
  type NativeToolContext,
} from "@/lib/native-tools";
import type { ResolvedModel } from "@/lib/model-router";
import {
  MOONSHOT_CHAT_URL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  NATIVE_TOOL_MAX_TURNS,
} from "@/lib/constants";

// Resolved dynamically via model-router; kept as fallback constant
const MOONSHOT_URL_FALLBACK = MOONSHOT_CHAT_URL;

// ─── Moonshot built-in web search tool ───────────────────

const WEB_SEARCH_BUILTIN = {
  type: "builtin_function" as const,
  function: { name: "$web_search" },
};

// ─── MCP tool context type ───────────────────────────────

export interface McpToolContext {
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ─── Stream options ──────────────────────────────────────

export interface MoonshotStreamOptions {
  maxTokens: number;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  mcpTools?: McpToolContext[];
  nativeToolCtx?: NativeToolContext;
  contextInfo?: {
    usagePercent: number;
    totalTokens: number;
    contextWindowSize: number;
    compacting: boolean;
  };
  textModel?: ResolvedModel | null;
}

// ─── SSE Parser ──────────────────────────────────────────

const SSE_MAX_BUFFER = 1024 * 1024; // 1MB max buffer for a single SSE line

async function* parseSSEStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > SSE_MAX_BUFFER) {
        throw new Error("SSE buffer overflow");
      }

      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
          try {
            yield JSON.parse(trimmed.slice(6));
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Main Moonshot streaming function ────────────────────

export function streamMoonshot(
  apiMessages: Array<Record<string, unknown>>,
  options: MoonshotStreamOptions
) {
  const encoder = new TextEncoder();
  const {
    maxTokens,
    thinkingEnabled,
    webSearchEnabled,
    mcpTools = [],
    nativeToolCtx,
    contextInfo,
    textModel,
  } = options;
  const nativeToolDefs = getNativeToolDefinitions();

  const apiUrl = textModel
    ? `${textModel.provider.baseUrl}/chat/completions`
    : MOONSHOT_URL_FALLBACK;
  const apiKey =
    textModel?.provider.apiKey || process.env.MOONSHOT_API_KEY || "";
  const modelId = textModel?.modelId || DEFAULT_TEXT_MODEL;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit context info as first chunk
        if (contextInfo) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                t: "x",
                v: JSON.stringify({
                  action: "context_info",
                  ...contextInfo,
                }),
              }) + "\n"
            )
          );
        }

        const currentMessages = [...apiMessages];
        let searchNotified = false;

        // Plan detection state
        let insidePlan = false;
        let planBuffer = "";

        // Tool-call loop
        for (let turn = 0; turn < NATIVE_TOOL_MAX_TURNS; turn++) {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelId,
              messages: currentMessages,
              max_tokens: maxTokens,
              temperature: thinkingEnabled ? 1.0 : DEFAULT_TEMPERATURE,
              top_p: DEFAULT_TOP_P,
              stream: true,
              tools: [
                ...(webSearchEnabled ? [WEB_SEARCH_BUILTIN] : []),
                ...nativeToolDefs,
                ...mcpTools.map((t) => ({
                  type: "function" as const,
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema,
                  },
                })),
              ],
              ...(!thinkingEnabled
                ? { thinking: { type: "disabled" } }
                : {}),
            }),
          });

          if (!response.ok) {
            const errText = await response
              .text()
              .catch(() => "Unknown error");
            let errMsg = `Ошибка API: ${response.status}`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson.error?.message || errMsg;
            } catch {
              // use default
            }
            controller.enqueue(
              encoder.encode(JSON.stringify({ t: "e", v: errMsg }) + "\n")
            );
            return;
          }

          if (!response.body) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: "e", v: "Пустой ответ от API" }) + "\n"
              )
            );
            return;
          }

          // Collect tool calls and reasoning from this turn
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCallMap: Record<
            number,
            {
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }
          > = {};
          let hasToolCallFinish = false;
          let turnReasoningContent = "";

          for await (const chunk of parseSSEStream(response.body)) {
            // Handle SSE error events from Moonshot API
            if (chunk.type === "error" || chunk.error) {
              const errMsg =
                chunk.error?.message || "Ошибка API провайдера";
              console.error(chunk);
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "e", v: errMsg }) + "\n"
                )
              );
              return;
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Accumulate tool_calls (streamed in parts)
            if (delta?.tool_calls) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const tc of delta.tool_calls as any[]) {
                const idx = tc.index ?? 0;
                if (tc.id) {
                  toolCallMap[idx] = {
                    id: tc.id,
                    type: tc.type || "builtin_function",
                    function: {
                      name: tc.function?.name || "",
                      arguments: tc.function?.arguments || "",
                    },
                  };
                } else if (
                  tc.function?.arguments &&
                  toolCallMap[idx]
                ) {
                  toolCallMap[idx].function.arguments +=
                    tc.function.arguments;
                }
              }

              if (!searchNotified) {
                searchNotified = true;
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: "searching" }) + "\n"
                  )
                );
              }
            }

            if (choice.finish_reason === "tool_calls") {
              hasToolCallFinish = true;
            }

            // Stream reasoning and accumulate for tool-call messages
            if (thinkingEnabled && delta?.reasoning_content) {
              turnReasoningContent += delta.reasoning_content;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    t: "r",
                    v: delta.reasoning_content,
                  }) + "\n"
                )
              );
            }

            // Stream content with plan detection
            if (delta?.content) {
              planBuffer += delta.content;

              // Check for plan opening tag
              if (
                !insidePlan &&
                planBuffer.includes("<sanbao-plan>")
              ) {
                const idx = planBuffer.indexOf("<sanbao-plan>");
                const before = planBuffer.slice(0, idx);
                if (before) {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ t: "c", v: before }) + "\n"
                    )
                  );
                }
                planBuffer = planBuffer.slice(
                  idx + "<sanbao-plan>".length
                );
                insidePlan = true;
              }

              if (insidePlan) {
                // Check for plan closing tag
                if (planBuffer.includes("</sanbao-plan>")) {
                  const idx =
                    planBuffer.indexOf("</sanbao-plan>");
                  const planText = planBuffer.slice(0, idx);
                  if (planText) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({ t: "p", v: planText }) +
                          "\n"
                      )
                    );
                  }
                  planBuffer = planBuffer.slice(
                    idx + "</sanbao-plan>".length
                  );
                  insidePlan = false;
                  // Flush remaining as content
                  if (planBuffer) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          t: "c",
                          v: planBuffer,
                        }) + "\n"
                      )
                    );
                    planBuffer = "";
                  }
                } else if (planBuffer.length > 20) {
                  // Flush accumulated plan content incrementally
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ t: "p", v: planBuffer }) +
                        "\n"
                    )
                  );
                  planBuffer = "";
                }
              } else {
                // Keep tail that could be a partial "<sanbao-plan>" tag
                const TAG = "<sanbao-plan>";
                let safeFlush = planBuffer;
                let keepTail = "";
                for (let k = 1; k < TAG.length; k++) {
                  if (planBuffer.endsWith(TAG.slice(0, k))) {
                    safeFlush = planBuffer.slice(0, -k);
                    keepTail = planBuffer.slice(-k);
                    break;
                  }
                }
                if (safeFlush) {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ t: "c", v: safeFlush }) +
                        "\n"
                    )
                  );
                }
                planBuffer = keepTail;
              }
            }
          }

          // Flush remaining plan buffer
          if (planBuffer) {
            const type = insidePlan ? "p" : "c";
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: type, v: planBuffer }) + "\n"
              )
            );
            planBuffer = "";
          }

          // If model finished with tool_calls, send results back and loop
          const collectedCalls = Object.values(toolCallMap);
          if (hasToolCallFinish && collectedCalls.length > 0) {
            currentMessages.push({
              role: "assistant",
              tool_calls: collectedCalls,
              // Kimi API requires reasoning_content on assistant messages when thinking is enabled.
              // It rejects empty string "", so provide a minimal placeholder when model
              // jumped straight to tool calls without producing reasoning content.
              ...(thinkingEnabled
                ? { reasoning_content: turnReasoningContent || "." }
                : {}),
            });

            // Build a map of MCP tool names for quick lookup
            const mcpToolMap = new Map(
              mcpTools.map((t) => [t.name, t])
            );

            for (const tc of collectedCalls) {
              const mcpDef = mcpToolMap.get(tc.function.name);
              if (mcpDef) {
                // MCP tool call — execute via MCP client with timeout
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(
                    tc.function.arguments || "{}"
                  );
                } catch {
                  // fallback empty
                }
                const MCP_TOOL_TIMEOUT_MS = 30_000;
                let mcpResult: { result?: string; error?: string };
                try {
                  mcpResult = await Promise.race([
                    callMcpTool(
                      mcpDef.url,
                      mcpDef.transport,
                      mcpDef.apiKey,
                      tc.function.name,
                      args
                    ),
                    new Promise<{ error: string }>((_, reject) =>
                      setTimeout(() => reject(new Error("MCP tool timeout")), MCP_TOOL_TIMEOUT_MS)
                    ),
                  ]);
                } catch {
                  mcpResult = { error: `MCP tool ${tc.function.name} timed out after ${MCP_TOOL_TIMEOUT_MS / 1000}s` };
                }
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: mcpResult.error
                    ? `Error: ${mcpResult.error}`
                    : mcpResult.result,
                });
              } else if (
                isNativeTool(tc.function.name) &&
                nativeToolCtx
              ) {
                // Native tool call — execute server-side
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      t: "s",
                      v: "using_tool",
                    }) + "\n"
                  )
                );
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(
                    tc.function.arguments || "{}"
                  );
                } catch {
                  // fallback empty
                }
                const result = await executeNativeTool(
                  tc.function.name,
                  args,
                  nativeToolCtx
                );
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: result,
                });
              } else {
                // Built-in tool (web search) — pass arguments as content
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: tc.function.arguments,
                });
              }
            }

            continue;
          }

          break;
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              t: "e",
              v: "Ошибка подключения к API",
            }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}
