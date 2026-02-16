import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { DEEPINFRA_BASE_URL, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_COUNT, DEFAULT_IMAGE_SIZE } from "@/lib/constants";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!(await checkMinuteRateLimit(`img-gen:${session.user.id}`, 5))) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Необходимо указать описание изображения" },
        { status: 400 }
      );
    }

    const imageModel = await resolveModel("IMAGE");
    const apiUrl = imageModel
      ? `${imageModel.provider.baseUrl}/images/generations`
      : `${DEEPINFRA_BASE_URL}/images/generations`;
    const apiKey = imageModel?.provider.apiKey || process.env.DEEPINFRA_API_KEY || "";
    const modelId = imageModel?.modelId || DEFAULT_IMAGE_MODEL;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt.trim(),
        n: DEFAULT_IMAGE_COUNT,
        size: DEFAULT_IMAGE_SIZE,
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepInfra generation error:", err);
      return NextResponse.json(
        { error: "Ошибка при генерации изображения" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const resultImage = data.data?.[0];

    if (!resultImage) {
      return NextResponse.json(
        { error: "Не удалось получить результат" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageBase64: resultImage.b64_json
        ? `data:image/jpeg;base64,${resultImage.b64_json}`
        : null,
      imageUrl: resultImage.url || null,
      revisedPrompt: resultImage.revised_prompt || null,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
