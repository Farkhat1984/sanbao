import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const SYSTEM_AGENT_INCLUDE = {
  skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
  tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  plugins: { include: { plugin: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  files: true,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const agent = await prisma.agent.findFirst({
    where: { id, isSystem: true },
    include: SYSTEM_AGENT_INCLUDE,
  });

  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.instructions,
    icon: agent.icon,
    iconColor: agent.iconColor,
    avatar: agent.avatar,
    model: agent.model,
    isActive: agent.status === "APPROVED",
    sortOrder: agent.sortOrder,
    starterPrompts: agent.starterPrompts || [],
    files: agent.files,
    skills: agent.skills.map((s) => s.skill),
    mcpServers: agent.mcpServers.map((m) => m.mcpServer),
    tools: agent.tools.map((t) => t.tool),
    plugins: agent.plugins.map((p) => p.plugin),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const agent = await prisma.agent.findFirst({
    where: { id, isSystem: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  // Map admin fields to Agent model
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.systemPrompt !== undefined) data.instructions = body.systemPrompt;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.iconColor !== undefined) data.iconColor = body.iconColor;
  if (body.avatar !== undefined) data.avatar = body.avatar || null;
  if (body.model !== undefined) data.model = body.model;
  if (body.isActive !== undefined) data.status = body.isActive ? "APPROVED" : "PENDING";
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.starterPrompts !== undefined) data.starterPrompts = Array.isArray(body.starterPrompts) ? body.starterPrompts.filter((s: string) => s.trim()) : [];

  await prisma.agent.update({ where: { id }, data });

  // Update associations atomically
  const { skillIds, mcpServerIds, toolIds, pluginIds } = body;
  const hasAssociationUpdates = Array.isArray(skillIds) || Array.isArray(mcpServerIds) || Array.isArray(toolIds) || Array.isArray(pluginIds);

  if (hasAssociationUpdates) {
    await prisma.$transaction(async (tx) => {
      if (Array.isArray(skillIds)) {
        await tx.agentSkill.deleteMany({ where: { agentId: id } });
        if (skillIds.length > 0) {
          await tx.agentSkill.createMany({ data: skillIds.map((skillId: string) => ({ agentId: id, skillId })) });
        }
      }
      if (Array.isArray(mcpServerIds)) {
        await tx.agentMcpServer.deleteMany({ where: { agentId: id } });
        if (mcpServerIds.length > 0) {
          await tx.agentMcpServer.createMany({ data: mcpServerIds.map((mcpServerId: string) => ({ agentId: id, mcpServerId })) });
        }
      }
      if (Array.isArray(toolIds)) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        if (toolIds.length > 0) {
          await tx.agentTool.createMany({ data: toolIds.map((toolId: string) => ({ agentId: id, toolId })) });
        }
      }
      if (Array.isArray(pluginIds)) {
        await tx.agentPlugin.deleteMany({ where: { agentId: id } });
        if (pluginIds.length > 0) {
          await tx.agentPlugin.createMany({ data: pluginIds.map((pluginId: string) => ({ agentId: id, pluginId })) });
        }
      }
    });
  }

  // Refetch with all relations
  const updated = await prisma.agent.findUnique({ where: { id }, include: SYSTEM_AGENT_INCLUDE });

  return NextResponse.json({
    id: updated!.id,
    name: updated!.name,
    description: updated!.description,
    systemPrompt: updated!.instructions,
    icon: updated!.icon,
    iconColor: updated!.iconColor,
    avatar: updated!.avatar,
    model: updated!.model,
    isActive: updated!.status === "APPROVED",
    sortOrder: updated!.sortOrder,
    starterPrompts: updated!.starterPrompts || [],
    skills: updated!.skills.map((s) => s.skill),
    mcpServers: updated!.mcpServers.map((m) => m.mcpServer),
    tools: updated!.tools.map((t) => t.tool),
    plugins: updated!.plugins.map((p) => p.plugin),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const agent = await prisma.agent.findFirst({
    where: { id, isSystem: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
