import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { agentCreateSchema } from "@/lib/validation";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  // Parallel fetch: system agents + user agents
  const [systemAgents, userAgents] = await Promise.all([
    prisma.agent.findMany({
      where: { isSystem: true, status: "APPROVED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        iconColor: true,
        model: true,
        avatar: true,
        isSystem: true,
        updatedAt: true,
        _count: { select: { conversations: true, files: true } },
      },
    }),
    prisma.agent.findMany({
      where: { userId, isSystem: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        iconColor: true,
        model: true,
        avatar: true,
        isSystem: true,
        updatedAt: true,
        _count: { select: { conversations: true, files: true } },
      },
    }),
  ]);

  return jsonOk({
    systemAgents: systemAgents.map(serializeDates),
    userAgents: userAgents.map(serializeDates),
  });
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = agentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }
  const { name, description, instructions, model, icon, iconColor, avatar, starterPrompts, skillIds, mcpServerIds } = parsed.data;

  // Check maxAgents limit (0 = no agents allowed, -1 = unlimited; admins bypass)
  const { plan } = await getUserPlanAndUsage(userId);
  if (session.user.role !== "ADMIN" && plan) {
    if (plan.maxAgents === 0) {
      return jsonError("Создание агентов недоступно на вашем тарифе", 403);
    }
    if (plan.maxAgents > 0) {
      const agentCount = await prisma.agent.count({
        where: { userId, isSystem: false },
      });
      if (agentCount >= plan.maxAgents) {
        return jsonError(`Достигнут лимит агентов (${plan.maxAgents}). Перейдите на более высокий тариф.`, 403);
      }
    }
  }

  const agent = await prisma.agent.create({
    data: {
      userId,
      name,
      description,
      instructions,
      model,
      icon: icon || DEFAULT_AGENT_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
      avatar: avatar || null,
      starterPrompts: starterPrompts.filter((s: string) => s.trim()),
    },
    include: { files: true },
  });

  // Create skill associations
  if (skillIds.length > 0) {
    await prisma.agentSkill.createMany({
      data: skillIds.map((skillId: string) => ({ agentId: agent.id, skillId })),
    });
  }

  // Create MCP server associations
  if (mcpServerIds.length > 0) {
    await prisma.agentMcpServer.createMany({
      data: mcpServerIds.map((mcpServerId: string) => ({ agentId: agent.id, mcpServerId })),
    });
  }

  return jsonOk({
    ...serializeDates(agent),
    files: [],
    skills: [],
    mcpServers: [],
  }, 201);
}
