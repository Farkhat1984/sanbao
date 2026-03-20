// ─── OpenAI-compatible SSE streaming handler ──────────────
// Handles SSE streaming with tool calling for providers using
// OpenAI-compatible API (web search via $web_search, MCP tools, native tools).

import { callMcpTool } from "@/lib/mcp-client";
import {
  getNativeToolDefinitions,
  isNativeTool,
  executeNativeTool,
  type NativeToolContext,
} from "@/lib/native-tools";
import type { ResolvedModel } from "@/lib/model-router";
import {
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  TOOL_RESULT_MAX_CHARS,
  TOOL_RESULT_TAIL_CHARS,
  LLM_TIMEOUT_MS,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSettingNumber } from "@/lib/settings";
import {
  createPlanDetectorState,
  feedPlanDetector,
  flushPlanDetector,
} from "@/lib/chat/plan-parser";

// ─── Moonshot built-in web search tool ───────────────────

const WEB_SEARCH_BUILTIN = {
  type: "builtin_function" as const,
  function: { name: "$web_search" },
};

// ─── MCP tool context type (shared) ──────────────────────

import type { McpToolContext } from "@/lib/types/mcp";
export type { McpToolContext } from "@/lib/types/mcp";

// ─── Stream options ──────────────────────────────────────

/** Dynamic overrides from settings registry (loaded by route.ts in a single batch) */
export interface StreamSettingsOverrides {
  defaultTemperature?: number;
  defaultTopP?: number;
  maxToolCallsPerRequest?: number;
  maxRequestTokens?: number;
  toolResultMaxChars?: number;
  toolResultTailChars?: number;
}

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
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
  /** AbortSignal from the incoming request — used to cancel upstream fetches on client disconnect */
  signal?: AbortSignal;
  /** Context for MCP tool call logging (userId, conversationId) */
  mcpCallContext?: { userId: string; conversationId?: string };
  /** Settings overrides from route.ts batch load — avoids redundant DB queries */
  settingsOverrides?: StreamSettingsOverrides;
}

// ─── SSE Parser ──────────────────────────────────────────

// SSE_MAX_BUFFER loaded per-stream from settings (stream_sse_max_buffer)

/**
 * Truncate a tool result to fit within token budget.
 * Strategy: keep head + tail (like ChatGPT/Claude), add truncation metadata.
 * This prevents context overflow while preserving the most useful information
 * -- beginnings typically contain structure/headers, endings contain conclusions.
 */
function truncateToolResult(
  content: string,
  maxChars: number = TOOL_RESULT_MAX_CHARS,
  tailChars: number = TOOL_RESULT_TAIL_CHARS
): string {
  if (!content || content.length <= maxChars) return content ?? "";

  const headChars = maxChars - tailChars - 200; // Reserve space for truncation notice
  const head = content.slice(0, headChars);
  const tail = content.slice(-tailChars);
  const originalKB = (content.length / 1024).toFixed(1);

  return (
    head +
    `\n\n[... обрезано ${originalKB}KB → ${(maxChars / 1024).toFixed(1)}KB — ` +
    `используйте более конкретный запрос для получения нужной информации ...]\n\n` +
    tail
  );
}

