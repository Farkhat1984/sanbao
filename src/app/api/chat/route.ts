import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage, incrementUsage, incrementTokens } from "@/lib/usage";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import {
  estimateTokens,
  checkContextWindow,
  splitMessagesForCompaction,
  buildCompactionPrompt,
  buildSystemPromptWithContext,
} from "@/lib/context";
import { buildMemoryContext } from "@/lib/memory";
import { resolveAgentId } from "@/lib/system-agents";
import { resolveAgentContext } from "@/lib/tool-resolver";
import { resolveModel, type ResolvedModel } from "@/lib/model-router";
import { checkContentFilter } from "@/lib/content-filter";
import { logTokenUsage } from "@/lib/audit";
import { fireAndForget } from "@/lib/logger";
import { recordRequestDuration } from "@/lib/request-metrics";
import { CORRELATION_HEADER, runWithCorrelationId, generateCorrelationId } from "@/lib/correlation";
import { resolveWithExperiment } from "@/lib/ab-experiment";
import type { NativeToolContext } from "@/lib/native-tools";
import {
  DEFAULT_TEMPERATURE_COMPACTION,
  DEFAULT_MAX_TOKENS_COMPACTION,
  CONTEXT_KEEP_LAST_MESSAGES,
} from "@/lib/constants";

import { buildApiMessages, type ChatAttachment } from "@/lib/chat/message-builder";
import { streamMoonshot, type McpToolContext } from "@/lib/chat/moonshot-stream";
import { streamAiSdk } from "@/lib/chat/ai-sdk-stream";
import { getPrompt, PROMPT_REGISTRY } from "@/lib/prompts";
import { getRedis } from "@/lib/redis";

// ─── Retry helper ────────────────────────────────────────

/** Retry a function once after a short delay if the first attempt fails. */
async function retryOnce<T>(fn: () => Promise<T>, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

// ─── Background compaction ───────────────────────────────

async function compactInBackground(
  conversationId: string,
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>,
  maxTokens: number,
  userId: string,
  textModel?: ResolvedModel | null
) {
  const lockKey = `compact:${conversationId}`;
  const LOCK_TTL_SECONDS = 60;
  try {
    // Acquire Redis lock to prevent parallel compactions on the same conversation
    const redis = getRedis();
    if (redis) {
      const acquired = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");
      if (!acquired) {
        // Another compaction is already running for this conversation — skip
        return;
      }
    }

    const compactionPrompt = await buildCompactionPrompt(existingSummary, messagesToSummarize);

    const model = textModel || await resolveModel("TEXT");
    if (!model) {
      console.error("[compact] No text model resolved from DB");
      return;
    }
    const apiUrl = `${model.provider.baseUrl}/chat/completions`;
    const apiKey = model.provider.apiKey;
    const modelId = model.modelId;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "Ты — ассистент для сжатия контекста разговора." },
          { role: "user", content: compactionPrompt },
        ],
        max_tokens: Math.min(maxTokens, DEFAULT_MAX_TOKENS_COMPACTION),
        temperature: DEFAULT_TEMPERATURE_COMPACTION,
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error(`[compaction] API error ${response.status} for conversation ${conversationId}`);
      return;
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content;

    if (summaryText) {
      await prisma.conversationSummary.upsert({
        where: { conversationId },
        create: {
          conversationId,
          content: summaryText,
          tokenEstimate: estimateTokens(summaryText),
          messagesCovered: messagesToSummarize.length,
          version: 1,
        },
        update: {
          content: summaryText,
          tokenEstimate: estimateTokens(summaryText),
          messagesCovered: { increment: messagesToSummarize.length },
          version: { increment: 1 },
        },
      });

      const compactionTokens = estimateTokens(compactionPrompt) + estimateTokens(summaryText);
      await incrementTokens(userId, compactionTokens);
    }
  } catch (err) {
    console.error("[compaction] Failed for conversation", conversationId, err instanceof Error ? err.message : err);
  } finally {
    // Release compaction lock so the conversation can be compacted again
    try {
      const redis = getRedis();
      if (redis) await redis.del(lockKey);
    } catch { /* ignore cleanup errors */ }
  }
}

