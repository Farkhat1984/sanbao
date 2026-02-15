import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const skill = await prisma.skill.findFirst({
    where: {
      id,
      OR: [
        { isBuiltIn: true },
        { userId },
        { isPublic: true },
      ],
    },
  });

  if (!skill) {
    return jsonError("Не найдено", 404);
  }

  return jsonOk(serializeDates(skill));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.skill.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найдено или нет доступа", 404);
  }

  const body = await req.json();
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor, isPublic } = body;

  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(systemPrompt !== undefined && { systemPrompt: systemPrompt.trim() }),
      ...(templates !== undefined && { templates }),
      ...(citationRules !== undefined && { citationRules: citationRules?.trim() || null }),
      ...(jurisdiction !== undefined && { jurisdiction }),
      ...(icon !== undefined && { icon }),
      ...(iconColor !== undefined && { iconColor }),
      ...(isPublic !== undefined && { isPublic }),
    },
  });

  return jsonOk(serializeDates(skill));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.skill.findFirst({
    where: { id, userId, isBuiltIn: false },
  });

  if (!existing) {
    return jsonError("Не найдено или нельзя удалить", 404);
  }

  await prisma.skill.delete({ where: { id } });

  return jsonOk({ success: true });
}
