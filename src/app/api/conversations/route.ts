import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { resolveAgentId, FEMIDA_ID } from "@/lib/system-agents";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const conversations = await prisma.conversation.findMany({
    where: { userId, archived: false },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      pinned: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
      agentId: true,
      systemAgentId: true,
      agent: { select: { id: true, name: true, icon: true, iconColor: true, isSystem: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const items = conversations.map((c) => {
    // Use agent relation if available
    if (c.agent) {
      return {
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        archived: c.archived,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: c.messages[0]?.content,
        agentId: c.agent.id,
        agentName: c.agent.name,
        agentIcon: c.agent.icon,
        agentIconColor: c.agent.iconColor,
        isSystemAgent: c.agent.isSystem,
      };
    }

    // Legacy fallback: systemAgentId without agent relation
    if (c.systemAgentId) {
      return {
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        archived: c.archived,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: c.messages[0]?.content,
        agentId: resolveAgentId(c.systemAgentId),
        agentName: c.systemAgentId === FEMIDA_ID ? "Фемида" : null,
        agentIcon: c.systemAgentId === FEMIDA_ID ? "Scale" : null,
        agentIconColor: c.systemAgentId === FEMIDA_ID ? "#7C3AED" : null,
        isSystemAgent: true,
      };
    }

    return {
      id: c.id,
      title: c.title,
      pinned: c.pinned,
      archived: c.archived,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: c.messages[0]?.content,
      agentId: null,
      agentName: null,
      agentIcon: null,
      agentIconColor: null,
      isSystemAgent: false,
    };
  });

  return jsonOk(items);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { title, agentId } = body;

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

  const conversation = await prisma.conversation.create({
    data: {
      title: title || "Новый чат",
      userId,
      agentId: resolvedId,
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
  }, 201);
}
