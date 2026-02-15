import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AGENT_INCLUDE = {
  files: true,
  skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
  tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  plugins: { include: { plugin: { select: { id: true, name: true, icon: true, iconColor: true } } } },
};

function serializeAgent(agent: Record<string, unknown> & { createdAt: Date; updatedAt: Date; files: Array<{ createdAt: Date } & Record<string, unknown>> }) {
  return {
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    files: agent.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Allow access to own agents AND system agents
  const agent = await prisma.agent.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { isSystem: true },
      ],
    },
    include: AGENT_INCLUDE,
  });

  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  return NextResponse.json(serializeAgent(agent));
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
  const { name, description, instructions, model, icon, iconColor, avatar, skillIds, mcpServerIds, toolIds, pluginIds } = body;

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
    include: AGENT_INCLUDE,
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

  // Update tool associations
  if (Array.isArray(toolIds)) {
    await prisma.agentTool.deleteMany({ where: { agentId: id } });
    if (toolIds.length > 0) {
      await prisma.agentTool.createMany({
        data: toolIds.map((toolId: string) => ({ agentId: id, toolId })),
      });
    }
  }

  // Update plugin associations
  if (Array.isArray(pluginIds)) {
    await prisma.agentPlugin.deleteMany({ where: { agentId: id } });
    if (pluginIds.length > 0) {
      await prisma.agentPlugin.createMany({
        data: pluginIds.map((pluginId: string) => ({ agentId: id, pluginId })),
      });
    }
  }

  // Refetch with relations if associations were updated
  if (Array.isArray(skillIds) || Array.isArray(mcpServerIds) || Array.isArray(toolIds) || Array.isArray(pluginIds)) {
    const updated = await prisma.agent.findUnique({ where: { id }, include: AGENT_INCLUDE });
    return NextResponse.json(serializeAgent(updated!));
  }

  return NextResponse.json(serializeAgent(agent));
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
