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
import { recordRequestDuration } from "@/lib/request-metrics";
import { resolveWithExperiment } from "@/lib/ab-experiment";
import type { NativeToolContext } from "@/lib/native-tools";
import {
  MOONSHOT_CHAT_URL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEMPERATURE_COMPACTION,
  DEFAULT_MAX_TOKENS_COMPACTION,
  DEFAULT_PROVIDER,
  CONTEXT_KEEP_LAST_MESSAGES,
} from "@/lib/constants";

import { buildApiMessages, type ChatAttachment } from "@/lib/chat/message-builder";
import { streamMoonshot, type McpToolContext } from "@/lib/chat/moonshot-stream";
import { streamAiSdk } from "@/lib/chat/ai-sdk-stream";

const SYSTEM_PROMPT = `Ты — Sanbao, AI ERP-платформа нового поколения для профессионалов. Ты объединяешь мощь нескольких AI-моделей, гибкую систему агентов, инструменты (Tools), скиллы (Skills), плагины (Plugins) и MCP-серверы в единую интеллектуальную среду. Твоя задача — помогать пользователям эффективно решать любые профессиональные задачи: создание документов, анализ данных, написание кода, автоматизация процессов, юридическая работа и многое другое.

АРХИТЕКТУРА ПЛАТФОРМЫ:
Sanbao — модульная AI-система с многоуровневой архитектурой:
- **Агенты** — специализированные AI-персоны с уникальными инструкциями, инструментами и знаниями. У каждого агента свой системный промпт, набор скиллов, инструментов, плагинов и MCP-серверов. Агенты могут иметь файлы знаний для расширения контекста.
- **Инструменты (Tools)** — шаблоны и действия (PROMPT_TEMPLATE, WEBHOOK, URL, FUNCTION). Инструменты автоматизируют типовые операции: генерация документов, вызов API, заполнение шаблонов.
- **Скиллы (Skills)** — специализированные поведенческие модули, внедряющие дополнительные системные инструкции, правила цитирования и юрисдикцию.
- **Плагины (Plugins)** — пакеты, объединяющие инструменты, скиллы и MCP-серверы в готовые решения для конкретных областей.
- **MCP-серверы** — внешние серверы по протоколу Model Context Protocol, расширяющие возможности агента: базы данных, API, файловые системы, специализированные сервисы.
- **Память** — пользовательские предпочтения и стандарты, сохраняемые между сессиями. Система автоматической компактизации контекста с созданием резюме длинных диалогов.
- **Биллинг и планы** — тарифные планы с лимитами на сообщения, агентов, хранилище.

Отвечай точно, профессионально и структурировано. Адаптируй тон под контекст: формальный для юридических и деловых задач, практичный для технических. Когда контекст агента включает специализированные скиллы или инструменты — опирайся на них в первую очередь.

СОЗДАНИЕ ДОКУМЕНТОВ И АРТЕФАКТОВ:
Когда создаёшь объёмный контент (документ, код, анализ), оберни его в тег:
<sanbao-doc type="ТИП" title="Название">
Содержимое в Markdown
</sanbao-doc>
Типы: DOCUMENT, CODE, ANALYSIS.
Используй структурированный Markdown: заголовки, списки, таблицы, **жирный** для ключевых терминов.
НЕ используй для коротких ответов или фрагментов кода менее 10 строк.

СОЗДАНИЕ КОДА:
- Игры, анимации, визуализации — ТОЛЬКО HTML5 Canvas + JavaScript/React (работает в браузере).
- Python (вычисления, данные) — через Pyodide в браузере.
- Код оборачивай в <sanbao-doc type="CODE" title="...">.

РЕДАКТИРОВАНИЕ ДОКУМЕНТОВ:
Для изменения ранее созданного документа используй точечные замены:
<sanbao-edit target="Точное название">
<replace>
<old>точный фрагмент</old>
<new>новый текст</new>
</replace>
</sanbao-edit>
Можно указать несколько блоков <replace>. Используй ТОЛЬКО для уже созданных в этом чате документов.

РЕЖИМ ПЛАНИРОВАНИЯ:
<sanbao-plan> — ТОЛЬКО когда пользователь включил режим планирования через интерфейс (ты получишь отдельную инструкцию).
НЕ генерируй самостоятельно. Если просят "составь план" или "распиши стратегию" — создавай через <sanbao-doc>.
Формат:
<sanbao-plan>
## План
1. Шаг — описание
</sanbao-plan>
После плана — сразу приступай к выполнению.

ЗАДАЧИ:
Создавай чек-лист ТОЛЬКО по явной просьбе пользователя ("сделай чек-лист", "составь to-do").
<sanbao-task title="Название">
- [ ] Шаг
</sanbao-task>

УТОЧНЯЮЩИЕ ВОПРОСЫ:
Перед созданием сложного документа без достаточных деталей — задай уточняющие вопросы:
<sanbao-clarify>
[
  {"id": "1", "question": "Вопрос?", "options": ["Вариант 1", "Вариант 2"]},
  {"id": "2", "question": "Вопрос?", "type": "text", "placeholder": "Укажите..."}
]
</sanbao-clarify>
2-5 вопросов с уникальным id. Тег в конце сообщения. После ответов — сразу создавай документ.

ССЫЛКИ НА СТАТЬИ ЗАКОНОВ:
Когда ссылаешься на статью закона, используй формат markdown-ссылки:
[ст. {номер} {код}](article://{code_name}/{номер})
Примеры:
- [ст. 188 УК РК](article://criminal_code/188) — Уголовный кодекс
- [ст. 15 ГК РК](article://civil_code/15) — Гражданский кодекс
- [ст. 73 КоАП РК](article://administrative_code/73) — Кодекс об административных правонарушениях
- [ст. 152 НК РК](article://tax_code/152) — Налоговый кодекс
- [ст. 87 ТК РК](article://labor_code/87) — Трудовой кодекс
- [ст. 44 ЗК РК](article://land_code/44) — Земельный кодекс
- [ст. 120 ЭК РК](article://environmental_code/120) — Экологический кодекс
- [ст. 30 ПК РК](article://business_code/30) — Предпринимательский кодекс
- [ст. 55 ГПК РК](article://civil_procedure_code/55) — Гражданский процессуальный кодекс
- [ст. 68 УПК РК](article://criminal_procedure_code/68) — Уголовно-процессуальный кодекс
Пользователь сможет кликнуть на ссылку и увидеть полный текст статьи. Всегда используй этот формат при упоминании конкретных статей.

ПРАВИЛО ОДНОГО ДЕЙСТВИЯ:
В каждом ответе — МАКСИМУМ ОДИН специальный тег: <sanbao-clarify>, <sanbao-plan>, <sanbao-task> или <sanbao-doc>/<sanbao-edit>. Не комбинируй.`;

