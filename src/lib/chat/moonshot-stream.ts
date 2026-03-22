// ─── OpenAI-compatible SSE streaming handler ──────────────
// Handles SSE streaming with tool calling for providers using
// OpenAI-compatible API (web search via $web_search, MCP tools, native tools).

import {
  getNativeToolDefinitions,
  type NativeToolContext,
} from "@/lib/native-tools";
import type { ResolvedModel } from "@/lib/model-router";
import {
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  LLM_TIMEOUT_MS,
  TOOL_RESULT_MAX_CHARS,
  TOOL_RESULT_TAIL_CHARS,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSettingNumber } from "@/lib/settings";
import {
  createPlanDetectorState,
  feedPlanDetector,
  flushPlanDetector,
} from "@/lib/chat/plan-parser";
import { parseSSEStream } from "@/lib/chat/sse-parser";
import {
  executeToolCalls,
  type CollectedToolCall,
} from "@/lib/chat/tool-call-orchestrator";

// Re-export for backward compatibility
export { truncateToolResult } from "@/lib/chat/truncate-tool-result";
export { parseSSEStream } from "@/lib/chat/sse-parser";

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

  /** Enqueue an NDJSON line to the client stream */
  function enqueueJson(controller: ReadableStreamDefaultController, payload: Record<string, unknown>) {
    controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
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
          enqueueJson(controller, {
            t: "x",
            v: JSON.stringify({
              action: "context_info",
              ...contextInfo,
            }),
          });
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

        // Tool execution context (reused across iterations)
        const toolExecCtx = {
          mcpTools,
          nativeToolCtx,
          mcpCallContext,
          mcpToolTimeoutMs,
          toolResultMaxChars: cfgToolResultMaxChars,
          toolResultTailChars: cfgToolResultTailChars,
        };
        const emitStatus = (payload: Record<string, unknown>) => enqueueJson(controller, payload);

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
            const errText = await response.text().catch(() => "Unknown error");
            let errMsg = `Ошибка API: ${response.status}`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson.error?.message || errMsg;
            } catch {
              // use default
            }
            enqueueJson(controller, { t: "e", v: errMsg });
            return;
          }

          if (!response.body) {
            enqueueJson(controller, { t: "e", v: "Пустой ответ от API" });
            return;
          }

          // Collect tool calls and reasoning from this turn
          const toolCallMap: Record<number, CollectedToolCall> = {};
          let hasToolCallFinish = false;
          let turnReasoningContent = "";
          // Buffer content during this turn — only flush if it's NOT a tool-call turn.
          let turnContentBuffer = "";

          for await (const chunk of parseSSEStream(response.body, sseMaxBuffer)) {
            // Handle SSE error events from Moonshot API
            if (chunk.type === "error" || chunk.error) {
              const errMsg = chunk.error?.message || "Ошибка API провайдера";
              logger.error("SSE error from API provider", { chunk: JSON.stringify(chunk) });
              enqueueJson(controller, { t: "e", v: errMsg });
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
                } else if (tc.function?.arguments && toolCallMap[idx]) {
                  toolCallMap[idx].function.arguments += tc.function.arguments;
                }
                // Update tool name if it arrives in a later chunk
                if (tc.function?.name && toolCallMap[idx] && !toolCallMap[idx].function.name) {
                  toolCallMap[idx].function.name = tc.function.name;
                }
              }

              // Send status notification once we know the tool name
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
                  enqueueJson(controller,
                    isWebSearch
                      ? { t: "s", v: "searching", n: "$web_search" }
                      : { t: "s", v: "using_tool", n: bestTool }
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
              enqueueJson(controller, { t: "r", v: delta.reasoning_content });
            }

            // Buffer content — will be flushed only if this turn does NOT end with tool_calls
            if (delta?.content) {
              turnContentBuffer += delta.content;
            }
          }

          // Decide whether to emit buffered content
          if (hasToolCallFinish && Object.keys(toolCallMap).length > 0) {
            // Tool-call turn — discard narration content
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
                enqueueJson(controller, { t: ch.type, v: ch.text });
              }
            }
            // Flush remaining plan buffer
            const { chunks: finalChunks } = flushPlanDetector(planState);
            for (const ch of finalChunks) {
              enqueueJson(controller, { t: ch.type, v: ch.text });
            }
          }

          // ─── Token budget check ──────────────────────────────
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
              enqueueJson(controller, { t: "s", v: "answering" });
              currentMessages.push({
                role: "user" as const,
                content: "Пожалуйста, ответь на основе уже собранной информации. Не вызывай инструменты, дай финальный ответ.",
              });
              enqueueJson(controller, {
                t: "e",
                v: "Превышен лимит токенов. Попробуйте задать более конкретный вопрос.",
              });
            } else {
              enqueueJson(controller, {
                t: "e",
                v: "Превышен лимит токенов. Попробуйте задать более конкретный вопрос.",
              });
            }
            break;
          }

          // If model finished with tool_calls, execute them and loop
          const collectedCalls = Object.values(toolCallMap);
          if (hasToolCallFinish && collectedCalls.length > 0) {
            // Fallback: if status wasn't sent during streaming
            if (!searchNotified) {
              searchNotified = true;
              const firstToolName = collectedCalls.find(t => t.function.name)?.function.name || "";
              if (firstToolName === "$web_search") {
                enqueueJson(controller, { t: "s", v: "searching", n: "$web_search" });
              } else if (firstToolName) {
                enqueueJson(controller, { t: "s", v: "using_tool", n: firstToolName });
              } else {
                enqueueJson(controller, { t: "s", v: "using_tool" });
              }
            }
            currentMessages.push({
              role: "assistant",
              tool_calls: collectedCalls,
              ...(thinkingEnabled
                ? { reasoning_content: turnReasoningContent || "." }
                : {}),
            });

            // Execute tool calls via orchestrator
            const toolResults = await executeToolCalls(
              collectedCalls,
              toolExecCtx,
              emitStatus
            );
            for (const msg of toolResults) {
              currentMessages.push({ ...msg });
            }

            toolCallTurnCount++;
            continue;
          }

          // Final turn (no tool calls) — signal client to show "answering" state
          if (turn > 0) {
            enqueueJson(controller, { t: "s", v: "answering" });
          }
          break;
        }

        // ─── Forced final answer ──────────────────────────────
        if (toolCallTurnCount >= maxToolCallsPerRequest && !hasProducedContent) {
          logger.warn("Tool loop exhausted — forcing final answer", {
            toolCallTurnCount,
            maxToolCallsPerRequest,
          });
          enqueueJson(controller, { t: "s", v: "answering" });

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
                    enqueueJson(controller, { t: ch.type, v: ch.text });
                  }
                }
                if (thinkingEnabled && delta?.reasoning_content) {
                  enqueueJson(controller, { t: "r", v: delta.reasoning_content });
                }
              }
              const { chunks: lastChunks } = flushPlanDetector(planState);
              for (const ch of lastChunks) {
                enqueueJson(controller, { t: ch.type, v: ch.text });
              }
            } else {
              enqueueJson(controller, { t: "e", v: "Не удалось получить финальный ответ от API" });
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
        logger.error("Moonshot stream error", {
          error: err instanceof Error ? err.message : String(err),
          model: textModel?.modelId,
        });
        enqueueJson(controller, { t: "e", v: "Ошибка подключения к API" });
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstreamAbort.abort();
    },
  });

  return stream;
}
