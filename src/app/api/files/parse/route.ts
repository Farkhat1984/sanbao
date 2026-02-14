import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseFileToText } from "@/lib/parse-file";
import { MAX_FILE_SIZE_PARSE } from "@/lib/constants";

const MAX_FILE_SIZE = MAX_FILE_SIZE_PARSE;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 20MB)" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseFileToText(buffer, file.name, file.type);

    if (!text) {
      return NextResponse.json(
        { error: "Не удалось извлечь текст из файла" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text, fileName: file.name });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Ошибка обработки файла",
      },
      { status: 500 }
    );
  }
}
