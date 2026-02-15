import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const plugins = await prisma.plugin.findMany({
    where: { isGlobal: true },
    orderBy: { sortOrder: "asc" },
    include: {
      tools: { include: { tool: { select: { id: true, name: true, icon: true } } } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, status: true } } } },
      agents: { include: { agent: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(plugins.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { name, description, icon, iconColor, version, toolIds, skillIds, mcpServerIds } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  const plugin = await prisma.plugin.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "Puzzle",
      iconColor: iconColor || "#4F6EF7",
      version: version || "1.0.0",
      isGlobal: true,
    },
  });

  if (Array.isArray(toolIds) && toolIds.length > 0) {
    await prisma.pluginTool.createMany({
      data: toolIds.map((toolId: string) => ({ pluginId: plugin.id, toolId })),
    });
  }

  if (Array.isArray(skillIds) && skillIds.length > 0) {
    await prisma.pluginSkill.createMany({
      data: skillIds.map((skillId: string) => ({ pluginId: plugin.id, skillId })),
    });
  }

  if (Array.isArray(mcpServerIds) && mcpServerIds.length > 0) {
    await prisma.pluginMcpServer.createMany({
      data: mcpServerIds.map((mcpServerId: string) => ({ pluginId: plugin.id, mcpServerId })),
    });
  }

  return NextResponse.json({
    ...plugin,
    createdAt: plugin.createdAt.toISOString(),
    updatedAt: plugin.updatedAt.toISOString(),
  });
}
