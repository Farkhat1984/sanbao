import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const AGENT_INCLUDE = {
  files: true,
  skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
  tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
  plugins: { include: { plugin: { select: { id: true, name: true, icon: true, iconColor: true } } } },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  // Allow access to own agents AND system agents
  const agent = await prisma.agent.findFirst({
    where: {
      id,
      OR: [
        { userId },
        { isSystem: true },
      ],
    },
    include: AGENT_INCLUDE,
  });

  if (!agent) {
    return jsonError("Агент не найден", 404);
  }

  return jsonOk(serializeDates(agent));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;
  const body = await req.json();
  const { name, description, instructions, model, icon, iconColor, avatar, starterPrompts, skillIds, mcpServerIds, toolIds, pluginIds } = body;

  const existing = await prisma.agent.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Агент не найден", 404);
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
      ...(starterPrompts !== undefined && { starterPrompts: Array.isArray(starterPrompts) ? starterPrompts.filter((s: string) => s.trim()) : [] }),
    },
    include: AGENT_INCLUDE,
  });

  // Update associations atomically to prevent partial state on failure
  const hasAssociationUpdates = Array.isArray(skillIds) || Array.isArray(mcpServerIds) || Array.isArray(toolIds) || Array.isArray(pluginIds);
  if (hasAssociationUpdates) {
    await prisma.$transaction(async (tx) => {
      if (Array.isArray(skillIds)) {
        await tx.agentSkill.deleteMany({ where: { agentId: id } });
        if (skillIds.length > 0) {
          await tx.agentSkill.createMany({
            data: skillIds.map((skillId: string) => ({ agentId: id, skillId })),
          });
        }
      }
      if (Array.isArray(mcpServerIds)) {
        await tx.agentMcpServer.deleteMany({ where: { agentId: id } });
        if (mcpServerIds.length > 0) {
          await tx.agentMcpServer.createMany({
            data: mcpServerIds.map((mcpServerId: string) => ({ agentId: id, mcpServerId })),
          });
        }
      }
      if (Array.isArray(toolIds)) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        if (toolIds.length > 0) {
          await tx.agentTool.createMany({
            data: toolIds.map((toolId: string) => ({ agentId: id, toolId })),
          });
        }
      }
      if (Array.isArray(pluginIds)) {
        await tx.agentPlugin.deleteMany({ where: { agentId: id } });
        if (pluginIds.length > 0) {
          await tx.agentPlugin.createMany({
            data: pluginIds.map((pluginId: string) => ({ agentId: id, pluginId })),
          });
        }
      }
    });
  }

  // Refetch with relations if associations were updated
  if (Array.isArray(skillIds) || Array.isArray(mcpServerIds) || Array.isArray(toolIds) || Array.isArray(pluginIds)) {
    const updated = await prisma.agent.findUnique({ where: { id }, include: AGENT_INCLUDE });
    return jsonOk(serializeDates(updated!));
  }

  return jsonOk(serializeDates(agent));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.agent.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Агент не найден", 404);
  }

  await prisma.agent.delete({ where: { id } });

  return jsonOk({ success: true });
}
