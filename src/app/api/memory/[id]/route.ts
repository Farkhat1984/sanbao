import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return jsonError("Содержимое обязательно", 400);
  }

  const existing = await prisma.userMemory.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найдено", 404);
  }

  const memory = await prisma.userMemory.update({
    where: { id },
    data: { content: content.trim() },
  });

  return jsonOk(serializeDates(memory));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.userMemory.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найдено", 404);
  }

  await prisma.userMemory.delete({ where: { id } });

  return jsonOk({ success: true });
}
