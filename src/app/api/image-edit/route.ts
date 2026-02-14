import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/model-router";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const { image, prompt } = await req.json();

    if (!image || !prompt) {
      return NextResponse.json(
        { error: "Необходимо указать изображение и описание редактирования" },
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

    // Resolve image model for editing (fallback to Qwen Image Edit)
    const imageModel = await resolveModel("IMAGE");
    const apiUrl = imageModel
      ? `${imageModel.provider.baseUrl}/images/edits`
      : "https://api.deepinfra.com/v1/openai/images/edits";
    const apiKey = imageModel?.provider.apiKey || process.env.DEEPINFRA_API_KEY || "";

    // Build FormData for API
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image", blob, `image.${ext}`);
    formData.append("prompt", prompt);
    formData.append("model", "Qwen/Qwen-Image-Edit");
    formData.append("n", "1");
    formData.append("size", "1024x1024");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepInfra error:", err);
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
