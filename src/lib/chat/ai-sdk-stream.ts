// ─── Vercel AI SDK streaming handler ─────────────────────
// Extracted from route.ts — wraps streamText() with plan detection
// and reasoning support for OpenAI-compatible providers via AI SDK.

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { DEFAULT_TEMPERATURE, DEFAULT_TOP_P } from "@/lib/constants";
import { getSettingNumber } from "@/lib/settings";
import type { ResolvedModel } from "@/lib/model-router";

// ─── Options ─────────────────────────────────────────────

/** Dynamic overrides for AI defaults from settings registry */
interface AiSdkSettingsOverrides {
  defaultTemperature?: number;
  defaultTopP?: number;
}

export interface AiSdkStreamOptions {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  thinkingEnabled: boolean;
  maxTokens: number;
  textModel: ResolvedModel | null;
  contextInfo?: {
    usagePercent: number;
    totalTokens: number;
    contextWindowSize: number;
    compacting: boolean;
  };
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
  /** Settings overrides from route.ts batch load — avoids redundant DB queries */
  settingsOverrides?: AiSdkSettingsOverrides;
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
  sseMaxBuffer = 1_000_000,
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
          if (part.type === "reasoning-delta") {
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

          if (planBuffer.length > sseMaxBuffer) {
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

export async function streamAiSdk(options: AiSdkStreamOptions): Promise<ReadableStream> {
  const {
    systemPrompt,
    messages,
    thinkingEnabled,
    maxTokens,
    textModel,
    contextInfo,
    onUsage,
    settingsOverrides,
  } = options;

  if (!textModel) {
    throw new Error("No model resolved from DB — configure models via /admin/models");
  }

  const sseMaxBuffer = await getSettingNumber("stream_sse_max_buffer");

  // Resolve settings: prefer overrides from route.ts batch, fall back to constants
  const cfgDefaultTemperature = settingsOverrides?.defaultTemperature ?? DEFAULT_TEMPERATURE;
  const cfgDefaultTopP = settingsOverrides?.defaultTopP ?? DEFAULT_TOP_P;

  const model = openai(textModel.modelId);
  const temperature = thinkingEnabled ? 1.0 : (textModel.temperature ?? cfgDefaultTemperature);
  const topP = textModel.topP ?? cfgDefaultTopP;

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    temperature,
    topP,
    maxOutputTokens: maxTokens,
  });

  // Report token usage asynchronously
  if (onUsage) {
    Promise.resolve(result.usage).then((usage) => {
      onUsage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      });
    }).catch(() => {});
  }

  // Wrap AI SDK full stream with plan detection and reasoning
  return createPlanDetectorStream(result.fullStream, contextInfo, sseMaxBuffer);
}
