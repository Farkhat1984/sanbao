import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { agents: true } },
    },
  });

  if (!skill) {
    return jsonError("Скилл не найден", 404);
  }

  return jsonOk(skill);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return jsonError("Скилл не найден", 404);
  }

  const allowedFields = [
    "name", "description", "systemPrompt", "templates", "citationRules",
    "jurisdiction", "icon", "iconColor", "isBuiltIn", "isPublic", "status",
    "category", "tags",
  ];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  // Validate tags if provided
  if (data.tags !== undefined) {
    data.tags = Array.isArray(data.tags)
      ? (data.tags as unknown[]).filter((t: unknown) => typeof t === "string" && (t as string).length <= 50).slice(0, 20)
      : [];
  }

  const updated = await prisma.skill.update({ where: { id }, data });
  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return jsonError("Скилл не найден", 404);
  }

  await prisma.skill.delete({ where: { id } });
  return jsonOk({ success: true });
}
