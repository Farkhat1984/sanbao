import { parseFileToText } from "@/lib/parse-file";
import { MAX_FILE_SIZE_PARSE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

const MAX_FILE_SIZE = MAX_FILE_SIZE_PARSE;

export async function POST(req: Request) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return jsonError("Файл не найден", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return jsonError("Файл слишком большой (макс. 20MB)", 400);
  }

  if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) {
    return jsonError(`Тип файла не поддерживается: ${file.type}`, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseFileToText(buffer, file.name, file.type);

    if (!text) {
      return jsonError("Не удалось извлечь текст из файла", 422);
    }

    return jsonOk({ text, fileName: file.name });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Ошибка обработки файла",
      500
    );
  }
}
