// ─── Vercel AI SDK streaming handler ─────────────────────
// Extracted from route.ts — wraps streamText() with plan detection
// and reasoning support for OpenAI and Anthropic providers.

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { DEFAULT_TEMPERATURE, DEFAULT_TOP_P } from "@/lib/constants";

// ─── Options ─────────────────────────────────────────────

export interface AiSdkStreamOptions {
  provider: string;
  canUseProvider: boolean;
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  thinkingEnabled: boolean;
  maxTokens: number;
  contextInfo?: {
    usagePercent: number;
    totalTokens: number;
    contextWindowSize: number;
    compacting: boolean;
  };
}

// ─── Plan detection wrapper for AI SDK streams ───────────

function createPlanDetectorStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullStream: AsyncIterable<any>,
  contextInfo?: {
    usagePercent: number;
    totalTokens: number;
    contextWindowSize: number;
    compacting: boolean;
  },
  hasReasoning?: boolean
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Emit context info
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

        let insidePlan = false;
        let planBuffer = "";

        for await (const part of fullStream) {
          // Stream reasoning chunks from AI SDK
          if (hasReasoning && part.type === "reasoning-delta") {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: "r", v: part.text }) + "\n"
              )
            );
            continue;
          }

          // Only process text deltas for plan detection + content
          if (part.type !== "text-delta") continue;
          const chunk = part.text;
          if (!chunk) continue;

          planBuffer += chunk;

          // Prevent unbounded buffer growth (max 1MB)
          if (planBuffer.length > 1_000_000) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ t: insidePlan ? "p" : "c", v: planBuffer }) + "\n"
              )
            );
            planBuffer = "";
          }

          if (!insidePlan && planBuffer.includes("<sanbao-plan>")) {
            const idx = planBuffer.indexOf("<sanbao-plan>");
            const before = planBuffer.slice(0, idx);
            if (before) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "c", v: before }) + "\n"
                )
              );
            }
            planBuffer = planBuffer.slice(idx + "<sanbao-plan>".length);
            insidePlan = true;
          }

          if (insidePlan) {
            if (planBuffer.includes("</sanbao-plan>")) {
              const idx = planBuffer.indexOf("</sanbao-plan>");
              const planText = planBuffer.slice(0, idx);
              if (planText) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "p", v: planText }) + "\n"
                  )
                );
              }
              planBuffer = planBuffer.slice(
                idx + "</sanbao-plan>".length
              );
              insidePlan = false;
              if (planBuffer) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ t: "c", v: planBuffer }) + "\n"
                  )
                );
                planBuffer = "";
              }
            } else if (planBuffer.length > 20) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ t: "p", v: planBuffer }) + "\n"
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
                  JSON.stringify({ t: "c", v: safeFlush }) + "\n"
                )
              );
            }
            planBuffer = keepTail;
          }
        }

        // Flush remaining
        if (planBuffer) {
          const type = insidePlan ? "p" : "c";
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ t: type, v: planBuffer }) + "\n"
            )
          );
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              t: "e",
              v: "Ошибка генерации ответа",
            }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Main AI SDK streaming function ──────────────────────

export function streamAiSdk(options: AiSdkStreamOptions): ReadableStream {
  const {
    provider,
    canUseProvider,
    systemPrompt,
    messages,
    thinkingEnabled,
    maxTokens,
    contextInfo,
  } = options;

  const isAnthropic = canUseProvider && provider === "anthropic";
  let model;
  if (isAnthropic) {
    model = anthropic("claude-sonnet-4-5-20250929");
  } else {
    model = openai("gpt-4o");
  }

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    // Anthropic requires temperature=1 when thinking is enabled
    temperature:
      isAnthropic && thinkingEnabled ? 1.0 : DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    maxOutputTokens: maxTokens,
    // Pass thinking/reasoning config for providers that support it
    ...(thinkingEnabled && isAnthropic
      ? {
          providerOptions: {
            anthropic: {
              thinking: {
                type: "enabled",
                budgetTokens: Math.min(maxTokens, 10000),
              },
            },
          },
        }
      : {}),
  });

  // Wrap AI SDK full stream with plan detection and reasoning
  return createPlanDetectorStream(
    result.fullStream,
    contextInfo,
    thinkingEnabled && isAnthropic
  );
}
