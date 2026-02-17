import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { getUserPlanAndUsage } from "@/lib/usage";

const MAX_USER_FILES = 20;
const MAX_FILE_SIZE = 100_000; // 100KB per file
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const files = await prisma.userFile.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      fileType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return jsonOk(files.map(serializeDates));
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { name, description, content } = body;

  if (!name?.trim() || name.length > MAX_NAME_LENGTH) {
    return jsonError(`Название обязательно (макс. ${MAX_NAME_LENGTH} символов)`, 400);
  }

  if (!content?.trim()) {
    return jsonError("Содержимое файла не может быть пустым", 400);
  }

  if (content.length > MAX_FILE_SIZE) {
    return jsonError(`Файл слишком большой (макс. ${Math.round(MAX_FILE_SIZE / 1000)}KB)`, 400);
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return jsonError(`Описание слишком длинное (макс. ${MAX_DESCRIPTION_LENGTH} символов)`, 400);
  }

  // Check file count limit
  const { plan } = await getUserPlanAndUsage(userId);
  const maxFiles = plan?.maxAgents && plan.maxAgents > 0 ? MAX_USER_FILES * 2 : MAX_USER_FILES;

  const fileCount = await prisma.userFile.count({ where: { userId } });
  if (fileCount >= maxFiles) {
    return jsonError(`Достигнут лимит файлов (${maxFiles}). Удалите ненужные файлы.`, 403);
  }

  const file = await prisma.userFile.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      content: content.trim(),
      fileType: "md",
      sizeBytes: new TextEncoder().encode(content).length,
    },
  });

  return jsonOk(serializeDates(file), 201);
}
