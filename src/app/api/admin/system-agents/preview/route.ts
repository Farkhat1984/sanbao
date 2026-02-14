import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { resolveModel } from "@/lib/model-router";
import { DEFAULT_MAX_TOKENS_PREVIEW, DEFAULT_TEMPERATURE_PREVIEW } from "@/lib/constants";

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { systemPrompt, message } = await req.json();

  if (!systemPrompt || !message) {
    return NextResponse.json({ error: "systemPrompt and message required" }, { status: 400 });
  }

  const model = await resolveModel("TEXT");
  if (!model) {
    return NextResponse.json({ error: "Нет доступной TEXT-модели" }, { status: 500 });
  }

  try {
    const res = await fetch(`${model.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: DEFAULT_MAX_TOKENS_PREVIEW,
        temperature: model.temperature ?? DEFAULT_TEMPERATURE_PREVIEW,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Provider error: ${res.status} ${text.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Пустой ответ";

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
