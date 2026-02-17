import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { DEFAULT_IMAGE_COUNT, DEFAULT_IMAGE_SIZE } from "@/lib/constants";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!(await checkMinuteRateLimit(`img-edit:${session.user.id}`, 5))) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  try {
    const { image, prompt } = await req.json();

    if (!image || !prompt) {
      return NextResponse.json(
        { error: "Необходимо указать изображение и описание редактирования" },
        { status: 400 }
      );
    }

    // Body size limits: max 10MB base64 (~7.5MB decoded), max 2000 chars prompt
    const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // ~10MB
    if (typeof image !== "string" || image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Изображение слишком большое (макс. 10MB)" },
        { status: 413 }
      );
    }
    if (typeof prompt !== "string" || prompt.length > 2000) {
      return NextResponse.json(
        { error: "Описание слишком длинное (макс. 2000 символов)" },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Determine mime type from data URL
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const ext = mimeType.split("/")[1] || "png";

    const imageModel = await resolveModel("IMAGE");
    if (!imageModel) {
      return NextResponse.json({ error: "Модель редактирования изображений не настроена" }, { status: 503 });
    }
    const apiUrl = `${imageModel.provider.baseUrl}/images/edits`;
    const apiKey = imageModel.provider.apiKey;

    // Build FormData for API
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image", blob, `image.${ext}`);
    formData.append("prompt", prompt);
    formData.append("model", imageModel.modelId);
    formData.append("n", String(DEFAULT_IMAGE_COUNT));
    formData.append("size", DEFAULT_IMAGE_SIZE);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Image edit API error:", err);
      return NextResponse.json(
        { error: "Ошибка при обработке изображения" },
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

    // Return b64_json or url depending on what API returns
    return NextResponse.json({
      imageBase64: resultImage.b64_json
        ? `data:image/png;base64,${resultImage.b64_json}`
        : null,
      imageUrl: resultImage.url || null,
      revisedPrompt: resultImage.revised_prompt || null,
    });
  } catch (error) {
    console.error("Image edit error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
