import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { resolveAgentId, FEMIDA_ID } from "@/lib/system-agents";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id, archived: false },
    orderBy: { updatedAt: "desc" },
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

  const result = conversations.map((c) => {
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
    // This handles old conversations before migration
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

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, agentId } = await req.json();

  // Check maxConversations limit (admins bypass)
  const { plan } = await getUserPlanAndUsage(session.user.id);
  if (session.user.role !== "ADMIN" && plan && plan.maxConversations > 0) {
    const count = await prisma.conversation.count({
      where: { userId: session.user.id, archived: false },
    });
    if (count >= plan.maxConversations) {
      return NextResponse.json(
        { error: `Достигнут лимит диалогов (${plan.maxConversations}). Удалите старые или перейдите на более высокий тариф.` },
        { status: 403 }
      );
    }
  }

  // Resolve legacy IDs and use agentId for all agents
  const resolvedId = agentId ? resolveAgentId(agentId) : null;

  const conversation = await prisma.conversation.create({
    data: {
      title: title || "Новый чат",
      userId: session.user.id,
      agentId: resolvedId,
    },
  });

  // Build response with agent info
  let agentInfo = null;
  if (resolvedId) {
    const agent = await prisma.agent.findUnique({
      where: { id: resolvedId },
      select: { id: true, name: true, icon: true, iconColor: true, isSystem: true },
    });
    agentInfo = agent;
  }

  return NextResponse.json({
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
  });
}
