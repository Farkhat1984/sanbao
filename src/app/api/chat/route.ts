// ─── Chat API route — orchestrator ──────────────────────
// POST /api/chat — main streaming endpoint.
// Delegates to focused modules for validation, agent resolution, and context loading.

import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
import { incrementUsage, incrementTokens } from "@/lib/usage";
import { resolveModel } from "@/lib/model-router";
import { logTokenUsage } from "@/lib/audit";
import { fireAndForget } from "@/lib/logger";
import { recordRequestDuration } from "@/lib/request-metrics";
import { CORRELATION_HEADER, runWithCorrelationId, generateCorrelationId } from "@/lib/correlation";
import { retryOnce } from "@/lib/utils";
import type { NativeToolContext } from "@/lib/native-tools";

import { streamMoonshot } from "@/lib/chat/moonshot-stream";
import { streamAiSdk } from "@/lib/chat/ai-sdk-stream";
import { handleMultiAgentMode } from "@/lib/services/multi-agent-service";

import { validateChatRequest } from "./validate";
import { resolveAgentAndTools } from "./agent-resolver";
import { loadChatContext } from "./context-loader";

// ─── Main handler ────────────────────────────────────────

export async function POST(req: Request) {
  const requestId = req.headers.get(CORRELATION_HEADER) || generateCorrelationId();

  return runWithCorrelationId(requestId, async () => {
  const _requestStart = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return jsonError("Unauthorized", 401);
  }

  let rawBody;
  try {
    rawBody = await req.json();
  } catch {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return jsonError("Некорректный JSON в теле запроса", 400);
  }

  // ─── Validate request ──────────────────────────────
  const validation = await validateChatRequest(session.user.id, session.user.role, rawBody);
  if ("error" in validation) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return validation.error;
  }

  const { body, settings, planInfo } = validation.data;
  const { plan } = planInfo;
  let { orgAgentId } = body;

  // ─── Multi-Agent mode ─────────────────────────────
  if (body.swarmMode && body.swarmOrgId && body.multiAgentId) {
    const maResult = await handleMultiAgentMode({
      messages: body.messages,
      swarmOrgId: body.swarmOrgId,
      multiAgentId: body.multiAgentId,
      userId: session.user.id,
      planId: plan.id,
      requestId,
      requestStart: _requestStart,
      signal: req.signal,
    });
    if (maResult.response) {
      return maResult.response;
    }
    if (maResult.orgAgentId) {
      orgAgentId = maResult.orgAgentId;
    }
  }

  // ─── Resolve agent & tools ─────────────────────────
  const agentResult = await resolveAgentAndTools({
    agentId: body.agentId,
    orgAgentId,
    skillId: body.skillId,
    conversationId: body.conversationId,
    userId: session.user.id,
    planId: plan.id,
    thinkingEnabled: body.thinkingEnabled,
    planningEnabled: body.planningEnabled,
    maxMcpTools: settings.maxMcpTools,
  });
  if ("error" in agentResult) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return agentResult.error;
  }

  const { systemPrompt, mcpTools } = agentResult.data;
  // Update orgAgentId if it was resolved from conversation fallback
  if (agentResult.data.orgAgentId) {
    orgAgentId = agentResult.data.orgAgentId;
  }

  // ─── Resolve text model ────────────────────────────
  const textModel = await resolveModel("TEXT", plan.id);

  // ─── Load context & build messages ─────────────────
  const context = await loadChatContext({
    messages: body.messages,
    attachments: body.attachments,
    conversationId: body.conversationId,
    userId: session.user.id,
    systemPrompt,
    planId: plan.id,
    planContextWindowSize: plan.contextWindowSize,
    planTokensPerMessage: plan.tokensPerMessage,
    keepLastMessages: settings.keepLastMessages,
    userFilesContextLimit: settings.userFilesContextLimit,
    textModel,
  });

  // ─── Track usage ───────────────────────────────────
  const inputChars = body.messages.reduce(
    (sum: number, m: { content: string }) => sum + (m.content?.length || 0), 0
  );
  const estimatedTokens = Math.max(100, Math.ceil(inputChars / 3));
  await incrementUsage(session.user.id, estimatedTokens);

  // ─── Native tool context ──────────────────────────
  const nativeToolCtx: NativeToolContext = {
    userId: session.user.id,
    conversationId: body.conversationId || null,
    agentId: body.agentId || null,
    sessionUser: { name: session.user.name, email: session.user.email },
    planName: plan.name,
    planLimits: {
      maxMessagesPerDay: plan.messagesPerDay,
      maxAgents: plan.maxAgents,
      maxStorageMb: plan.maxStorageMb,
    },
  };

  // ─── Token usage callback (fire-and-forget) ────────
  const onUsage = (usage: { inputTokens: number; outputTokens: number }) => {
    const totalTokens = usage.inputTokens + usage.outputTokens;
    fireAndForget(
      retryOnce(() => incrementTokens(session.user.id, Math.max(0, totalTokens - estimatedTokens))),
      "post-stream token correction"
    );
    if (textModel) {
      fireAndForget(
        retryOnce(() => logTokenUsage({
          userId: session.user.id,
          conversationId: body.conversationId || undefined,
          provider: textModel.provider.slug,
          model: textModel.modelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costPer1kInput: textModel.costPer1kInput,
          costPer1kOutput: textModel.costPer1kOutput,
        })),
        "logTokenUsage"
      );
    }
  };

  // ─── Route by provider apiFormat ───────────────────
  const apiFormat = textModel?.provider.apiFormat ?? "OPENAI_COMPAT";

  if (apiFormat === "OPENAI_COMPAT") {
    let effectiveMaxTokens = plan.tokensPerMessage;
    if (body.thinkingEnabled && textModel?.maxThinkingTokens) {
      effectiveMaxTokens += textModel.maxThinkingTokens;
    }
    if (textModel?.maxTokens) {
      effectiveMaxTokens = Math.min(effectiveMaxTokens, textModel.maxTokens);
    }

    const stream = streamMoonshot(context.apiMessages, {
      maxTokens: effectiveMaxTokens,
      thinkingEnabled: body.thinkingEnabled,
      webSearchEnabled: true,
      mcpTools: mcpTools,
      nativeToolCtx,
      contextInfo: context.contextInfo,
      textModel,
      onUsage,
      signal: req.signal,
      mcpCallContext: { userId: session.user.id, conversationId: body.conversationId || undefined },
      settingsOverrides: {
        defaultTemperature: settings.defaultTemperature,
        defaultTopP: settings.defaultTopP,
        maxToolCallsPerRequest: settings.maxToolCallsPerRequest,
        maxRequestTokens: settings.maxRequestTokens,
        toolResultMaxChars: settings.toolResultMaxChars,
        toolResultTailChars: settings.toolResultTailChars,
      },
    });

    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        [CORRELATION_HEADER]: requestId,
      },
    });
  }

  // ─── AI SDK path (AI_SDK_OPENAI) ───────────────────
  const stream = await streamAiSdk({
    systemPrompt: context.enrichedSystemPrompt,
    messages: context.effectiveMessages,
    thinkingEnabled: body.thinkingEnabled,
    maxTokens: plan.tokensPerMessage,
    textModel,
    contextInfo: context.contextInfo,
    onUsage,
    settingsOverrides: {
      defaultTemperature: settings.defaultTemperature,
      defaultTopP: settings.defaultTopP,
    },
  });

  recordRequestDuration("/api/chat", Date.now() - _requestStart);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      [CORRELATION_HEADER]: requestId,
    },
  });
  }); // end runWithCorrelationId
}

