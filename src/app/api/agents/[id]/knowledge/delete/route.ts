import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { deleteProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId },
    include: { mcpServers: true },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  // Delete project in AI Cortex
  if (agent.projectId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cortexNsApiKey: true },
    });
    if (user?.cortexNsApiKey) {
      const nsApiKey = decrypt(user.cortexNsApiKey);
      try {
        await deleteProject(nsApiKey, agent.projectId);
      } catch {
        // Best-effort — project may not exist in Cortex
      }
    }
  }

  // Delete MCP servers linked to this agent's knowledge
  for (const link of agent.mcpServers) {
    try {
      // Delete the MCP server itself (cascade deletes AgentMcpServer)
      await prisma.mcpServer.delete({ where: { id: link.mcpServerId } });
    } catch {
      // May already be deleted
    }
  }

  // Delete all fdb-tier files
  await prisma.agentFile.deleteMany({
    where: { agentId: id, tier: "fdb" },
  });

  // Reset agent knowledge state
  await prisma.agent.update({
    where: { id },
    data: {
      projectId: null,
      knowledgeStatus: "NONE",
    },
  });

  await logAudit({
    actorId: userId,
    action: "DELETE_KNOWLEDGE",
    target: "Agent",
    targetId: id,
  });

  return jsonOk({ success: true });
}
