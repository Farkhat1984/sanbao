import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { processProject, publishProject } from "@/lib/ai-cortex-client";
import { connectAndDiscoverTools } from "@/lib/mcp-client";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

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
  if (!agent?.projectId) return jsonError("Агент не найден", 404);

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org?.nsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(org.nsApiKey);

  await prisma.orgAgent.update({
    where: { id: agentId },
    data: { status: "PROCESSING" },
  });

  try {
    await processProject(nsApiKey, agent.projectId);
    const { endpoint } = await publishProject(nsApiKey, agent.projectId);

    // Refresh MCP tools
    if (agent.mcpServerId) {
      const { tools } = await connectAndDiscoverTools(endpoint, "STREAMABLE_HTTP", nsApiKey);
      await prisma.mcpServer.update({
        where: { id: agent.mcpServerId },
        data: {
          url: endpoint,
          status: tools.length > 0 ? "CONNECTED" : "ERROR",
          discoveredTools: tools as unknown as Prisma.InputJsonValue,
          lastHealthCheck: new Date(),
        },
      });
    }

    await prisma.orgAgent.update({
      where: { id: agentId },
      data: { status: "PUBLISHED" },
    });
  } catch (err) {
    await prisma.orgAgent.update({
      where: { id: agentId },
      data: { status: "ERROR" },
    });
    const msg = err instanceof Error ? err.message : "Ошибка переобработки";
    return jsonError(msg, 502);
  }

  await logAudit({
    actorId: userId,
    action: "REPROCESS",
    target: "OrgAgent",
    targetId: agentId,
  });

  return jsonOk({ success: true, status: "PUBLISHED" });
}
