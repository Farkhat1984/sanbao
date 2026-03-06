import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { deleteProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";

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
