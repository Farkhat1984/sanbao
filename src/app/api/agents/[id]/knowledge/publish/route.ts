import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { publishProject } from "@/lib/ai-cortex-client";
import { connectAndDiscoverTools } from "@/lib/mcp-client";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id, userId },
    include: {
      mcpServers: true,
    },
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан", 400);

  // Get user's cortex API key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cortexNsApiKey: true, name: true },
  });
  if (!user?.cortexNsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(user.cortexNsApiKey);

  // Publish in AI Cortex
  let endpoint: string;
  let domain: string;
  try {
    const agentSlug = `agent_${id}`;
    const pubResult = await publishProject(nsApiKey, agent.projectId, agentSlug);
    endpoint = pubResult.endpoint;
    domain = pubResult.domain;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка публикации";
    await prisma.agent.update({ where: { id }, data: { knowledgeStatus: "ERROR" } });
    return jsonError(msg, 502);
  }

  // Find existing knowledge MCP server linked to this agent, or create new one
  // Look for an MCP server that was previously created for this agent's knowledge
  const existingLink = agent.mcpServers.find((link) =>
    link.mcpServerId // we'll check below if it's a knowledge server
  );

  let mcpServer;
  if (existingLink) {
    // Update existing MCP server URL
    mcpServer = await prisma.mcpServer.update({
      where: { id: existingLink.mcpServerId },
      data: { url: endpoint, status: "DISCONNECTED" },
    });
  } else {
    // Create new MCP server owned by the user
    mcpServer = await prisma.mcpServer.create({
      data: {
        userId,
        name: `${agent.name} - База знаний`,
        url: endpoint,
        transport: "STREAMABLE_HTTP",
        apiKey: user.cortexNsApiKey, // stored encrypted
        isGlobal: false,
        isEnabled: true,
      },
    });
  }

  // Discover tools via the MCP endpoint
  const { tools, error: discoverError } = await connectAndDiscoverTools(
    endpoint,
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

  // Link agent to MCP server if not already linked
  if (!existingLink) {
    await prisma.agentMcpServer.create({
      data: { agentId: id, mcpServerId: mcpServer.id },
    });
  }

  // Update agent knowledge status
  const updated = await prisma.agent.update({
    where: { id },
    data: { knowledgeStatus: "PUBLISHED" },
    include: {
      files: { orderBy: { createdAt: "desc" } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true, discoveredTools: true } } } },
      tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      integrations: { include: { integration: { select: { id: true, name: true, type: true, status: true } } } },
    },
  });

  await logAudit({
    actorId: userId,
    action: "PUBLISH_KNOWLEDGE",
    target: "Agent",
    targetId: id,
    details: { endpoint, mcpServerId: mcpServer.id, toolCount: tools.length },
  });

  return jsonOk(serializeDates(updated as unknown as Record<string, unknown>));
}
