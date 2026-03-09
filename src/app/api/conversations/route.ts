import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { resolveAgentId, FEMIDA_ID } from "@/lib/system-agents";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { getSettingNumber } from "@/lib/settings";
import { DEFAULT_CONVERSATION_TITLE } from "@/lib/constants";

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const maxPage = await getSettingNumber('pagination_conversations_max');
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, maxPage);
  const showArchived = searchParams.get("archived") === "true";

  const conversations = await prisma.conversation.findMany({
    where: { userId, archived: showArchived },
    orderBy: { updatedAt: "desc" },
    take: limit + 1, // fetch one extra to determine if there are more
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      pinned: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
      agentId: true,
      systemAgentId: true,
      isSwarmMode: true,
      swarmOrgId: true,
      agent: { select: { id: true, name: true, icon: true, iconColor: true, isSystem: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const items = conversations.map((c) => {
    const base = {
      id: c.id,
      title: c.title,
      pinned: c.pinned,
      archived: c.archived,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: c.messages[0]?.content,
      isSwarmMode: c.isSwarmMode,
      swarmOrgId: c.swarmOrgId,
    };

    // Use agent relation if available
    if (c.agent) {
      return {
        ...base,
        agentId: c.agent.id,
        agentName: c.agent.name,
        agentIcon: c.agent.icon,
        agentIconColor: c.agent.iconColor,
        isSystemAgent: c.agent.isSystem,
      };
    }

    // Legacy fallback: systemAgentId without agent relation
    if (c.systemAgentId) {
      const isFemida = c.systemAgentId === FEMIDA_ID;
      return {
        ...base,
        agentId: resolveAgentId(c.systemAgentId),
        agentName: isFemida ? "Фемида" : null,
        agentIcon: isFemida ? "Scale" : null,
        agentIconColor: isFemida ? "#B8956A" : null,
        isSystemAgent: true,
      };
    }

    return {
      ...base,
      agentId: null,
      agentName: null,
      agentIcon: null,
      agentIconColor: null,
      isSystemAgent: false,
    };
  });

  const hasMore = conversations.length > limit;
  if (hasMore) {
    items.pop(); // remove the extra item
  }
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return jsonOk({ items, nextCursor });
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { title, agentId, orgAgentId, isSwarmMode, swarmOrgId } = body;

  // Check maxConversations limit (admins bypass)
  const { plan } = await getUserPlanAndUsage(userId);
  if (session.user.role !== "ADMIN" && plan && plan.maxConversations > 0) {
    const count = await prisma.conversation.count({
      where: { userId, archived: false },
    });
    if (count >= plan.maxConversations) {
      return jsonError(`Достигнут лимит диалогов (${plan.maxConversations}). Удалите старые или перейдите на более высокий тариф.`, 403);
    }
  }

  // Resolve legacy IDs and use agentId for all agents
  const resolvedId = agentId ? resolveAgentId(agentId) : null;

  // Validate agent access: only own agents or system agents
  if (resolvedId) {
    const agentAccess = await prisma.agent.findFirst({
      where: {
        id: resolvedId,
        OR: [{ userId }, { isSystem: true, status: "APPROVED" }],
      },
      select: { id: true },
    });
    if (!agentAccess) {
      return jsonError("Агент не найден или недоступен", 404);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      title: title || DEFAULT_CONVERSATION_TITLE,
      userId,
      agentId: resolvedId,
      orgAgentId: orgAgentId || null,
      isSwarmMode: isSwarmMode || false,
      swarmOrgId: swarmOrgId || null,
    },
  });

  // Build response with agent info
  let agentInfo = null;
  if (resolvedId) {
    agentInfo = await prisma.agent.findUnique({
      where: { id: resolvedId },
      select: { id: true, name: true, icon: true, iconColor: true, isSystem: true },
    });
  }

  return jsonOk({
    id: conversation.id,
    title: conversation.title,
    pinned: false,
    archived: false,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    agentId: agentInfo?.id ?? null,
    agentName: agentInfo?.name ?? null,
    agentIcon: agentInfo?.icon ?? null,
    agentIconColor: agentInfo?.iconColor ?? null,
    isSystemAgent: agentInfo?.isSystem ?? false,
    isSwarmMode: conversation.isSwarmMode,
    swarmOrgId: conversation.swarmOrgId,
  }, 201);
}
