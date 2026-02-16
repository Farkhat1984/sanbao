import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { toolUpdateSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const tool = await prisma.tool.findFirst({
    where: {
      id,
      OR: [{ userId }, { isGlobal: true }],
    },
  });

  if (!tool) {
    return jsonError("Not found", 404);
  }

  return jsonOk(serializeDates(tool));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;
  const body = await req.json();
  const parsed = toolUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }

  const tool = await prisma.tool.findFirst({
    where: { id, userId },
  });

  if (!tool) {
    return jsonError("Not found", 404);
  }

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) data[key] = value;
  }

  const updated = await prisma.tool.update({
    where: { id },
    data,
  });

  return jsonOk(serializeDates(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const tool = await prisma.tool.findFirst({
    where: { id, userId },
  });

  if (!tool) {
    return jsonError("Not found", 404);
  }

  await prisma.tool.delete({ where: { id } });
  return jsonOk({ success: true });
}
