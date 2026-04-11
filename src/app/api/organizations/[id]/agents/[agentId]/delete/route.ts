import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { deleteProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";

export async function POST(
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

  // Delete project in AI Cortex
  if (agent.projectId) {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (org?.nsApiKey) {
      const nsApiKey = decrypt(org.nsApiKey);
      try {
        await deleteProject(nsApiKey, agent.projectId);
      } catch {
        // Best-effort
      }
    }
  }

  // Delete MCP server if exists
  if (agent.mcpServerId) {
    try {
      await prisma.mcpServer.delete({ where: { id: agent.mcpServerId } });
    } catch {
      // May already be deleted
    }
  }

  // Delete all files
  await prisma.orgAgentFile.deleteMany({
    where: { orgAgentId: agentId },
  });

  // Reset agent state
  await prisma.orgAgent.update({
    where: { id: agentId },
    data: {
      projectId: null,
      mcpServerId: null,
      status: "CREATING",
    },
  });

  await logAudit({
    actorId: userId,
    action: "DELETE_KNOWLEDGE",
    target: "OrgAgent",
    targetId: agentId,
  });

  return jsonOk({ success: true });
}
