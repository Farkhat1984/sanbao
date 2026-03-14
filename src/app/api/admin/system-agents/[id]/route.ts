import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

const SYSTEM_AGENT_INCLUDE = {
  skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  mcpServers: {
    include: {
      mcpServer: { select: { id: true, name: true, url: true, status: true } },
    },
  },
  tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
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
    return jsonError("Агент не найден", 404);
  }

  return jsonOk({
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
    mcpServers: agent.mcpServers.map((m) => ({
      ...m.mcpServer,
      allowedTools: m.allowedTools,
      domainMappings: m.domainMappings,
    })),
    tools: agent.tools.map((t) => t.tool),
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
    return jsonError("Агент не найден", 404);
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

  // Normalize mcpServers: support both new `mcpServers` array and legacy `mcpServerIds`
  const mcpServersInput: Array<{ id: string; allowedTools?: string[]; domainMappings?: Record<string, unknown> }> | undefined =
    Array.isArray(body.mcpServers)
      ? body.mcpServers
      : Array.isArray(body.mcpServerIds)
        ? body.mcpServerIds.map((mcpServerId: string) => ({ id: mcpServerId }))
        : undefined;

  // Update associations atomically
  const { skillIds, toolIds } = body;
  const hasAssociationUpdates = Array.isArray(skillIds) || mcpServersInput !== undefined || Array.isArray(toolIds);

  if (hasAssociationUpdates) {
    await prisma.$transaction(async (tx) => {
      if (Array.isArray(skillIds)) {
        await tx.agentSkill.deleteMany({ where: { agentId: id } });
        if (skillIds.length > 0) {
          await tx.agentSkill.createMany({ data: skillIds.map((skillId: string) => ({ agentId: id, skillId })) });
        }
      }
      if (mcpServersInput !== undefined) {
        await tx.agentMcpServer.deleteMany({ where: { agentId: id } });
        if (mcpServersInput.length > 0) {
          await tx.agentMcpServer.createMany({
            data: mcpServersInput.map((srv) => ({
              agentId: id,
              mcpServerId: srv.id,
              allowedTools: srv.allowedTools && srv.allowedTools.length > 0
                ? srv.allowedTools as unknown as import("@prisma/client").Prisma.InputJsonValue
                : undefined,
              domainMappings: srv.domainMappings
                ? srv.domainMappings as unknown as import("@prisma/client").Prisma.InputJsonValue
                : undefined,
            })),
          });
        }
      }
      if (Array.isArray(toolIds)) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        if (toolIds.length > 0) {
          await tx.agentTool.createMany({ data: toolIds.map((toolId: string) => ({ agentId: id, toolId })) });
        }
      }
    });
  }

  // Refetch with all relations
  const updated = await prisma.agent.findUnique({ where: { id }, include: SYSTEM_AGENT_INCLUDE });

  return jsonOk({
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
    mcpServers: updated!.mcpServers.map((m) => ({
      ...m.mcpServer,
      allowedTools: m.allowedTools,
      domainMappings: m.domainMappings,
    })),
    tools: updated!.tools.map((t) => t.tool),
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
    return jsonError("Агент не найден", 404);
  }

  await prisma.agent.delete({ where: { id } });
  return jsonOk({ success: true });
}
