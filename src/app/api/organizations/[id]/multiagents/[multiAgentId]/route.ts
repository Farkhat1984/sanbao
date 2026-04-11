import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; multiAgentId: string }> },
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership) return jsonError("Нет доступа", 403);

  const multiAgent = await prisma.multiAgent.findUnique({
    where: { id: multiAgentId },
    include: {
      members: true,
      files: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { id: true, name: true } },
      userAccess: { select: { userId: true } },
    },
  });

  if (!multiAgent || multiAgent.orgId !== orgId) {
    return jsonError("Мультиагент не найден", 404);
  }

  // Access check for non-admins
  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN";
  if (!isAdmin && multiAgent.accessMode === "SPECIFIC") {
    const hasAccess = multiAgent.userAccess.some((ua) => ua.userId === userId);
    if (!hasAccess) return jsonError("Нет доступа к этому мультиагенту", 403);
  }

  return jsonOk({
    ...multiAgent,
    files: multiAgent.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; multiAgentId: string }> },
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return jsonError("Нет прав", 403);
  }

  const existing = await prisma.multiAgent.findUnique({ where: { id: multiAgentId } });
  if (!existing || existing.orgId !== orgId) return jsonError("Не найден", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Некорректный JSON", 400);
  }

  const { name, description, icon, iconColor, instructions, starterPrompts, agents } = body as {
    name?: string;
    description?: string;
    icon?: string;
    iconColor?: string;
    instructions?: string;
    starterPrompts?: string[];
    agents?: Array<{ type: string; id: string }>;
  };

  if (agents && Array.isArray(agents) && agents.length < 2) {
    return jsonError("Минимум 2 агента", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (agents && Array.isArray(agents)) {
      await tx.multiAgentMember.deleteMany({ where: { multiAgentId } });
      await tx.multiAgentMember.createMany({
        data: agents.map((a) => ({
          multiAgentId,
          agentType: a.type,
          agentId: a.id,
        })),
      });
    }

    return tx.multiAgent.update({
      where: { id: multiAgentId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(icon !== undefined && { icon }),
        ...(iconColor !== undefined && { iconColor }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(starterPrompts && { starterPrompts: starterPrompts.filter((s) => s.trim()) }),
      },
      include: { members: true },
    });
  });

  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; multiAgentId: string }> },
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return jsonError("Нет прав", 403);
  }

  const existing = await prisma.multiAgent.findUnique({ where: { id: multiAgentId } });
  if (!existing || existing.orgId !== orgId) return jsonError("Не найден", 404);

  await prisma.multiAgent.delete({ where: { id: multiAgentId } });
  return jsonOk({ success: true });
}
