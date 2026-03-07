import { auth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { DEFAULT_MAX_TOKENS_FIX, DEFAULT_TEMPERATURE_CODE_FIX } from "@/lib/constants";
import { getPrompt } from "@/lib/prompts";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  // Rate limit: 20 requests/minute per user
  if (!(await checkMinuteRateLimit(`fix-code:${session.user.id}`, 20))) {
    return jsonError("Слишком много запросов", 429);
  }

  const { code, error } = await req.json();

  if (!code || !error) {
    return jsonError("Missing code or error", 400);
  }

  // Body size limits
  const MAX_CODE_LENGTH = 500 * 1024; // 500KB
  const MAX_ERROR_LENGTH = 10 * 1024; // 10KB
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

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: await getPrompt("prompt_fix_code") },
          {
            role: "user",
            content: `Error:\n${error}\n\nCode:\n${code}`,
          },
        ],
        max_tokens: textModel?.maxTokens || DEFAULT_MAX_TOKENS_FIX,
        temperature: textModel?.temperature ?? DEFAULT_TEMPERATURE_CODE_FIX,
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
