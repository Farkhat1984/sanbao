import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { deleteProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";
import { OrgAgentStatus } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
    include: {
      files: { orderBy: { createdAt: "desc" } },
      mcpServer: { select: { id: true, name: true, url: true, status: true, discoveredTools: true } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
      _count: { select: { files: true, members: true, conversations: true } },
    },
  });

  if (!agent) return jsonError("Агент не найден", 404);

  return jsonOk(serializeDates({
    ...agent,
    fileCount: agent._count.files,
    memberCount: agent._count.members,
    conversationCount: agent._count.conversations,
  }));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const existing = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!existing) return jsonError("Агент не найден", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { name, description, icon, iconColor, instructions, starterPrompts, skillIds, mcpServerIds, status } = body;

  // Only allow specific status transitions
  const allowedStatuses: OrgAgentStatus[] = [OrgAgentStatus.READY, OrgAgentStatus.ERROR];
  const statusUpdate = typeof status === "string" && allowedStatuses.includes(status as OrgAgentStatus)
    ? { status: status as OrgAgentStatus }
    : {};

  const agent = await prisma.orgAgent.update({
    where: { id: agentId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(icon !== undefined && { icon }),
      ...(iconColor !== undefined && { iconColor }),
      ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
      ...(starterPrompts !== undefined && {
        starterPrompts: Array.isArray(starterPrompts) ? starterPrompts.filter((s: string) => s.trim()) : [],
      }),
      ...statusUpdate,
    },
    include: {
      files: { orderBy: { createdAt: "desc" } },
      mcpServer: { select: { id: true, name: true, url: true, status: true, discoveredTools: true } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
      _count: { select: { files: true, members: true, conversations: true } },
    },
  });

  // Update skill associations
  if (Array.isArray(skillIds)) {
    await prisma.orgAgentSkill.deleteMany({ where: { orgAgentId: agentId } });
    if (skillIds.length > 0) {
      await prisma.orgAgentSkill.createMany({
        data: skillIds.map((skillId: string) => ({ orgAgentId: agentId, skillId })),
      });
    }
  }

  // Update MCP server associations
  if (Array.isArray(mcpServerIds)) {
    await prisma.orgAgentMcpServer.deleteMany({ where: { orgAgentId: agentId } });
    if (mcpServerIds.length > 0) {
      await prisma.orgAgentMcpServer.createMany({
        data: mcpServerIds.map((mcpServerId: string) => ({ orgAgentId: agentId, mcpServerId })),
      });
    }
  }

  // Refetch if associations changed
  if (Array.isArray(skillIds) || Array.isArray(mcpServerIds)) {
    const updated = await prisma.orgAgent.findUnique({
      where: { id: agentId },
      include: {
        files: { orderBy: { createdAt: "desc" } },
        mcpServer: { select: { id: true, name: true, url: true, status: true, discoveredTools: true } },
        skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
        mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
        _count: { select: { files: true, members: true, conversations: true } },
      },
    });
    return jsonOk(serializeDates({
      ...updated!,
      fileCount: updated!._count.files,
      memberCount: updated!._count.members,
      conversationCount: updated!._count.conversations,
    }));
  }

  return jsonOk(serializeDates({
    ...agent,
    fileCount: agent._count.files,
    memberCount: agent._count.members,
    conversationCount: agent._count.conversations,
  }));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  // Try to delete project from AI Cortex
  if (agent.projectId) {
    try {
      const org = await prisma.organization.findUnique({ where: { id } });
      if (org?.nsApiKey) {
        await deleteProject(decrypt(org.nsApiKey), agent.projectId);
      }
    } catch {
      // Non-critical, continue with deletion
    }
  }

  await prisma.orgAgent.delete({ where: { id: agentId } });

  await logAudit({
    actorId: userId,
    action: "DELETE",
    target: "OrgAgent",
    targetId: agentId,
  });

  return jsonOk({ success: true });
}
