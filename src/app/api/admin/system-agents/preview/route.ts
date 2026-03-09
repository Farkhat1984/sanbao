import { requireAdmin } from "@/lib/admin";
import { resolveModel } from "@/lib/model-router";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE_PREVIEW } from "@/lib/constants";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { systemPrompt, message } = await req.json();

  if (!systemPrompt || !message) {
    return jsonError("systemPrompt and message required", 400);
  }

  const model = await resolveModel("TEXT");
  if (!model) {
    return jsonError("Нет доступной TEXT-модели", 500);
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
        max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
        temperature: model.temperature ?? DEFAULT_TEMPERATURE_PREVIEW,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonError(`Provider error: ${res.status} ${text.slice(0, 200)}`, 502);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Пустой ответ";

    return jsonOk({ reply });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error", 500);
  }
}
