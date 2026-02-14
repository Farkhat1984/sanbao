import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";
import { isSystemAgent, FEMIDA_AGENT, FEMIDA_ID } from "@/lib/system-agents";

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
      agent: { select: { id: true, name: true, icon: true, iconColor: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const result = conversations.map((c) => {
    // System agent info
    if (c.systemAgentId === FEMIDA_ID) {
      return {
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        archived: c.archived,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: c.messages[0]?.content,
        agentId: FEMIDA_ID,
        agentName: FEMIDA_AGENT.name,
        agentIcon: FEMIDA_AGENT.icon,
        agentIconColor: FEMIDA_AGENT.iconColor,
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
      agentId: c.agent?.id ?? null,
      agentName: c.agent?.name ?? null,
      agentIcon: c.agent?.icon ?? null,
      agentIconColor: c.agent?.iconColor ?? null,
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

  // Check maxConversations limit
  const { plan } = await getUserPlanAndUsage(session.user.id);
  if (plan && plan.maxConversations > 0) {
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

  // Separate system agents from user agents
  const isSystem = isSystemAgent(agentId);

  const conversation = await prisma.conversation.create({
    data: {
      title: title || "Новый чат",
      userId: session.user.id,
      agentId: isSystem ? null : (agentId || null),
      systemAgentId: isSystem ? agentId : null,
    },
  });

  // Build response with agent info
  let agentInfo = null;
  if (isSystem && agentId === FEMIDA_ID) {
    agentInfo = {
      id: FEMIDA_ID,
      name: FEMIDA_AGENT.name,
      icon: FEMIDA_AGENT.icon,
      iconColor: FEMIDA_AGENT.iconColor,
    };
  } else if (agentId && !isSystem) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: session.user.id },
      select: { id: true, name: true, icon: true, iconColor: true },
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
  });
}
