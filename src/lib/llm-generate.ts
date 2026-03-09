import { resolveModel } from "@/lib/model-router";
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS_GENERATE } from "@/lib/constants";

interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallLlmOptions {
  /** Override max_tokens (defaults to model config or DEFAULT_MAX_TOKENS_GENERATE) */
  maxTokens?: number;
  /** Override temperature (defaults to model config or DEFAULT_TEMPERATURE) */
  temperature?: number;
}

/**
 * Extract JSON from LLM text response.
 * Tries markdown code block first, then falls back to first `{` to last `}`.
 */
export function extractJsonFromText(text: string): string {
  const trimmed = text.trim();

  // Try markdown code block: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Fallback: find first { to last }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

/**
 * Call the resolved TEXT model with given messages and return parsed JSON.
 *
 * Handles: model resolution, API call, response extraction, JSON parsing.
 * Throws on model unavailability, API errors, empty responses, or invalid JSON.
 */
export async function callLlmForJson<T = unknown>(
  messages: LlmMessage[],
  options?: CallLlmOptions,
): Promise<T> {
  const textModel = await resolveModel("TEXT");
  if (!textModel) {
    throw new LlmModelUnavailableError();
  }

  const apiUrl = `${textModel.provider.baseUrl}/chat/completions`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${textModel.provider.apiKey}`,
    },
    body: JSON.stringify({
      model: textModel.modelId,
      messages,
      temperature: options?.temperature ?? textModel.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: options?.maxTokens ?? textModel.maxTokens ?? DEFAULT_MAX_TOKENS_GENERATE,
      stream: false,
      thinking: { type: "disabled" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new LlmApiError(response.status, errText);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new LlmEmptyResponseError();
  }

  const jsonStr = extractJsonFromText(content);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new LlmJsonParseError(content.slice(0, 500));
  }
}

// ─── Error classes ───

/** Model not configured / unavailable */
export class LlmModelUnavailableError extends Error {
  constructor() {
    super("TEXT model not configured");
    this.name = "LlmModelUnavailableError";
  }
}

/** Upstream LLM API returned non-2xx */
export class LlmApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`LLM API error: ${status}`);
    this.name = "LlmApiError";
  }
}

/** LLM returned empty content */
export class LlmEmptyResponseError extends Error {
  constructor() {
    super("LLM returned empty response");
    this.name = "LlmEmptyResponseError";
  }
}

/** LLM response could not be parsed as JSON */
export class LlmJsonParseError extends Error {
  constructor(public readonly rawContent: string) {
    super("Failed to parse JSON from LLM response");
    this.name = "LlmJsonParseError";
  }
}
