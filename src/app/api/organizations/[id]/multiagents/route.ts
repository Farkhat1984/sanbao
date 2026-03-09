import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership) return jsonError("Нет доступа", 403);

  const multiAgents = await prisma.multiAgent.findMany({
    where: { orgId },
    include: {
      members: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return jsonOk(multiAgents);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return jsonError("Нет прав для создания мультиагента", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Некорректный JSON", 400);
  }

  const { name, description, icon, iconColor, starterPrompts, agents } = body as {
    name?: string;
    description?: string;
    icon?: string;
    iconColor?: string;
    starterPrompts?: string[];
    agents?: Array<{ type: string; id: string }>;
  };

  if (!name?.trim()) return jsonError("Название обязательно", 400);
  if (!agents || !Array.isArray(agents) || agents.length < 2) {
    return jsonError("Выберите минимум 2 агентов", 400);
  }

  const multiAgent = await prisma.multiAgent.create({
    data: {
      orgId,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || null,
      iconColor: iconColor || null,
      starterPrompts: starterPrompts?.filter((s) => s.trim()) || [],
      createdById: userId,
      members: {
        create: agents.map((a) => ({
          agentType: a.type,
          agentId: a.id,
        })),
      },
    },
    include: { members: true },
  });

  return jsonOk(multiAgent, 201);
}
