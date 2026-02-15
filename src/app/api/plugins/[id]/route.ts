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

  const plugin = await prisma.plugin.findFirst({
    where: {
      id,
      OR: [{ userId }, { isGlobal: true }],
    },
    include: {
      tools: { include: { tool: true } },
      skills: { include: { skill: true } },
      mcpServers: { include: { mcpServer: true } },
    },
  });

  if (!plugin) {
    return jsonError("Not found", 404);
  }

  return jsonOk(serializeDates(plugin));
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

  const plugin = await prisma.plugin.findFirst({
    where: { id, userId },
  });

  if (!plugin) {
    return jsonError("Not found", 404);
  }

  const updated = await prisma.plugin.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.iconColor !== undefined && { iconColor: body.iconColor }),
      ...(body.version !== undefined && { version: body.version }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
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

  const plugin = await prisma.plugin.findFirst({
    where: { id, userId },
  });

  if (!plugin) {
    return jsonError("Not found", 404);
  }

  await prisma.plugin.delete({ where: { id } });
  return jsonOk({ success: true });
}
