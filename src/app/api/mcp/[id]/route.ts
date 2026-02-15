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

  const server = await prisma.mcpServer.findFirst({
    where: { id, OR: [{ userId }, { isGlobal: true, isEnabled: true }] },
  });

  if (!server) {
    return jsonError("Не найден", 404);
  }

  return jsonOk(serializeDates({
    ...server,
    ...(server.isGlobal ? { apiKey: null } : {}),
  }));
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

  const existing = await prisma.mcpServer.findFirst({
    where: { id },
  });

  if (!existing) {
    return jsonError("Не найден", 404);
  }

  // Toggle user activation of a global MCP server
  if (existing.isGlobal && body.userActive !== undefined) {
    const link = await prisma.userMcpServer.upsert({
      where: { userId_mcpServerId: { userId, mcpServerId: id } },
      create: { userId, mcpServerId: id, isActive: body.userActive },
      update: { isActive: body.userActive },
    });
    return jsonOk({ success: true, isActive: link.isActive });
  }

  // Edit user's own server
  if (existing.userId !== userId) {
    return jsonError("Нет доступа", 403);
  }

  const server = await prisma.mcpServer.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.url !== undefined && { url: body.url.trim() }),
      ...(body.transport !== undefined && { transport: body.transport }),
      ...(body.apiKey !== undefined && { apiKey: body.apiKey?.trim() || null }),
    },
  });

  return jsonOk(serializeDates(server));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.mcpServer.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найден", 404);
  }

  await prisma.mcpServer.delete({ where: { id } });

  return jsonOk({ success: true });
}
