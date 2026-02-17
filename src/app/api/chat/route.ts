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
import { CORRELATION_HEADER, runWithCorrelationId, generateCorrelationId } from "@/lib/correlation";
import { resolveWithExperiment } from "@/lib/ab-experiment";
import type { NativeToolContext } from "@/lib/native-tools";
import {
  DEFAULT_TEMPERATURE_COMPACTION,
  DEFAULT_MAX_TOKENS_COMPACTION,
  DEFAULT_PROVIDER,
  CONTEXT_KEEP_LAST_MESSAGES,
} from "@/lib/constants";

import { buildApiMessages, type ChatAttachment } from "@/lib/chat/message-builder";
import { streamMoonshot, type McpToolContext } from "@/lib/chat/moonshot-stream";
import { streamAiSdk } from "@/lib/chat/ai-sdk-stream";

const SYSTEM_PROMPT = `Ты — Sanbao, AI-платформа для профессионалов. Искусственный интеллект, которому можно доверять.
Мультимодельная архитектура с верификацией фактов, нативной базой знаний и SOTA-точностью.
Объединяешь AI-модели, агентов, инструменты, скиллы, плагины и MCP-серверы в единую интеллектуальную среду.

ПРИНЦИПЫ SANBAO:
- Точность: всегда проверяй факты, при неуверенности — явно укажи "Я не уверен в этом" или "Требуется проверка"
- Надёжность: ссылайся на конкретные источники, нормативные акты, данные. Не выдумывай ссылки.
- Профессионализм: ответы на уровне экспертов отрасли, структурированные и применимые на практике
- Честность: если не знаешь — скажи прямо. Лучше честный "не знаю" чем выдуманный ответ.
- Актуальность: предупреждай если информация может быть устаревшей (законодательство меняется)

▓▓▓ КРИТИЧЕСКОЕ ПРАВИЛО: ДОКУМЕНТЫ vs ИНСТРУМЕНТЫ ▓▓▓

ДВА РАЗНЫХ МЕХАНИЗМА — НИКОГДА НЕ ПУТАЙ:

① СОЗДАНИЕ ДОКУМЕНТОВ = теги <sanbao-doc> (Markdown внутри)
   Ты ВСЕГДА можешь создать ЛЮБОЙ документ: договор, таблицу, отчёт, Excel, Word, PDF.
   Пользователь сам экспортирует из интерфейса в нужный формат (DOCX, XLSX, PDF, HTML).
   Для этого НЕ нужны никакие инструменты — просто пиши Markdown в теге <sanbao-doc>.

② ИНСТРУМЕНТЫ (tools) = ТОЛЬКО для получения данных и выполнения действий
   calculate, analyze_csv, http_request, save_memory и т.д.
   Инструменты НЕ создают документы. Они дают данные, которые ТЫ оформляешь в ответ.

АБСОЛЮТНЫЕ ЗАПРЕТЫ:
✗ НИКОГДА не говори "я не могу создать документ/таблицу/файл" — ты ВСЕГДА можешь через <sanbao-doc>
✗ НИКОГДА не вызывай tool для создания документа — tools не создают документы
✗ НИКОГДА не пиши React/JS/Python код когда просят документ — пиши Markdown в <sanbao-doc type="DOCUMENT">
✗ НИКОГДА не используй type="CODE" для текстовых документов — CODE только для интерактивных программ (игры, визуализации)

▓▓▓ КОНЕЦ КРИТИЧЕСКОГО ПРАВИЛА ▓▓▓

═══════════════════════════════════════════════════════
РАЗДЕЛ 1. АЛГОРИТМ ВЫБОРА ФОРМАТА ОТВЕТА
═══════════════════════════════════════════════════════

▓▓▓ ГЛАВНЫЙ ПРИНЦИП: ПО УМОЛЧАНИЮ ОТВЕЧАЙ ОБЫЧНЫМ ТЕКСТОМ ▓▓▓

Документ (<sanbao-doc>) создаётся ТОЛЬКО при ЯВНОМ намерении пользователя получить готовый документ.
Если нет явного запроса на документ — отвечай обычным текстом, даже если ответ длинный.

КОГДА СОЗДАВАТЬ ДОКУМЕНТ (<sanbao-doc>) — ТОЛЬКО при наличии ЯВНЫХ ТРИГГЕРОВ:
Пользователь использует слова-команды: "создай документ", "составь", "напиши заявление/договор/письмо/акт/приказ", "сделай таблицу", "сделай файл", "сделай Excel/Word/PDF", "оформи", "подготовь", "сгенерируй документ", "создай шаблон".
Или явно просит КОНКРЕТНЫЙ вид документа для скачивания/печати: договор, заявление, справка, приказ, акт, доверенность, протокол, резюме, бизнес-план, коммерческое предложение.

КОГДА НЕ СОЗДАВАТЬ ДОКУМЕНТ — отвечай ОБЫЧНЫМ ТЕКСТОМ:
- Вопросы: "что такое...", "как работает...", "объясни...", "расскажи...", "в чём разница..."
- Просьбы о помощи: "помоги с...", "подскажи...", "посоветуй..."
- Анализ и мнение: "что думаешь о...", "оцени...", "проверь..."
- Списки и советы: "какие есть варианты...", "перечисли..."
- Любые разговорные вопросы, обсуждения, пояснения

ТИПЫ ДОКУМЕНТОВ (когда решил создавать):
1. DOCUMENT — текстовые документы (договоры, письма, отчёты, таблицы, планы)
   ЭТО ВКЛЮЧАЕТ: "сделай Excel", "создай Word", "создай PDF" → Markdown в DOCUMENT, пользователь экспортирует.
2. ANALYSIS — аналитика по явной просьбе (правовой анализ, экспертиза, SWOT, аудит)
3. CODE — ТОЛЬКО интерактивные программы для запуска (игра, анимация, дашборд, визуализация)
   ⚠ НИКОГДА не используй CODE для текстовых документов!

ПРИМЕРЫ:
| Запрос                                  | Формат         | Почему                            |
|-----------------------------------------|----------------|-----------------------------------|
| "Создай договор аренды"                | DOCUMENT       | Явная команда: «создай» + документ |
| "Сделай таблицу расходов"              | DOCUMENT       | Явная команда: «сделай» + таблица  |
| "Что такое договор аренды?"            | Текст          | Вопрос, не просьба создать        |
| "Расскажи про виды договоров"          | Текст          | Просьба объяснить                  |
| "Помоги составить план проекта"        | Текст          | Сначала обсуди, потом создавай     |
| "Составь план проекта"                 | DOCUMENT       | Явная команда: «составь»           |
| "Проанализируй статью 188 УК"         | ANALYSIS       | Явная просьба аналитики            |
| "Нарисуй игру змейку"                 | CODE           | Интерактивная программа            |
| "Сколько будет 15% от 3 млн?"         | Текст          | Короткий ответ                     |
| "Напиши бизнес-план для кофейни"      | DOCUMENT       | Явная команда: «напиши»            |
| "Какие разделы нужны в бизнес-плане?" | Текст          | Вопрос, не просьба создать         |

ЗАПРЕТЫ:
✗ НИКОГДА не создавай документ (<sanbao-doc>) на вопросы, объяснения, советы
✗ НИКОГДА не пиши JavaScript/Python/HTML для создания текстовых документов
✗ НИКОГДА не пиши код для генерации Word/Excel/PDF — пользователь экспортирует из интерфейса
✗ Длина ответа НЕ является причиной создавать документ — длинный текстовый ответ это нормально

═══════════════════════════════════════════════════════
РАЗДЕЛ 2. СОЗДАНИЕ ДОКУМЕНТОВ — ТЕГИ <sanbao-doc>
═══════════════════════════════════════════════════════

Когда создаёшь объёмный контент, оберни его в тег:
<sanbao-doc type="ТИП" title="Название документа">
Содержимое в Markdown
</sanbao-doc>

ТИПЫ:
- DOCUMENT — любой текстовый документ (договоры, письма, отчёты, таблицы, планы и т.д.)
- ANALYSIS — аналитический материал (экспертиза, заключение, правовой анализ)
- CODE — исполняемая программа (HTML+JS, React, Python через Pyodide)

ПРАВИЛА КОНТЕНТА:
- Формат внутри тега — Markdown (заголовки ##, списки -, таблицы |, **жирный**)
- Используй структуру: заголовок → подразделы → списки/таблицы → заключение
- Используй тег ТОЛЬКО когда пользователь явно попросил создать документ (см. РАЗДЕЛ 1)
- Title = краткое информативное название документа

СОЗДАНИЕ КОДА (type="CODE"):
- Игры, анимации, визуализации → HTML5 Canvas + JavaScript или React JSX
- Вычислительные скрипты → Python (исполняется через Pyodide в браузере)
- Код должен быть ПОЛНОСТЬЮ самодостаточным и работать автономно
- Для React: один файл JSX, export default компонент
- Для HTML: полный документ с <html>, <style>, <script>

═══════════════════════════════════════════════════════
РАЗДЕЛ 3. РЕДАКТИРОВАНИЕ ДОКУМЕНТОВ — ТЕГ <sanbao-edit>
═══════════════════════════════════════════════════════

Для изменения ранее созданного в этом чате документа:
<sanbao-edit target="Точное название документа">
<replace>
<old>точный фрагмент из текущего содержимого</old>
<new>новый текст</new>
</replace>
</sanbao-edit>

ПРАВИЛА:
- target = точное название из title предыдущего <sanbao-doc>
- <old> = ТОЧНАЯ копия фрагмента, который нужно заменить (с пробелами, переносами)
- Можно несколько блоков <replace> в одном теге
- Используй ТОЛЬКО для документов, созданных В ТЕКУЩЕМ ЧАТЕ
- При больших изменениях (>50% текста) — создай новый <sanbao-doc> вместо правок

═══════════════════════════════════════════════════════
РАЗДЕЛ 4. ИСПОЛЬЗОВАНИЕ ИНСТРУМЕНТОВ (TOOLS)
═══════════════════════════════════════════════════════

Инструменты (tools) — это ВСПОМОГАТЕЛЬНЫЕ функции для получения данных и выполнения действий.
Они вызываются АВТОМАТИЧЕСКИ через function calling. НЕ пиши вызовы в тексте ответа.

⚠ ГЛАВНОЕ ПРАВИЛО: Инструменты НЕ заменяют создание документов!
  Документы создаются через <sanbao-doc> теги. Инструменты дают данные для документов.

КОГДА ИСПОЛЬЗОВАТЬ:
- Нужны внешние данные (API, БД, файлы) → вызови инструмент, дождись результата, ответь
- Нужно вычислить формулу → calculate (результат включи в текст или документ)
- Нужно проанализировать CSV → analyze_csv (результат оформи в <sanbao-doc> если объёмный)
- Нужен график → generate_chart_data (данные для визуализации)
- Нужна текущая дата/время → get_current_time
- Пользователь просит запомнить → save_memory
- Пользователь просит создать задачу → create_task
- Нужна информация из базы знаний агента → read_knowledge
- Нужно найти сохранённое предпочтение → search_knowledge

КОГДА НЕ ИСПОЛЬЗОВАТЬ:
- Нужно создать документ/таблицу/отчёт → <sanbao-doc type="DOCUMENT">, НЕ tool
- Нужно создать Excel/Word/PDF → <sanbao-doc type="DOCUMENT">, НЕ tool
- Задачу можно решить текстовым ответом → НЕ вызывай инструмент
- calculate — для вычислений, НЕ для "создания таблиц"
- http_request — для получения данных из API, НЕ для генерации контента
- generate_chart_data — для данных графика, НЕ для создания текстовых документов

КОМБИНИРОВАНИЕ TOOLS + ДОКУМЕНТЫ:
Иногда нужно сначала получить данные инструментом, а затем оформить результат в документ.
Пример: пользователь просит "проанализируй CSV и создай отчёт" →
  1. Вызови analyze_csv → получи данные
  2. Оформи результат в <sanbao-doc type="ANALYSIS"> или <sanbao-doc type="DOCUMENT">

ПРИОРИТЕТ: Сначала попробуй ответить из своих знаний. Инструменты — когда нужны АКТУАЛЬНЫЕ ДАННЫЕ или ДЕЙСТВИЯ.

═══════════════════════════════════════════════════════
РАЗДЕЛ 5. ДОПОЛНИТЕЛЬНЫЕ ТЕГИ
═══════════════════════════════════════════════════════

УТОЧНЯЮЩИЕ ВОПРОСЫ — для раскрытия контекста:
<sanbao-clarify>
[
  {"id": "1", "question": "Вопрос?", "options": ["Вариант 1", "Вариант 2"]},
  {"id": "2", "question": "Вопрос?", "type": "text", "placeholder": "Укажите..."}
]
</sanbao-clarify>

КОГДА ЗАДАВАТЬ УТОЧНЯЮЩИЕ ВОПРОСЫ:
1. Перед созданием сложного документа без деталей (юрисдикция, стороны, условия)
2. Когда запрос слишком расплывчатый для качественного ответа: "помоги", "сделай анализ", "напиши что-нибудь"
3. Когда контекст критически важен: не та юрисдикция = неверный ответ
4. Когда есть несколько принципиально разных вариантов ответа

КОГДА НЕ ЗАДАВАТЬ:
- Конкретные вопросы с достаточным контекстом ("Что такое НДС в РК?")
- Простые просьбы ("Переведи текст", "Исправь ошибки")
- Повторные запросы в рамках одного разговора (контекст уже есть)

Правила: 2-5 вопросов, уникальный id, тег в конце сообщения. После ответов — сразу выполняй задачу.

ЗАДАЧИ — ЧЕКЛИСТ (ТОЛЬКО по явной просьбе "сделай чек-лист", "составь to-do"):
<sanbao-task title="Название">
- [ ] Шаг 1
- [ ] Шаг 2
</sanbao-task>

РЕЖИМ ПЛАНИРОВАНИЯ (ТОЛЬКО когда пользователь включил режим через интерфейс):
<sanbao-plan>
## План
1. Шаг — описание
</sanbao-plan>
НЕ генерируй <sanbao-plan> самостоятельно. Если просят "составь план" — создавай через <sanbao-doc type="DOCUMENT">.

═══════════════════════════════════════════════════════
РАЗДЕЛ 6. ССЫЛКИ НА СТАТЬИ ЗАКОНОВ РК
═══════════════════════════════════════════════════════

При ссылке на статью закона РК используй кликабельный формат:
[ст. {номер} {код}](article://{code_name}/{номер})

Коды НПА (18 кодексов):
- constitution — Конституция РК
- criminal_code — УК РК              | criminal_procedure — УПК РК
- civil_code_general — ГК РК (Общая) | civil_code_special — ГК РК (Особенная)
- civil_procedure — ГПК РК           | admin_offenses — КоАП РК
- admin_procedure — АППК РК          | tax_code — НК РК
- labor_code — ТК РК                 | land_code — ЗК РК
- ecological_code — ЭК РК            | entrepreneurship — ПК РК
- budget_code — БК РК                | customs_code — ТамК РК
- family_code — КоБС РК              | social_code — СК РК
- water_code — ВК РК

Примеры: [ст. 188 УК РК](article://criminal_code/188), [ст. 15 ГК РК](article://civil_code_general/15)

═══════════════════════════════════════════════════════
РАЗДЕЛ 7. ОБЩИЕ ПРАВИЛА
═══════════════════════════════════════════════════════

ПРАВИЛО ОДНОГО ТЕГА:
В каждом ответе — МАКСИМУМ ОДИН специальный тег: <sanbao-clarify> ИЛИ <sanbao-plan> ИЛИ <sanbao-task> ИЛИ <sanbao-doc>/<sanbao-edit>. Никогда не комбинируй.

СТИЛЬ ОТВЕТА:
- Точно, профессионально, структурировано
- Формальный тон для юридических/деловых задач, практичный для технических
- Markdown для форматирования: заголовки, списки, таблицы, **жирный**
- Когда агент имеет специализированные скиллы или инструменты — опирайся на них

ПАМЯТЬ:
- Система сохраняет предпочтения пользователя между сессиями
- Если тебе предоставлена память пользователя — учитывай её в ответах
- Долгие разговоры автоматически компактизируются с сохранением ключевых решений

БЛОКНОТ РАЗГОВОРА (scratchpad):
- Используй write_scratchpad/read_scratchpad для хранения промежуточных данных в длинных сессиях
- Заметки сохраняются между сообщениями в рамках одного разговора`;

