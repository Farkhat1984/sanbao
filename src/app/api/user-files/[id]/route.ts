import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";

const MAX_FILE_SIZE = 100_000;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const file = await prisma.userFile.findFirst({
    where: { id, userId },
  });

  if (!file) return jsonError("Файл не найден", 404);

  return jsonOk(serializeDates(file));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const existing = await prisma.userFile.findFirst({
    where: { id, userId },
  });
  if (!existing) return jsonError("Файл не найден", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { name, description, content } = body;

  if (name !== undefined && (!name?.trim() || name.length > MAX_NAME_LENGTH)) {
    return jsonError(`Название обязательно (макс. ${MAX_NAME_LENGTH} символов)`, 400);
  }

  if (content !== undefined && content.length > MAX_FILE_SIZE) {
    return jsonError(`Файл слишком большой (макс. ${Math.round(MAX_FILE_SIZE / 1000)}KB)`, 400);
  }

  if (description !== undefined && description && description.length > MAX_DESCRIPTION_LENGTH) {
    return jsonError(`Описание слишком длинное (макс. ${MAX_DESCRIPTION_LENGTH} символов)`, 400);
  }

  const file = await prisma.userFile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(content !== undefined && {
        content: content.trim(),
        sizeBytes: new TextEncoder().encode(content).length,
      }),
    },
  });

  return jsonOk(serializeDates(file));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const existing = await prisma.userFile.findFirst({
    where: { id, userId },
  });
  if (!existing) return jsonError("Файл не найден", 404);

  await prisma.userFile.delete({ where: { id } });

  return jsonOk({ success: true });
}
