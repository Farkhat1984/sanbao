import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      agent: { select: { id: true, name: true, icon: true, iconColor: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const result = conversations.map((c) => ({
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
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, agentId } = await req.json();

  const conversation = await prisma.conversation.create({
    data: {
      title: title || "Новый чат",
      userId: session.user.id,
      agentId: agentId || null,
    },
  });

  // If created with an agent, fetch agent info for the response
  let agentInfo = null;
  if (agentId) {
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
