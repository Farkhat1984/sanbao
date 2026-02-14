import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";

const VALID_ICONS = [
  "Bot", "Scale", "Briefcase", "Shield", "BookOpen", "Gavel", "FileText",
  "Building", "User", "HeartPulse", "GraduationCap", "Landmark",
  "Code", "MessageSquare", "Globe", "Lightbulb", "FileSearch",
  "ShieldCheck", "ClipboardCheck", "Brain",
];

const VALID_COLORS = [
  "#4F6EF7", "#7C3AED", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#6366F1",
];

const JURISDICTIONS = ["RU", "KZ", "BY", "EU", "EU/RU", "International"];

const SYSTEM_GEN_PROMPT = `Ты — мета-промпт-инженер, специализирующийся на создании юридических скиллов для AI-ассистента.

Ты должен вернуть JSON-объект с полями:
- "name": название скилла (2-4 слова, на русском)
- "description": краткое описание (1 предложение, на русском)
- "systemPrompt": детальный системный промпт (на русском, 200-600 слов)
- "citationRules": правила цитирования НПА (на русском, 50-150 слов)
- "jurisdiction": одна из: ${JURISDICTIONS.join(", ")}
- "icon": одна из иконок: ${VALID_ICONS.join(", ")}
- "iconColor": один из цветов: ${VALID_COLORS.join(", ")}

Правила для systemPrompt:
1. Определи роль и специализацию
2. Укажи ключевые НПА и источники права для этой области
3. Опиши методологию анализа
4. Формат ответа: структура, уровень детализации
5. Ограничения: что скилл НЕ покрывает

Правила для citationRules:
1. Формат ссылок на НПА (статья, пункт, подпункт)
2. Приоритет источников
3. Как обозначать актуальность нормы

ВАЖНО: Ответ ТОЛЬКО в формате JSON, без markdown-обёртки.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description, jurisdiction } = await req.json();

  if (!description?.trim()) {
    return NextResponse.json({ error: "Описание обязательно" }, { status: 400 });
  }

  try {
    const userMsg = jurisdiction
      ? `Создай скилл: ${description.trim()}. Юрисдикция: ${jurisdiction}`
      : `Создай скилл: ${description.trim()}`;

    const textModel = await resolveModel("TEXT");
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
          { role: "system", content: SYSTEM_GEN_PROMPT },
          { role: "user", content: userMsg },
        ],
        temperature: textModel?.temperature ?? 0.6,
        max_tokens: textModel?.maxTokens || 2048,
        stream: false,
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Moonshot API error:", response.status, errText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response");
    }

    // Extract JSON from response (may be wrapped in ```json ... ```)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    const result = {
      name: parsed.name || "Новый скилл",
      description: parsed.description || "",
      systemPrompt: parsed.systemPrompt || "",
      citationRules: parsed.citationRules || "",
      jurisdiction: JURISDICTIONS.includes(parsed.jurisdiction) ? parsed.jurisdiction : "RU",
      icon: VALID_ICONS.includes(parsed.icon) ? parsed.icon : "Scale",
      iconColor: VALID_COLORS.includes(parsed.iconColor) ? parsed.iconColor : "#4F6EF7",
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("Skill generation error:", e);
    return NextResponse.json(
      { error: "Ошибка генерации скилла" },
      { status: 500 }
    );
  }
}