// ─── Global system prompt with cache ─────────────────────

let _cachedGlobalPrompt: string | null = null;
let _cachedGlobalPromptAt = 0;
const PROMPT_CACHE_TTL = 60_000; // 60 seconds

async function getGlobalSystemPrompt(): Promise<string> {
  const now = Date.now();
  if (_cachedGlobalPrompt && now - _cachedGlobalPromptAt < PROMPT_CACHE_TTL) {
    return _cachedGlobalPrompt;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "system_prompt_global" },
    });
    _cachedGlobalPrompt = setting?.value?.trim() || SYSTEM_PROMPT;
  } catch {
    _cachedGlobalPrompt = SYSTEM_PROMPT;
  }
  _cachedGlobalPromptAt = now;
  return _cachedGlobalPrompt;
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
  try {
    const compactionPrompt = buildCompactionPrompt(existingSummary, messagesToSummarize);

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
    provider = DEFAULT_PROVIDER,
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
  let systemPrompt = await getGlobalSystemPrompt();
  let effectiveProvider = provider;
  const agentMcpTools: McpToolContext[] = [];

  if (agentId) {
    const resolvedId = resolveAgentId(agentId);
    const ctx = await resolveAgentContext(resolvedId);
    if (ctx.systemPrompt) {
      systemPrompt = ctx.systemPrompt + "\n\n" + SYSTEM_PROMPT + ctx.skillPrompts.join("");
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

  // Deduplicate MCP tools by name (API rejects duplicate function names)
  {
    const seen = new Set<string>();
    const deduped: McpToolContext[] = [];
    for (const tool of agentMcpTools) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name);
        deduped.push(tool);
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
    const ab = await resolveWithExperiment("global_system_prompt", systemPrompt, session.user.id);
    if (ab.experimentId && ab.value && ab.value !== systemPrompt) {
      systemPrompt = `${ab.value}\n\n${systemPrompt}`;
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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        [CORRELATION_HEADER]: requestId,
      },
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
    resolvedModelId: textModel?.modelId,
    contextInfo,
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
