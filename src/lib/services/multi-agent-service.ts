/**
 * Multi-agent orchestration service.
 * Extracted from chat/route.ts handleMultiAgentMode().
 */

import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { resolveModel } from "@/lib/model-router";
import { recordRequestDuration } from "@/lib/request-metrics";
import { CORRELATION_HEADER } from "@/lib/correlation";
import { loadAgentContext, type OrgAgentContext } from "@/lib/swarm/agent-loader";
import { consultAndSynthesize } from "@/lib/swarm/consult";

export interface MultiAgentParams {
  messages: Array<{ role: string; content: string }>;
  swarmOrgId: string;
  multiAgentId: string;
  userId: string;
  planId: string;
  requestId: string;
  requestStart: number;
  signal: AbortSignal;
}

export interface MultiAgentResult {
  response?: Response;
  orgAgentId?: string;
}

export async function handleMultiAgentMode(params: MultiAgentParams): Promise<MultiAgentResult> {
  const { messages, swarmOrgId, multiAgentId, userId, planId, requestId, requestStart, signal } = params;

  // Verify user is org member
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: swarmOrgId, userId } },
  });
  if (!membership) {
    return { response: jsonError("Нет доступа к организации", 403) as unknown as Response };
  }

  const multiAgent = await prisma.multiAgent.findUnique({
    where: { id: multiAgentId },
    include: { members: true, org: { select: { name: true } } },
  });

  if (!multiAgent || multiAgent.orgId !== swarmOrgId) {
    return { response: jsonError("Мультиагент не найден", 404) as unknown as Response };
  }

  const textModel = await resolveModel("TEXT", planId);
  if (!textModel) {
    return { response: jsonError("Нет настроенной модели", 500) as unknown as Response };
  }

  // Load all configured agent contexts using universal loader
  const members = multiAgent.members as Array<{ agentType: string; agentId: string }>;
  const agentContexts = (await Promise.all(
    members.map((m) => loadAgentContext(m.agentType, m.agentId, userId))
  )).filter((ctx): ctx is OrgAgentContext => ctx !== null);

  if (agentContexts.length === 0) return {};
  if (agentContexts.length === 1) {
    const member = members[0];
    if (member.agentType === "org") return { orgAgentId: member.agentId };
    return {};
  }

  const conversationHistory = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role.toLowerCase(),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserMessage = typeof lastUserMsg?.content === "string"
    ? lastUserMsg.content
    : JSON.stringify(lastUserMsg?.content || "");

  const stream = consultAndSynthesize({
    userMessage: lastUserMessage,
    conversationHistory,
    agentContexts,
    orgName: multiAgent.org.name,
    inaccessibleAgents: [],
    model: textModel,
    signal,
  });

  recordRequestDuration("/api/chat", Date.now() - requestStart);
  return {
    response: new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        [CORRELATION_HEADER]: requestId,
      },
    }),
  };
}
