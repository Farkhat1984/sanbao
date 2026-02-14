import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";

const FIX_PROMPT = `You are a code fixer. You receive code that has a runtime error and must return ONLY the fixed code.

Rules:
- Fix ONLY the error described, do not change anything else
- Return ONLY the raw code, no markdown fences, no explanations
- If the code is HTML, return the full HTML document
- If the code is React/JSX, return only the component code (no HTML wrapper)
- Preserve the original formatting and style
- Do NOT add comments about what was fixed`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, error } = await req.json();

  if (!code || !error) {
    return NextResponse.json({ error: "Missing code or error" }, { status: 400 });
  }

  try {
    const textModel = await resolveModel("CODE");
    const apiUrl = textModel
      ? `${textModel.provider.baseUrl}/chat/completions`
      : "https://api.moonshot.ai/v1/chat/completions";
    const apiKey = textModel?.provider.apiKey || process.env.MOONSHOT_API_KEY || "";
    const modelId = textModel?.modelId || "kimi-k2.5";

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
        max_tokens: textModel?.maxTokens || 8192,
        temperature: textModel?.temperature ?? 0.2,
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
