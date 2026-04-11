import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { publishProject } from "@/lib/ai-cortex-client";
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

  // Publish in AI Cortex with agent name for tool generation
  let endpoint: string;
  let internalEndpoint: string;
  let domain: string;
  try {
    const agentSlug = `agent_${agentId}`;
    const result = await publishProject(nsApiKey, agent.projectId, agentSlug);
    endpoint = result.endpoint;
    internalEndpoint = result.internalEndpoint;
    domain = result.domain;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка публикации";
    await prisma.orgAgent.update({ where: { id: agentId }, data: { status: "ERROR" } });
    return jsonError(msg, 502);
  }

  // Create or update McpServer
  let mcpServer;
  if (agent.mcpServerId) {
    mcpServer = await prisma.mcpServer.update({
      where: { id: agent.mcpServerId },
      data: { url: endpoint, status: "DISCONNECTED" },
    });
  } else {
    mcpServer = await prisma.mcpServer.create({
      data: {
        name: `${org.name} — ${agent.name}`,
        url: endpoint,
        transport: "STREAMABLE_HTTP",
        apiKey: org.nsApiKey,
        isGlobal: false,
        isEnabled: true,
      },
    });
  }

  // Discover tools via internal Docker endpoint (public URL not reachable from container)
  const { tools, error: discoverError } = await connectAndDiscoverTools(
    internalEndpoint,
    "STREAMABLE_HTTP",
    nsApiKey
  );

  if (tools.length > 0) {
    await prisma.mcpServer.update({
      where: { id: mcpServer.id },
      data: {
        status: "CONNECTED",
        discoveredTools: tools as unknown as Prisma.InputJsonValue,
        lastHealthCheck: new Date(),
      },
    });
  } else if (discoverError) {
    await prisma.mcpServer.update({
      where: { id: mcpServer.id },
      data: { status: "ERROR" },
    });
  }

  // Update OrgAgent
  const updated = await prisma.orgAgent.update({
    where: { id: agentId },
    data: { mcpServerId: mcpServer.id, status: "PUBLISHED" },
    include: {
      files: { orderBy: { createdAt: "desc" } },
      mcpServer: { select: { id: true, name: true, url: true, status: true, discoveredTools: true } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
      _count: { select: { files: true, members: true, conversations: true } },
    },
  });

  await logAudit({
    actorId: userId,
    action: "PUBLISH",
    target: "OrgAgent",
    targetId: agentId,
    details: { endpoint, mcpServerId: mcpServer.id, toolCount: tools.length },
  });

  return jsonOk(serializeDates({
    ...updated,
    fileCount: updated._count.files,
    memberCount: updated._count.members,
    conversationCount: updated._count.conversations,
  }));
}
