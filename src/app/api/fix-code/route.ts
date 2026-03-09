import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { DEFAULT_MAX_TOKENS } from "@/lib/constants";
import { getPrompt } from "@/lib/prompts";
import { getSettingNumber } from "@/lib/settings";

export async function POST(req: Request) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

  // Rate limit
  const [rateFixCode, maxCodeBytes, maxErrorBytes] = await Promise.all([
    getSettingNumber('rate_fix_code_per_minute'),
    getSettingNumber('fix_code_max_code_bytes'),
    getSettingNumber('fix_code_max_error_bytes'),
  ]);
  if (!(await checkMinuteRateLimit(`fix-code:${userId}`, rateFixCode))) {
    return jsonError("Слишком много запросов", 429);
  }

  const { code, error } = await req.json();

  if (!code || !error) {
    return jsonError("Missing code or error", 400);
  }

  // Body size limits
  const MAX_CODE_LENGTH = maxCodeBytes;
  const MAX_ERROR_LENGTH = maxErrorBytes;
  if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) {
    return jsonError("Code too large (max 500KB)", 413);
  }
  if (typeof error !== "string" || error.length > MAX_ERROR_LENGTH) {
    return jsonError("Error message too large (max 10KB)", 413);
  }

  try {
    const textModel = await resolveModel("CODE");
    if (!textModel) {
      return jsonError("No code model configured", 503);
    }
    const apiUrl = `${textModel.provider.baseUrl}/chat/completions`;
    const apiKey = textModel.provider.apiKey;
    const modelId = textModel.modelId;

    const [systemPrompt, temperatureCodeFix] = await Promise.all([
      getPrompt("prompt_fix_code"),
      getSettingNumber("ai_temperature_code_fix"),
    ]);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Error:\n${error}\n\nCode:\n${code}`,
          },
        ],
        max_tokens: textModel?.maxTokens || DEFAULT_MAX_TOKENS,
        temperature: textModel?.temperature ?? temperatureCodeFix,
        stream: false,
      }),
    });

    if (!response.ok) {
      return jsonError("AI request failed", 502);
    }

    const data = await response.json();
    let fixedCode = data.choices?.[0]?.message?.content?.trim();

    if (!fixedCode) {
      return jsonError("No response from AI", 502);
    }

    // Strip markdown fences if AI added them anyway
    const fenceMatch = fixedCode.match(/^```(?:\w+)?\n([\s\S]*?)```$/);
    if (fenceMatch) {
      fixedCode = fenceMatch[1].trim();
    }

    return jsonOk({ fixedCode });
  } catch {
    return jsonError("Internal error", 500);
  }
}
