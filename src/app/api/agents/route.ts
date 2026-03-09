import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError, jsonValidationError, serializeDates } from "@/lib/api-helpers";
import { agentCreateSchema } from "@/lib/validation";

const AGENT_SELECT = {
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
} as const;

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);
  const type = searchParams.get("type"); // "system" | "user" | null (both)

  // System agents: always returned in full (typically < 10 total, no pagination needed)
  const systemAgents = type !== "user"
    ? await prisma.agent.findMany({
        where: { isSystem: true, status: "APPROVED" },
        orderBy: { sortOrder: "asc" },
        select: AGENT_SELECT,
      })
    : [];

  // User agents: cursor-based pagination
  const userAgents = type !== "system"
    ? await prisma.agent.findMany({
        where: { userId, isSystem: false },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: AGENT_SELECT,
      })
    : [];

  const hasMore = type !== "system" && userAgents.length > limit;
  if (hasMore) userAgents.pop();
  const nextCursor = hasMore && userAgents.length > 0
    ? userAgents[userAgents.length - 1].id
    : null;

  return jsonOk({
    systemAgents: systemAgents.map(serializeDates),
    userAgents: userAgents.map(serializeDates),
    nextCursor,
    hasMore,
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
    return jsonValidationError(parsed.error);
  }
  const { name, description, instructions, model, icon, iconColor, avatar, starterPrompts, skillIds, mcpServerIds, integrationIds } = parsed.data;

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

  // Create integration associations
  if (integrationIds && integrationIds.length > 0) {
    await prisma.agentIntegration.createMany({
      data: integrationIds.map((integrationId: string) => ({ agentId: agent.id, integrationId })),
    });
  }

  return jsonOk({
    ...serializeDates(agent),
    files: [],
    skills: [],
    mcpServers: [],
    integrations: [],
  }, 201);
}
