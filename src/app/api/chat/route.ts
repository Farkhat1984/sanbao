import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
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
import { classifySwarmRequest } from "@/lib/swarm/classify";
import { loadOrgAgentContext } from "@/lib/swarm/agent-loader";
import { consultAndSynthesize } from "@/lib/swarm/consult";

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
          { role: "system", content: "You are a context compaction assistant." },
          { role: "user", content: compactionPrompt },
        ],
        max_tokens: maxTokens,
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
    return jsonError("Unauthorized", 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return jsonError("Некорректный JSON в теле запроса", 400);
  }
  let {
    messages,
    agentId,
    skillId,
    orgAgentId,
    thinkingEnabled = true,
    webSearchEnabled: _clientWebSearch = false,
    planningEnabled = false,
    attachments = [],
    conversationId: reqConvId,
    swarmMode: rawSwarmMode = false,
    swarmOrgId: rawSwarmOrgId,
  } = body;

  // ─── Input validation ─────────────────────────────────────

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) {
    return jsonError("Некорректный массив сообщений", 400);
  }

  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (content.length > 100_000) {
      return jsonError("Сообщение превышает допустимый размер (100KB)", 400);
    }
  }

  if (attachments.length > 20) {
    return jsonError("Слишком много вложений (макс. 20)", 400);
  }

  // ─── Plan & usage checks ────────────────────────────────

  const { plan, usage, monthlyUsage } = await getUserPlanAndUsage(session.user.id);
  if (!plan) {
    return jsonError("Нет настроенного тарифа", 500);
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
      return jsonError("Слишком много запросов. Подождите минуту.", 429);
    }
    if (thinkingEnabled && !plan.canUseReasoning) {
      return jsonError("Режим рассуждений доступен на тарифе Pro и выше. Обновите подписку в настройках.", 403);
    }
  }

  // ─── Content filter ─────────────────────────────────────

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  if (lastUserMsg) {
    const filterResult = await checkContentFilter(
      typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)
    );
    if (filterResult.blocked) {
      return jsonError("Сообщение содержит запрещённый контент и не может быть отправлено.", 400);
    }
  }

  // ─── Swarm Mother mode ───────────────────────────────────
  const swarmMode = !!rawSwarmMode;
  const swarmOrgId = rawSwarmOrgId as string | undefined;
  if (swarmMode && swarmOrgId) {
    // Verify user is org member
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: swarmOrgId, userId: session.user.id } },
    });
    if (!membership) {
      return jsonError("Нет доступа к организации", 403);
    }

    // Get all PUBLISHED org agents
    const allAgents = await prisma.orgAgent.findMany({
      where: { orgId: swarmOrgId, status: "PUBLISHED" },
      select: {
        id: true, name: true, description: true, accessMode: true,
        members: { where: { userId: session.user.id }, select: { id: true } },
      },
    });

    // Filter by access
    const accessible = allAgents.filter((a) =>
      a.accessMode === "ALL_MEMBERS" ||
      membership.role === "OWNER" || membership.role === "ADMIN" ||
      a.members.length > 0
    );
    const inaccessible = allAgents.filter((a) => !accessible.includes(a));

    // Resolve text model for classify + consult
    const textModel = await resolveModel("TEXT", plan.id);
    if (!textModel) {
      return jsonError("Нет настроенной модели", 500);
    }

    // Shortcut: 0 agents → fall through to default chat
    // 1 agent → set orgAgentId and fall through to normal org agent handling
    if (accessible.length === 1) {
      orgAgentId = accessible[0].id;
    } else if (accessible.length >= 2) {
      // Classify
      const swarmLastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
      const lastUserMessage = typeof swarmLastUserMsg?.content === "string"
        ? swarmLastUserMsg.content
        : JSON.stringify(swarmLastUserMsg?.content || "");

      const classify = await classifySwarmRequest(lastUserMessage, accessible, textModel);

      if (classify.mode === "single" && classify.agentIds.length === 1) {
        // Single agent — fall through
        orgAgentId = classify.agentIds[0];
      } else if (classify.mode === "single" && classify.agentIds.length === 0) {
        // General question — fall through to default Sanbao chat (no orgAgentId set)
      } else if (classify.mode === "multi" && classify.agentIds.length > 0) {
        // Multi-agent mode: load contexts, consult, synthesize
        const agentContexts = (await Promise.all(
          classify.agentIds.map((id) => loadOrgAgentContext(id, session.user.id))
        )).filter((ctx): ctx is NonNullable<typeof ctx> => ctx !== null);

        if (agentContexts.length === 0) {
          // All agents failed to load — fall through
        } else if (agentContexts.length === 1) {
          // Only one loaded — treat as single
          orgAgentId = agentContexts[0].agentId;
        } else {
          // Get org name
          const org = await prisma.organization.findUnique({
            where: { id: swarmOrgId },
            select: { name: true },
          });

          const conversationHistory = messages
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { role: string; content: string }) => ({
              role: m.role.toLowerCase(),
              content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            }));

          const stream = consultAndSynthesize({
            userMessage: lastUserMessage,
            conversationHistory,
            agentContexts,
            orgName: org?.name || "Organization",
            inaccessibleAgents: inaccessible.map((a) => ({ name: a.name })),
            model: textModel,
            signal: req.signal,
          });

          recordRequestDuration("/api/chat", Date.now() - _requestStart);
          return new Response(stream, {
            headers: {
              "Content-Type": "application/x-ndjson",
              "Transfer-Encoding": "chunked",
              "Cache-Control": "no-cache",
              "X-Accel-Buffering": "no",
              [CORRELATION_HEADER]: requestId,
            },
          });
        }
      }
    }
    // If we didn't return, fall through to normal chat (possibly with orgAgentId set)
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
        systemPrompt += "\n\nIMPORTANT: You are a specialized agent. Do NOT create documents (<sanbao-doc>) without explicit user request. Respond with plain text. Create a document ONLY if the user explicitly asks.";
      }
    }
  }

  // ─── Load org agent MCP tools (if orgAgentId provided) ──

  // Fallback 1: resolve from existing conversation
  if (!orgAgentId && !agentId && reqConvId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: reqConvId },
      select: { orgAgentId: true },
    });
    if (conv?.orgAgentId) {
      orgAgentId = conv.orgAgentId;
    }
  }

  // Org agent is only used when explicitly selected by the client (orgAgentId)
  // or when continuing a conversation that already has an org agent (Fallback 1 above).

  if (orgAgentId && !agentId) {
    const orgAgent = await prisma.orgAgent.findUnique({
      where: { id: orgAgentId },
      include: {
        org: { select: { id: true, name: true } },
        mcpServer: {
          select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true },
        },
        skills: {
          include: {
            skill: {
              include: { tools: { include: { tool: true } } },
            },
          },
        },
        mcpServers: {
          include: {
            mcpServer: {
              select: { id: true, url: true, transport: true, apiKey: true, status: true, discoveredTools: true },
            },
          },
        },
      },
    });

    if (orgAgent) {
      // Verify user is a member of the org
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: orgAgent.orgId, userId: session.user.id } },
      });
      if (!membership) {
        return jsonError("Нет доступа к этому агенту", 403);
      }

      // Check access mode
      if (orgAgent.accessMode === "SPECIFIC" && membership.role === "MEMBER") {
        const access = await prisma.orgAgentMember.findUnique({
          where: { orgAgentId_userId: { orgAgentId: orgAgent.id, userId: session.user.id } },
        });
        if (!access) {
          return jsonError("Нет доступа к этому агенту", 403);
        }
      }

      // Add system prompt for org agent
      systemPrompt += `\n\nYou are an AI agent of organization "${orgAgent.org.name}": ${orgAgent.name}.`;
      if (orgAgent.description) {
        systemPrompt += ` ${orgAgent.description}`;
      }
      if (orgAgent.instructions) {
        systemPrompt += `\n\n${orgAgent.instructions}`;
      }
      systemPrompt += "\nUse the search tool to find information in the organization's knowledge base. Use get_source for full context of a found chunk.";
      systemPrompt += "\n\nKNOWLEDGE BASE SEARCH RULES:";
      systemPrompt += "\n- Make ONE search query per user question. Do NOT make 3-4 queries in a row — it overflows context.";
      systemPrompt += "\n- If the first query returns no results, rephrase and try ONE more. Max 2 search calls per message.";
      systemPrompt += "\n- Use get_source ONLY when you need extended context of a specific found chunk.";
      systemPrompt += "\n- Search results may contain OCR artifacts (distorted text) — interpret them by meaning.";
      systemPrompt += "\n\nWhen citing data from the knowledge base, reference the source:\n[description](source://domain/file/chunk_number)\nExample: [Chapter 3](source://ns_proj123/report.pdf/5)";
      systemPrompt += "\n\nIMPORTANT: You are a specialized organization agent. Do NOT create documents (<sanbao-doc>) without explicit user request. Respond with plain text.";

      // Load MCP tools from org agent's pipeline server
      const srv = orgAgent.mcpServer;
      if (srv && srv.status === "CONNECTED" && Array.isArray(srv.discoveredTools)) {
        const tools = srv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
        for (const tool of tools) {
          agentMcpTools.push({
            url: srv.url,
            transport: srv.transport,
            apiKey: srv.apiKey,
            mcpServerId: srv.id,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }

      // Apply skill prompts (same pattern as regular agents)
      if (orgAgent.skills && orgAgent.skills.length > 0) {
        for (const as of orgAgent.skills) {
          const skill = as.skill;
          let sp = `\n\n--- Skill: ${skill.name} ---\n${skill.systemPrompt}`;
          if (skill.citationRules) sp += `\n\nCITATION RULES:\n${skill.citationRules}`;
          if (skill.jurisdiction) sp += `\nJURISDICTION: ${skill.jurisdiction}`;
          systemPrompt += sp;
        }
      }

      // Load additional MCP servers (beyond the pipeline-generated one)
      if (orgAgent.mcpServers && orgAgent.mcpServers.length > 0) {
        for (const ams of orgAgent.mcpServers) {
          const addSrv = ams.mcpServer;
          if (addSrv.status === "CONNECTED" && Array.isArray(addSrv.discoveredTools)) {
            const addTools = addSrv.discoveredTools as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
            for (const tool of addTools) {
              if (!agentMcpTools.some((t) => t.name === tool.name)) {
                agentMcpTools.push({
                  url: addSrv.url,
                  transport: addSrv.transport as "SSE" | "STREAMABLE_HTTP",
                  apiKey: addSrv.apiKey,
                  mcpServerId: addSrv.id,
                  name: tool.name,
                  description: tool.description || "",
                  inputSchema: tool.inputSchema || {},
                });
              }
            }
          }
        }
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

    // 3. Sanitize tool name for LLM API compatibility:
    //    must start with a letter, contain only [a-zA-Z0-9_-]
    const sanitizeToolName = (name: string): string => {
      let s = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (!s || !/^[a-zA-Z]/.test(s)) s = "t_" + s;
      return s;
    };

    // 4. Deduplicate: namespace colliding tools, keep unique ones as-is
    const seen = new Set<string>();
    const deduped: McpToolContext[] = [];
    for (const tool of agentMcpTools) {
      const isCollision = (nameCount.get(tool.name) || 0) > 1;
      const rawName = isCollision
        ? `${urlNamespace(tool.url)}_${tool.name}`
        : tool.name;
      const finalName = sanitizeToolName(rawName);

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

  // Web search is always available — the model decides when to use it
  let webSearchEnabled = true;

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
        skillPrompt += `\n\nCITATION RULES:\n${skill.citationRules}`;
      }
      if (skill.jurisdiction) {
        skillPrompt += `\n\nJURISDICTION: ${skill.jurisdiction}`;
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

  // Web search prompt is always included — model decides when to search
  systemPrompt += "\n\n" + await getPrompt("prompt_mode_websearch");

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
    systemPrompt += `\n\n--- USER FILES ---\nThe user has uploaded files. Use the read_knowledge tool to search in them.\n${filesList}\n--- END FILES ---`;
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
