import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { DEFAULT_MAX_TOKENS_FIX, DEFAULT_TEMPERATURE_CODE_FIX } from "@/lib/constants";

const FIX_PROMPT = `You are a code fixer. You receive code that has a runtime error and must return ONLY the fixed code.

Rules:
- Fix ONLY the error described, do not change anything else
- Return ONLY the raw code, no markdown fences, no explanations
- If the code is HTML, return the full HTML document
- If the code is React/JSX, return only the component code (no HTML wrapper)
- If the code is Python, return only the Python code. Replace Unicode arrows/symbols in strings with ASCII equivalents (e.g. ← → ↑ ↓ with < > ^ v). Ensure all strings use only ASCII-safe characters.
- Preserve the original formatting and style
- Do NOT add comments about what was fixed`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 requests/minute per user
  if (!(await checkMinuteRateLimit(`fix-code:${session.user.id}`, 20))) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const { code, error } = await req.json();

  if (!code || !error) {
    return NextResponse.json({ error: "Missing code or error" }, { status: 400 });
  }

  // Body size limits
  const MAX_CODE_LENGTH = 500 * 1024; // 500KB
  const MAX_ERROR_LENGTH = 10 * 1024; // 10KB
  if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: "Code too large (max 500KB)" }, { status: 413 });
  }
  if (typeof error !== "string" || error.length > MAX_ERROR_LENGTH) {
    return NextResponse.json({ error: "Error message too large (max 10KB)" }, { status: 413 });
  }

  try {
    const textModel = await resolveModel("CODE");
    if (!textModel) {
      return NextResponse.json({ error: "No code model configured" }, { status: 503 });
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
          { role: "system", content: FIX_PROMPT },
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
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const data = await response.json();
    let fixedCode = data.choices?.[0]?.message?.content?.trim();

    if (!fixedCode) {
      return NextResponse.json({ error: "No response from AI" }, { status: 502 });
    }

    // Strip markdown fences if AI added them anyway
    const fenceMatch = fixedCode.match(/^```(?:\w+)?\n([\s\S]*?)```$/);
    if (fenceMatch) {
      fixedCode = fenceMatch[1].trim();
    }

    return NextResponse.json({ fixedCode });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
