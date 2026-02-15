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

  const tool = await prisma.tool.findFirst({
    where: { id, userId },
  });

  if (!tool) {
    return jsonError("Not found", 404);
  }

  const updated = await prisma.tool.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.iconColor !== undefined && { iconColor: body.iconColor }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.config !== undefined && { config: body.config }),
      ...(body.inputSchema !== undefined && { inputSchema: body.inputSchema }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
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