// ─── Main handler ────────────────────────────────────────

export async function POST(req: Request) {
  const requestId = req.headers.get(CORRELATION_HEADER) || generateCorrelationId();

  return runWithCorrelationId(requestId, async () => {
  const _requestStart = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return NextResponse.json({ error: "Некорректный JSON в теле запроса" }, { status: 400 });
  }
  const {
    messages,
    agentId,
    skillId,
    thinkingEnabled = true,
    webSearchEnabled = false,
    planningEnabled = false,
    attachments = [],
    conversationId: reqConvId,
  } = body;

  // ─── Input validation ─────────────────────────────────────

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) {
    return NextResponse.json({ error: "Некорректный массив сообщений" }, { status: 400 });
  }

  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (content.length > 100_000) {
      return NextResponse.json({ error: "Сообщение превышает допустимый размер (100KB)" }, { status: 400 });
    }
  }

  if (attachments.length > 20) {
    return NextResponse.json({ error: "Слишком много вложений (макс. 20)" }, { status: 400 });
  }

  // ─── Plan & usage checks ────────────────────────────────

  const { plan, usage, monthlyUsage } = await getUserPlanAndUsage(session.user.id);
  if (!plan) {
    return NextResponse.json({ error: "Нет настроенного тарифа" }, { status: 500 });
  }

  const isAdmin = session.user.role === "ADMIN";

  if (!isAdmin) {
    if (plan.messagesPerDay > 0 && (usage?.messageCount ?? 0) >= plan.messagesPerDay) {
      return NextResponse.json(
        { error: `Достигнут дневной лимит сообщений (${plan.messagesPerDay}). Перейдите на более объёмный тариф для увеличения лимита.`, limit: plan.messagesPerDay },
        { status: 429 }
      );
    }
    if (plan.tokensPerMonth > 0 && monthlyUsage.tokenCount >= plan.tokensPerMonth) {
      return NextResponse.json(
        { error: "Достигнут месячный лимит токенов. Перейдите на более объёмный тариф для продолжения работы.", limit: plan.tokensPerMonth },
        { status: 429 }
      );
    }
    if (!(await checkMinuteRateLimit(session.user.id, plan.requestsPerMinute))) {
      return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
    }
    if (thinkingEnabled && !plan.canUseReasoning) {
      return NextResponse.json(
        { error: "Режим рассуждений доступен на тарифе Pro и выше. Обновите подписку в настройках." },
        { status: 403 }
      );
    }
    if (webSearchEnabled && !plan.canUseAdvancedTools) {
      return NextResponse.json(
        { error: "Веб-поиск доступен на тарифе Pro и выше. Обновите подписку в настройках." },
        { status: 403 }
      );
    }
  }

  // ─── Content filter ─────────────────────────────────────

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  if (lastUserMsg) {
    const filterResult = await checkContentFilter(
      typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)
    );
    if (filterResult.blocked) {
      return NextResponse.json(
        { error: "Сообщение содержит запрещённый контент и не может быть отправлено." },
        { status: 400 }
      );
    }
  }

  // ─── Build system prompt & resolve agent context ────────

  // Load admin-editable system prompt from DB (cached 60s)
  let systemPrompt = await getPrompt("prompt_system_global");
  const agentMcpTools: McpToolContext[] = [];

  if (agentId) {
    const resolvedId = resolveAgentId(agentId);
    const ctx = await resolveAgentContext(resolvedId);
    if (ctx.systemPrompt) {
      systemPrompt = ctx.systemPrompt + "\n\n" + PROMPT_REGISTRY.prompt_system_global + ctx.skillPrompts.join("");
      agentMcpTools.push(...ctx.mcpTools);
      // Custom (non-system) agents: suppress artifact creation unless explicitly requested
      if (!ctx.isSystem) {
        systemPrompt += "\n\n⚠ ДОПОЛНИТЕЛЬНОЕ ПРАВИЛО ДЛЯ ЭТОГО АГЕНТА: Ты работаешь как специализированный агент. НЕ создавай документы (<sanbao-doc>) без явной просьбы пользователя. Отвечай обычным текстом. Создавай документ ТОЛЬКО если пользователь прямо попросил: «создай», «составь», «оформи», «подготовь документ».";
      }
    }
  }

  // ─── Load user-enabled global MCP servers ───────────────

  const userGlobalMcps = await prisma.userMcpServer.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      mcpServer: {
        select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true, isGlobal: true, isEnabled: true },
      },
    },
  });
  for (const link of userGlobalMcps) {
    const srv = link.mcpServer;
    if (!srv.isGlobal || !srv.isEnabled || srv.status !== "CONNECTED" || !Array.isArray(srv.discoveredTools)) continue;
    const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    for (const tool of tools) {
      if (!agentMcpTools.some((t) => t.name === tool.name)) {
        agentMcpTools.push({
          url: srv.url,
          transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
          apiKey: srv.apiKey,
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          mcpServerId: srv.id,
        });
      }
    }
  }

  // Also load user's own connected MCP servers
  const userOwnMcps = await prisma.mcpServer.findMany({
    where: { userId: session.user.id, status: "CONNECTED", isGlobal: false },
    select: { id: true, url: true, transport: true, apiKey: true, discoveredTools: true },
  });
  for (const srv of userOwnMcps) {
    if (!Array.isArray(srv.discoveredTools)) continue;
    const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    for (const tool of tools) {
      if (!agentMcpTools.some((t) => t.name === tool.name)) {
        agentMcpTools.push({
          url: srv.url,
          transport: srv.transport as "SSE" | "STREAMABLE_HTTP",
          apiKey: srv.apiKey,
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          mcpServerId: srv.id,
        });
      }
    }
  }

  // Deduplicate MCP tools by name (API rejects duplicate function names).
  // When multiple MCP servers expose tools with the same name (e.g. "search"),
  // prefix them with a namespace derived from the URL path so the AI can call each one.
  {
    // 1. Detect which names collide
    const nameCount = new Map<string, number>();
    for (const tool of agentMcpTools) {
      nameCount.set(tool.name, (nameCount.get(tool.name) || 0) + 1);
    }

    // 2. Build namespace prefix from MCP server URL path (e.g. "/accountant" → "accountant")
    const urlNamespace = (url: string): string => {
      try {
        const path = new URL(url).pathname;
        const segment = path.split("/").filter(Boolean).pop() || "mcp";
        return segment.replace(/[^a-zA-Z0-9_]/g, "_");
      } catch {
        return "mcp";
      }
    };

    // 3. Deduplicate: namespace colliding tools, keep unique ones as-is
    const seen = new Set<string>();
    const deduped: McpToolContext[] = [];
    for (const tool of agentMcpTools) {
      const isCollision = (nameCount.get(tool.name) || 0) > 1;
      const finalName = isCollision
        ? `${urlNamespace(tool.url)}_${tool.name}`
        : tool.name;

      if (!seen.has(finalName)) {
        seen.add(finalName);
        deduped.push({
          ...tool,
          originalName: tool.name,
          name: finalName,
        });
      }
    }
    agentMcpTools.length = 0;
    agentMcpTools.push(...deduped);
  }

  // Cap MCP tools to prevent unbounded growth
  const MAX_MCP_TOOLS = 100;
  if (agentMcpTools.length > MAX_MCP_TOOLS) {
    agentMcpTools.length = MAX_MCP_TOOLS;
  }

  // ─── Load skill ─────────────────────────────────────────

  if (skillId) {
    const skill = await prisma.skill.findFirst({
      where: {
        id: skillId,
        OR: [{ isBuiltIn: true }, { userId: session.user.id }, { isPublic: true }],
      },
    });
    if (skill) {
      let skillPrompt = skill.systemPrompt;
      if (skill.citationRules) {
        skillPrompt += `\n\nПРАВИЛА ЦИТИРОВАНИЯ:\n${skill.citationRules}`;
      }
      if (skill.jurisdiction) {
        skillPrompt += `\n\nЮРИСДИКЦИЯ: ${skill.jurisdiction}`;
      }
      systemPrompt = `${skillPrompt}\n\n${systemPrompt}`;
    }
  }

  // A/B experiment: prepend experiment text to system prompt (never fully replace)
  {
    const ab = await resolveWithExperiment("prompt_system_global", systemPrompt, session.user.id);
    if (ab.experimentId && ab.value && ab.value !== systemPrompt) {
      systemPrompt = `${ab.value}\n\n${systemPrompt}`;
    }
  }

  if (planningEnabled) {
    systemPrompt += "\n\n" + await getPrompt("prompt_mode_planning");
  }

  if (webSearchEnabled) {
    systemPrompt += "\n\n" + await getPrompt("prompt_mode_websearch");
  }

  if (thinkingEnabled) {
    systemPrompt += "\n\n" + await getPrompt("prompt_mode_thinking");
  }

  // ─── Load context from DB ───────────────────────────────

  let existingSummary: string | null = null;
  let planMemory: string | null = null;
  let userMemoryContext: string | null = null;

  const [contextData, userMemories, activeTasks, userFiles] = await Promise.all([
    reqConvId
      ? Promise.all([
          prisma.conversationSummary.findUnique({ where: { conversationId: reqConvId } }),
          prisma.conversationPlan.findFirst({
            where: { conversationId: reqConvId, isActive: true },
            orderBy: { createdAt: "desc" },
          }),
        ])
      : Promise.resolve([null, null]),
    prisma.userMemory.findMany({
      where: { userId: session.user.id },
      select: { key: true, content: true },
    }),
    reqConvId
      ? prisma.task.findMany({
          where: { conversationId: reqConvId, status: "IN_PROGRESS" },
          select: { title: true, steps: true, progress: true },
        })
      : Promise.resolve([]),
    prisma.userFile.findMany({
      where: { userId: session.user.id },
      select: { name: true, description: true, fileType: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  if (reqConvId) {
    const [summary, activePlan] = contextData as [
      { content: string } | null,
      { memory: string | null } | null,
    ];
    if (summary) existingSummary = summary.content;
    if (activePlan?.memory) planMemory = activePlan.memory;
  }

  if (userMemories.length > 0) {
    userMemoryContext = buildMemoryContext(userMemories);
  }

  let tasksContext: string | null = null;
  if (activeTasks.length > 0) {
    tasksContext = activeTasks.map((t) => {
      const steps = t.steps as Array<{ text: string; done: boolean }>;
      const done = steps.filter((s) => s.done).map((s) => `  \u2713 ${s.text}`);
      const pending = steps.filter((s) => !s.done).map((s) => `  \u25CB ${s.text}`);
      return `**${t.title}** (${t.progress}%)\n${done.join("\n")}\n${pending.join("\n")}`;
    }).join("\n\n");
  }

  // ─── Inject user files list into system prompt ──────────

  if (userFiles.length > 0) {
    const filesList = userFiles
      .map((f) => `- ${f.name}${f.description ? ` — ${f.description}` : ""} (${f.fileType})`)
      .join("\n");
    systemPrompt += `\n\n--- ФАЙЛЫ ПОЛЬЗОВАТЕЛЯ ---\nУ пользователя есть загруженные файлы. Используй инструмент read_knowledge для поиска в них.\n${filesList}\n--- КОНЕЦ ФАЙЛОВ ---`;
  }

  // ─── Resolve text model (needed for context window + max tokens) ──

  const textModel = await resolveModel("TEXT", plan.id);

  // ─── Autocompact ────────────────────────────────────────

  const systemTokens = estimateTokens(systemPrompt);
  const effectiveContextWindow = Math.min(plan.contextWindowSize, textModel?.contextWindow ?? Infinity);
  const contextCheck = checkContextWindow(messages, systemTokens, effectiveContextWindow);

  let effectiveMessages = messages;
  let isCompacting = false;

  if (contextCheck.needsCompaction) {
    const { messagesToSummarize, messagesToKeep } = splitMessagesForCompaction(
      messages,
      CONTEXT_KEEP_LAST_MESSAGES
    );
    if (messagesToSummarize.length > 0) {
      effectiveMessages = messagesToKeep;
      isCompacting = true;
      if (reqConvId) {
        compactInBackground(reqConvId, existingSummary, messagesToSummarize, plan.tokensPerMessage, session.user.id, textModel);
      }
    }
  }

  // ─── Build enriched system prompt & API messages ────────

  const enrichedSystemPrompt = buildSystemPromptWithContext(
    systemPrompt, existingSummary, planMemory, userMemoryContext, tasksContext
  );

  const apiMessages = buildApiMessages(effectiveMessages, attachments as ChatAttachment[], enrichedSystemPrompt);

  const contextInfo = {
    usagePercent: Math.round(contextCheck.usagePercent * 100),
    totalTokens: contextCheck.totalTokens,
    contextWindowSize: contextCheck.contextWindowSize,
    compacting: isCompacting,
  };

  // Track usage
  const inputChars = messages.reduce(
    (sum: number, m: { content: string }) => sum + (m.content?.length || 0), 0
  );
  const estimatedTokens = Math.max(100, Math.ceil(inputChars / 3));
  await incrementUsage(session.user.id, estimatedTokens);

  // ─── Native tool context ────────────────────────────────

  const nativeToolCtx: NativeToolContext = {
    userId: session.user.id,
    conversationId: reqConvId || null,
    agentId: agentId || null,
    sessionUser: { name: session.user.name, email: session.user.email },
    planName: plan.name,
    planLimits: {
      maxMessagesPerDay: plan.messagesPerDay,
      maxAgents: plan.maxAgents,
      maxStorageMb: plan.maxStorageMb,
    },
  };

  // ─── Token usage callback (fire-and-forget) ─────────────

  const onUsage = (usage: { inputTokens: number; outputTokens: number }) => {
    const totalTokens = usage.inputTokens + usage.outputTokens;
    // Correct DailyUsage with real tokens (subtract initial estimate).
    // Retry once after 500ms if the DB write fails (transient connection issues).
    fireAndForget(
      retryOnce(() => incrementTokens(session.user.id, Math.max(0, totalTokens - estimatedTokens))),
      "post-stream token correction"
    );
    // Record to TokenLog for analytics (with retry)
    if (textModel) {
      fireAndForget(
        retryOnce(() => logTokenUsage({
          userId: session.user.id,
          conversationId: reqConvId || undefined,
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

  // ─── Route by provider apiFormat ─────────────────────────

  const apiFormat = textModel?.provider.apiFormat ?? "OPENAI_COMPAT";

  if (apiFormat === "OPENAI_COMPAT") {
    // OpenAI-compatible SSE streaming (Moonshot/Kimi, DeepInfra, etc.)
    // Kimi K2.5: thinking + content share the same max_tokens budget.
    // Base = plan content budget; add thinking budget when enabled.
    let effectiveMaxTokens = plan.tokensPerMessage;
    if (thinkingEnabled && textModel?.maxThinkingTokens) {
      effectiveMaxTokens += textModel.maxThinkingTokens;
    }
    // Cap at model's actual max output capability
    if (textModel?.maxTokens) {
      effectiveMaxTokens = Math.min(effectiveMaxTokens, textModel.maxTokens);
    }

    const stream = streamMoonshot(apiMessages, {
      maxTokens: effectiveMaxTokens,
      thinkingEnabled,
      webSearchEnabled,
      mcpTools: agentMcpTools,
      nativeToolCtx,
      contextInfo,
      textModel,
      onUsage,
      signal: req.signal,
      mcpCallContext: { userId: session.user.id, conversationId: reqConvId || undefined },
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

  // ─── AI SDK path (AI_SDK_OPENAI) ─────────────────────────

  // AI SDK path: maxTokens = plan content budget (no thinking budget needed here,
  // AI SDK handles thinking budget internally via provider options)
  const stream = streamAiSdk({
    systemPrompt: enrichedSystemPrompt,
    messages: effectiveMessages,
    thinkingEnabled,
    maxTokens: plan.tokensPerMessage,
    textModel,
    contextInfo,
    onUsage,
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