// ─── Background compaction ───────────────────────────────

const MOONSHOT_URL_FALLBACK = MOONSHOT_CHAT_URL;

async function compactInBackground(
  conversationId: string,
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>,
  maxTokens: number,
  userId: string,
  textModel?: ResolvedModel | null
) {
  try {
    const compactionPrompt = buildCompactionPrompt(existingSummary, messagesToSummarize);

    const model = textModel || await resolveModel("TEXT");
    const apiUrl = model
      ? `${model.provider.baseUrl}/chat/completions`
      : MOONSHOT_URL_FALLBACK;
    const apiKey = model?.provider.apiKey || process.env.MOONSHOT_API_KEY || "";
    const modelId = model?.modelId || DEFAULT_TEXT_MODEL;

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

    if (response.ok) {
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
    }
  } catch {
    console.error("Compaction failed silently");
  }
}

// ─── Main handler ────────────────────────────────────────

export async function POST(req: Request) {
  const _requestStart = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    provider = DEFAULT_PROVIDER,
    agentId,
    skillId,
    thinkingEnabled = true,
    webSearchEnabled = false,
    planningEnabled = false,
    attachments = [],
    conversationId: reqConvId,
  } = await req.json();

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
    if (!checkMinuteRateLimit(session.user.id, plan.requestsPerMinute)) {
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

  let systemPrompt = SYSTEM_PROMPT;
  let effectiveProvider = provider;
  const agentMcpTools: McpToolContext[] = [];

  if (agentId) {
    const resolvedId = resolveAgentId(agentId);
    const ctx = await resolveAgentContext(resolvedId);
    if (ctx.systemPrompt) {
      systemPrompt = ctx.systemPrompt + "\n\n" + SYSTEM_PROMPT + ctx.skillPrompts.join("");
      agentMcpTools.push(...ctx.mcpTools);
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
        });
      }
    }
  }

  // Also load user's own connected MCP servers
  const userOwnMcps = await prisma.mcpServer.findMany({
    where: { userId: session.user.id, status: "CONNECTED", isGlobal: false },
    select: { url: true, transport: true, apiKey: true, discoveredTools: true },
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
        });
      }
    }
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

  // A/B experiment: allow overriding global system prompt
  {
    const ab = await resolveWithExperiment("global_system_prompt", systemPrompt, session.user.id);
    if (ab.experimentId) {
      systemPrompt = ab.value;
    }
  }

  if (planningEnabled) {
    systemPrompt +=
      "\n\nВАЖНО: Пользователь включил режим планирования. ОБЯЗАТЕЛЬНО начни ответ с подробного плана в теге <sanbao-plan>. Распиши все шаги, подзадачи и порядок действий. Это критически важно — пользователь ожидает структурированный план ПЕРЕД основным ответом.";
  }

  if (webSearchEnabled) {
    systemPrompt +=
      "\n\nУ тебя есть доступ к веб-поиску. Используй его когда нужно найти актуальную информацию, последние изменения в законодательстве, судебную практику или новости.\n\nВАЖНО: Когда используешь веб-поиск, ОБЯЗАТЕЛЬНО в конце ответа добавь раздел «Источники:» со списком URL-ссылок откуда была взята информация. Формат:\n\nИсточники:\n- [Название](URL)\n- [Название](URL)";
  }

  // ─── Load context from DB ───────────────────────────────

  let existingSummary: string | null = null;
  let planMemory: string | null = null;
  let userMemoryContext: string | null = null;

  const [contextData, userMemories, activeTasks] = await Promise.all([
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

  // ─── Autocompact ────────────────────────────────────────

  const systemTokens = estimateTokens(systemPrompt);
  const contextCheck = checkContextWindow(messages, systemTokens, plan.contextWindowSize);

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
        const compactModel = await resolveModel("TEXT", plan.id);
        compactInBackground(reqConvId, existingSummary, messagesToSummarize, plan.tokensPerMessage, session.user.id, compactModel);
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

  // ─── Resolve text model ─────────────────────────────────

  const textModel = await resolveModel("TEXT", plan.id);

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

  // ─── Moonshot-compatible providers (custom SSE streaming) ─

  if (effectiveProvider === "deepinfra") {
    const stream = streamMoonshot(apiMessages, {
      maxTokens: plan.tokensPerMessage,
      thinkingEnabled,
      webSearchEnabled,
      mcpTools: agentMcpTools,
      nativeToolCtx,
      contextInfo,
      textModel,
    });

    recordRequestDuration("/api/chat", Date.now() - _requestStart);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  // ─── Other providers (OpenAI, Anthropic via AI SDK) ─────

  const stream = streamAiSdk({
    provider: effectiveProvider,
    canUseProvider: plan.canChooseProvider || effectiveProvider === "openai",
    systemPrompt: enrichedSystemPrompt,
    messages: effectiveMessages,
    thinkingEnabled,
    maxTokens: plan.tokensPerMessage,
    contextInfo,
  });

  recordRequestDuration("/api/chat", Date.now() - _requestStart);
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