async function* parseSSEStream(body: ReadableStream<Uint8Array>, maxBuffer: number) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > maxBuffer) {
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
    onUsage,
    signal: incomingSignal,
    mcpCallContext,
    settingsOverrides,
  } = options;

  // Resolve settings: prefer overrides from route.ts batch, fall back to constants
  const cfgDefaultTemperature = settingsOverrides?.defaultTemperature ?? DEFAULT_TEMPERATURE;
  const cfgDefaultTopP = settingsOverrides?.defaultTopP ?? DEFAULT_TOP_P;
  const cfgToolResultMaxChars = settingsOverrides?.toolResultMaxChars ?? TOOL_RESULT_MAX_CHARS;
  const cfgToolResultTailChars = settingsOverrides?.toolResultTailChars ?? TOOL_RESULT_TAIL_CHARS;
  const nativeToolDefs = getNativeToolDefinitions();

  if (!textModel) {
    throw new Error("No text model resolved from DB — configure models via /admin/models");
  }
  const apiUrl = `${textModel.provider.baseUrl}/chat/completions`;
  const apiKey = textModel.provider.apiKey;
  const modelId = textModel.modelId;

  // Create an AbortController so we can abort upstream fetches
  // when the client disconnects (cancel() on ReadableStream).
  const upstreamAbort = new AbortController();
  // If the incoming request signal is already provided, forward its abort.
  if (incomingSignal) {
    if (incomingSignal.aborted) {
      upstreamAbort.abort();
    } else {
      incomingSignal.addEventListener("abort", () => upstreamAbort.abort(), { once: true });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [sseMaxBuffer, mcpToolTimeoutMs] = await Promise.all([
          getSettingNumber("stream_sse_max_buffer"),
          getSettingNumber("mcp_tool_call_timeout_ms"),
        ]);
        const maxToolCallsPerRequest = settingsOverrides?.maxToolCallsPerRequest ?? 15;
        const maxRequestTokens = settingsOverrides?.maxRequestTokens ?? 200_000;

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

        // Plan detection state (shared parser)
        const planState = createPlanDetectorState();

        // Usage accumulation for token logging
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        // ─── Tool definitions (reused across loop iterations) ──
        const allTools = [
          ...mcpTools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            },
          })),
          ...nativeToolDefs,
          ...(webSearchEnabled ? [WEB_SEARCH_BUILTIN] : []),
        ];

        // Track whether any tool-call turn produced user-facing content
        let hasProducedContent = false;
        // Track tool call turns for forced final answer
        let toolCallTurnCount = 0;
        // Per-request timeout for each API call (60s default)
        const perCallTimeoutMs = LLM_TIMEOUT_MS * 2; // 60s

        // Tool-call loop
        for (let turn = 0; turn < maxToolCallsPerRequest; turn++) {
          // On the last allowed turn, strip tools so the model MUST answer
          const isLastTurn = turn === maxToolCallsPerRequest - 1;
          const sendTools = isLastTurn && toolCallTurnCount > 0 ? [] : allTools;

          // Reset per-turn: each tool-call iteration sends its own status
          let searchNotified = false;

          // Combine upstream abort with per-call timeout
          const callAbort = new AbortController();
          const timeoutId = setTimeout(() => callAbort.abort(), perCallTimeoutMs);
          const onUpstreamAbort = () => callAbort.abort();
          upstreamAbort.signal.addEventListener("abort", onUpstreamAbort, { once: true });

          let response: Response;
          try {
            response = await fetch(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: modelId,
                messages: currentMessages,
                max_tokens: maxTokens,
                temperature: thinkingEnabled ? 1.0 : (textModel?.temperature ?? cfgDefaultTemperature),
                top_p: textModel?.topP ?? cfgDefaultTopP,
                stream: true,
                stream_options: { include_usage: true },
                ...(sendTools.length > 0 ? { tools: sendTools } : {}),
                ...(!thinkingEnabled
                  ? { thinking: { type: "disabled" } }
                  : {}),
              }),
              signal: callAbort.signal,
            });
          } finally {
            clearTimeout(timeoutId);
            upstreamAbort.signal.removeEventListener("abort", onUpstreamAbort);
          }

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
          // Buffer content during this turn — only flush if it's NOT a tool-call turn.
          // This prevents narration like "Позвольте мне найти..." from leaking to the user
          // when the model is just announcing what tool it's about to call.
          let turnContentBuffer = "";

          for await (const chunk of parseSSEStream(response.body, sseMaxBuffer)) {
            // Handle SSE error events from Moonshot API
            if (chunk.type === "error" || chunk.error) {
              const errMsg =
                chunk.error?.message || "Ошибка API провайдера";
              logger.error("SSE error from API provider", { chunk: JSON.stringify(chunk) });
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "e", v: errMsg }) + "\n"
                )
              );
              return;
            }

            // Accumulate usage from SSE chunks
            if (chunk.usage) {
              totalInputTokens += chunk.usage.prompt_tokens ?? 0;
              totalOutputTokens += chunk.usage.completion_tokens ?? 0;
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
                // Update tool name if it arrives in a later chunk
                if (tc.function?.name && toolCallMap[idx] && !toolCallMap[idx].function.name) {
                  toolCallMap[idx].function.name = tc.function.name;
                }
              }

              // Send status notification once we know the tool name.
              // Prioritize: $web_search > knowledge/MCP tools > generic tools
              // so the icon reflects the most meaningful tool in multi-tool calls.
              if (!searchNotified) {
                const toolNames = Object.values(toolCallMap)
                  .map(t => t.function.name)
                  .filter(Boolean);
                const bestTool =
                  toolNames.find(n => n === "$web_search") ||
                  toolNames.find(n => n !== "get_current_time" && n !== "get_user_info" && n !== "get_conversation_context") ||
                  toolNames[0] || "";
                if (bestTool) {
                  searchNotified = true;
                  const isWebSearch = bestTool === "$web_search";
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify(
                        isWebSearch
                          ? { t: "s", v: "searching", n: "$web_search" }
                          : { t: "s", v: "using_tool", n: bestTool }
                      ) + "\n"
                    )
                  );
                }
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

            // Buffer content — will be flushed only if this turn does NOT end with tool_calls.
            // This prevents tool-call narration ("Позвольте мне найти...") from appearing as the answer.
            if (delta?.content) {
              turnContentBuffer += delta.content;
            }
          }

          // Decide whether to emit buffered content
          if (hasToolCallFinish && Object.keys(toolCallMap).length > 0) {
            // Tool-call turn — discard narration content (e.g. "Позвольте мне получить...")
            // The content is just the model announcing what tool it's calling — not useful to the user.
            if (turnContentBuffer) {
              logger.info("Discarding tool-call narration", {
                turn,
                narrationLength: turnContentBuffer.length,
                preview: turnContentBuffer.slice(0, 100),
              });
            }
          } else {
            // Final turn (no tool calls) — flush buffered content through plan detector
            if (turnContentBuffer) {
              hasProducedContent = true;
              const { chunks } = feedPlanDetector(planState, turnContentBuffer);
              for (const ch of chunks) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: ch.type, v: ch.text }) + "\n")
                );
              }
            }
            // Flush remaining plan buffer
            const { chunks: finalChunks } = flushPlanDetector(planState);
            for (const ch of finalChunks) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: ch.type, v: ch.text }) + "\n")
              );
            }
          }

          // ─── Token budget check ──────────────────────────────
          // Break the tool-call loop if cumulative tokens exceed the per-request budget.
          // This prevents runaway loops from consuming unbounded resources.
          const cumulativeTokens = totalInputTokens + totalOutputTokens;
          logger.info("Tool loop iteration", {
            turn,
            cumulativeTokens,
            maxRequestTokens,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          });
          if (cumulativeTokens > maxRequestTokens) {
            logger.warn("Token budget exceeded", { cumulativeTokens, maxRequestTokens, turn });
            if (!hasProducedContent) {
              // Token budget hit but no content yet — force one final call without tools
              controller.enqueue(
                encoder.encode(JSON.stringify({ t: "s", v: "answering" }) + "\n")
              );
              currentMessages.push({
                role: "user" as const,
                content: "Пожалуйста, ответь на основе уже собранной информации. Не вызывай инструменты, дай финальный ответ.",
              });
              // One more iteration without tools will happen on next loop pass
              // But we're already at budget — emit error instead
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "e", v: "Превышен лимит токенов. Попробуйте задать более конкретный вопрос." }) + "\n"
                )
              );
            } else {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "e", v: "Превышен лимит токенов. Попробуйте задать более конкретный вопрос." }) + "\n"
                )
              );
            }
            break;
          }

          // If model finished with tool_calls, send results back and loop
          const collectedCalls = Object.values(toolCallMap);
          if (hasToolCallFinish && collectedCalls.length > 0) {
            // Fallback: if status wasn't sent during streaming (tool name came late or not at all)
            if (!searchNotified) {
              searchNotified = true;
              const firstToolName = collectedCalls.find(t => t.function.name)?.function.name || "";
              if (firstToolName === "$web_search") {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: "searching", n: "$web_search" }) + "\n"
                  )
                );
              } else if (firstToolName) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: "using_tool", n: firstToolName }) + "\n"
                  )
                );
              } else {
                // Tool name unknown — send neutral status without assuming web search
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "s", v: "using_tool" }) + "\n"
                  )
                );
              }
            }
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
                // MCP tool call — notify client with tool name
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      t: "s",
                      v: "using_tool",
                      n: tc.function.name,
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
                        userId: mcpCallContext?.userId,
                        conversationId: mcpCallContext?.conversationId,
                      }
                    ),
                    new Promise<{ error: string }>((resolve) =>
                      setTimeout(() => resolve({ error: `MCP tool ${tc.function.name} timed out after ${mcpToolTimeoutMs / 1000}s` }), mcpToolTimeoutMs)
                    ),
                  ]);
                } catch (mcpErr) {
                  logger.warn("MCP tool call failed", {
                    tool: tc.function.name,
                    error: mcpErr instanceof Error ? mcpErr.message : String(mcpErr),
                  });
                  mcpResult = { error: `MCP tool ${tc.function.name} failed: ${mcpErr instanceof Error ? mcpErr.message : "unknown error"}` };
                }
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: mcpResult.error
                    ? `Error: ${mcpResult.error}`
                    : truncateToolResult(mcpResult.result ?? "", cfgToolResultMaxChars, cfgToolResultTailChars),
                });
              } else if (
                isNativeTool(tc.function.name) &&
                nativeToolCtx
              ) {
                // Native tool call — notify client with tool name
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      t: "s",
                      v: "using_tool",
                      n: tc.function.name,
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
                  content: truncateToolResult(result, cfgToolResultMaxChars, cfgToolResultTailChars),
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

            toolCallTurnCount++;
            continue;
          }

          // Final turn (no tool calls) — signal client to show "answering" state
          if (turn > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ t: "s", v: "answering" }) + "\n")
            );
          }
          break;
        }

        // ─── Forced final answer ──────────────────────────────
        // If the tool-call loop exhausted all turns without the model producing
        // a final answer (every turn was tool calls), make one last API call
        // WITHOUT tools so the model is forced to synthesize a response.
        if (toolCallTurnCount >= maxToolCallsPerRequest && !hasProducedContent) {
          logger.warn("Tool loop exhausted — forcing final answer", {
            toolCallTurnCount,
            maxToolCallsPerRequest,
          });
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: "s", v: "answering" }) + "\n")
          );

          // Add instruction to answer based on collected data
          currentMessages.push({
            role: "user",
            content: "Ты уже собрал достаточно информации. Дай развёрнутый ответ на исходный вопрос на основе полученных данных. Отвечай обычным текстом в чате, НЕ используй тег <sanbao-doc>. Изображения из статей вставляй inline рядом с текстом, к которому они относятся (формат: ![описание](url)).",
          });

          const finalCallAbort = new AbortController();
          const finalTimeoutId = setTimeout(() => finalCallAbort.abort(), perCallTimeoutMs);
          const onFinalAbort = () => finalCallAbort.abort();
          upstreamAbort.signal.addEventListener("abort", onFinalAbort, { once: true });

          try {
            const finalResponse = await fetch(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: modelId,
                messages: currentMessages,
                max_tokens: maxTokens,
                temperature: thinkingEnabled ? 1.0 : (textModel?.temperature ?? cfgDefaultTemperature),
                top_p: textModel?.topP ?? cfgDefaultTopP,
                stream: true,
                stream_options: { include_usage: true },
                // NO tools — force text response
                ...(!thinkingEnabled ? { thinking: { type: "disabled" } } : {}),
              }),
              signal: finalCallAbort.signal,
            });

            if (finalResponse.ok && finalResponse.body) {
              for await (const chunk of parseSSEStream(finalResponse.body, sseMaxBuffer)) {
                if (chunk.usage) {
                  totalInputTokens += chunk.usage.prompt_tokens ?? 0;
                  totalOutputTokens += chunk.usage.completion_tokens ?? 0;
                }
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta;
                if (delta?.content) {
                  const { chunks } = feedPlanDetector(planState, delta.content);
                  for (const ch of chunks) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ t: ch.type, v: ch.text }) + "\n")
                    );
                  }
                }
                if (thinkingEnabled && delta?.reasoning_content) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ t: "r", v: delta.reasoning_content }) + "\n")
                  );
                }
              }
              // Flush plan detector
              const { chunks: lastChunks } = flushPlanDetector(planState);
              for (const ch of lastChunks) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: ch.type, v: ch.text }) + "\n")
                );
              }
            } else {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "e", v: "Не удалось получить финальный ответ от API" }) + "\n"
                )
              );
            }
          } catch (finalErr) {
            logger.error("Forced final answer failed", {
              error: finalErr instanceof Error ? finalErr.message : String(finalErr),
            });
          } finally {
            clearTimeout(finalTimeoutId);
            upstreamAbort.signal.removeEventListener("abort", onFinalAbort);
          }
        }

        // Report accumulated usage for token logging
        if (onUsage && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          onUsage({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
        }
      } catch (err) {
        // Log the actual error for debugging — the user gets a generic message
        logger.error("Moonshot stream error", {
          error: err instanceof Error ? err.message : String(err),
          model: textModel?.modelId,
        });
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
    cancel() {
      // Client disconnected — abort any in-flight upstream API requests
      upstreamAbort.abort();
    },
  });

  return stream;
}
