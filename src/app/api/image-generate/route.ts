import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const DEEPINFRA_URL = "https://api.deepinfra.com/v1/openai/images/generations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Необходимо указать описание изображения" },
        { status: 400 }
      );
    }

    const response = await fetch(DEEPINFRA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX-1-schnell",
        prompt: prompt.trim(),
        n: 1,
        size: "1024x1024",
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
