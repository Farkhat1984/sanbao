import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
    include: {
      files: true,
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    files: agent.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, description, instructions, model, icon, iconColor, avatar, skillIds, mcpServerIds } = body;

  const existing = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
      ...(instructions !== undefined && { instructions: instructions.trim() }),
      ...(model !== undefined && { model }),
      ...(icon !== undefined && { icon }),
      ...(iconColor !== undefined && { iconColor }),
      ...(avatar !== undefined && { avatar: avatar || null }),
    },
    include: {
      files: true,
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
    },
  });

  // Update skill associations
  if (Array.isArray(skillIds)) {
    await prisma.agentSkill.deleteMany({ where: { agentId: id } });
    if (skillIds.length > 0) {
      await prisma.agentSkill.createMany({
        data: skillIds.map((skillId: string) => ({ agentId: id, skillId })),
      });
    }
  }

  // Update MCP server associations
  if (Array.isArray(mcpServerIds)) {
    await prisma.agentMcpServer.deleteMany({ where: { agentId: id } });
    if (mcpServerIds.length > 0) {
      await prisma.agentMcpServer.createMany({
        data: mcpServerIds.map((mcpServerId: string) => ({ agentId: id, mcpServerId })),
      });
    }
  }

  return NextResponse.json({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    files: agent.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  await prisma.agent.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
