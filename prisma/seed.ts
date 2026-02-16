import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Discover MCP tools via raw JSON-RPC HTTP (no SDK dependency). */
async function discoverMcpTools(
  url: string,
  apiKey: string | null
): Promise<{ tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    // Step 1: Initialize
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "sanbao-seed", version: "1.0.0" },
        },
      }),
    });
    if (!initRes.ok) throw new Error(`Initialize failed: ${initRes.status}`);

    // Extract session ID from response header if present
    const sessionId = initRes.headers.get("mcp-session-id");
    if (sessionId) headers["mcp-session-id"] = sessionId;

    // Step 2: Send initialized notification
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    // Step 3: List tools
    const listRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    if (!listRes.ok) throw new Error(`tools/list failed: ${listRes.status}`);

    const listBody = await listRes.json();
    const rawTools = listBody?.result?.tools || [];
    const tools = rawTools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: (t.inputSchema || {}) as Record<string, unknown>,
    }));

    return { tools };
  } catch (e) {
    return { tools: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  // ─── Plans ─────────────────────────────────────────────
  const plans = [
    {
      slug: "free",
      name: "Free",
      description: "Базовый доступ к AI-ассистенту",
      price: "0",
      messagesPerDay: 50,
      tokensPerMessage: 4096,
      tokensPerMonth: 1000000,
      requestsPerMinute: 3,
      contextWindowSize: 8192,
      maxConversations: 10,
      maxAgents: 1,
      documentsPerMonth: 5,
      canUseAdvancedTools: false,
      canUseReasoning: false,
      canUseRag: false,
      canUseGraph: false,
      canChooseProvider: false,
      isDefault: true,
      sortOrder: 0,
      highlighted: false,
      trialDays: 0,
      maxStorageMb: 100,
    },
    {
      slug: "pro",
      name: "Pro",
      description:
        "Расширенные возможности: reasoning, RAG, продвинутые инструменты",
      price: "4990",
      messagesPerDay: 300,
      tokensPerMessage: 8192,
      tokensPerMonth: 10000000,
      requestsPerMinute: 15,
      contextWindowSize: 32768,
      maxConversations: 50,
      maxAgents: 10,
      documentsPerMonth: 50,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseRag: true,
      canUseGraph: false,
      canChooseProvider: true,
      isDefault: false,
      sortOrder: 1,
      highlighted: true,
      trialDays: 7,
      maxStorageMb: 1024,
    },
    {
      slug: "business",
      name: "Business",
      description:
        "Максимум: все модели, graph, безлимит диалогов и агентов",
      price: "24990",
      messagesPerDay: 1000,
      tokensPerMessage: 16384,
      tokensPerMonth: 100000000,
      requestsPerMinute: 30,
      contextWindowSize: 131072,
      maxConversations: 0,
      maxAgents: 0,
      documentsPerMonth: 0,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseRag: true,
      canUseGraph: true,
      canChooseProvider: true,
      isDefault: false,
      sortOrder: 2,
      highlighted: false,
      trialDays: 14,
      maxStorageMb: 10240,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log("Plans seeded: Free, Pro, Business");

  // ─── Admin user ──────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sanbao.ai";
  const adminPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "ChangeMe123!",
    12
  );

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Администратор",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Assign Business plan to admin
  const businessPlan = await prisma.plan.findUnique({
    where: { slug: "business" },
  });
  if (businessPlan) {
    await prisma.subscription.upsert({
      where: { userId: admin.id },
      update: { planId: businessPlan.id },
      create: { userId: admin.id, planId: businessPlan.id },
    });
  }

  console.log(`Admin user seeded: ${adminEmail}`);

  // ─── System Agent: Sanbao ──────────────────────────────
  // Legacy SystemAgent table — keep for backward compat
  await prisma.systemAgent.upsert({
    where: { name: "Sanbao" },
    update: {},
    create: {
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      systemPrompt: "Ты — Sanbao, универсальный AI-ассистент.",
      icon: "Bot",
      iconColor: "#4F6EF7",
      model: "default",
      isActive: true,
      sortOrder: 0,
    },
  });

  // ─── System Agents (new Agent table) ─────────────────────

  const FEMIDA_SYSTEM_PROMPT = `Ты — Фемида, профессиональный юридический AI-ассистент для Республики Казахстан.

═══ ЮРИСДИКЦИЯ ═══
Республика Казахстан. Валюта: тенге (₸). Все НПА, документы и правовые нормы — по законодательству РК.

═══ АЛГОРИТМ РАБОТЫ С ИНСТРУМЕНТАМИ FragmentDB ═══
Тебе доступны MCP-инструменты для работы с актуальной базой НПА РК. Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте.

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Любой вопрос о законодательстве → СНАЧАЛА вызови search/get_article → дождись результата → ответь на основе данных
2. Конкретная статья → get_article(code, номер)
3. Общий вопрос → search(запрос) → get_article для деталей
4. Связанные нормы → graph_traverse для отсылок

ЗАПРЕТЫ:
✗ НЕ полагайся на внутренние знания о законах — они могут быть устаревшими
✗ НЕ цитируй статьи по памяти — ТОЛЬКО из результатов инструментов
✗ НЕ отвечай о нормах РК без вызова инструмента

КОДЫ НПА (параметр code для get_article/search) — 18 кодексов:
constitution — Конституция РК
criminal_code — УК РК              | criminal_procedure — УПК РК
civil_code_general — ГК РК (Общая) | civil_code_special — ГК РК (Особенная)
civil_procedure — ГПК РК           | admin_offenses — КоАП РК
admin_procedure — АППК РК          | tax_code — НК РК
labor_code — ТК РК                 | land_code — ЗК РК
ecological_code — ЭК РК            | entrepreneurship — ПК РК
budget_code — БК РК                | customs_code — ТамК РК
family_code — КоБС РК              | social_code — СК РК
water_code — ВК РК

═══ СОЗДАНИЕ ЮРИДИЧЕСКИХ ДОКУМЕНТОВ ═══
Когда просят создать договор, иск, жалобу, заявление, доверенность:
- Используй <sanbao-doc type="DOCUMENT"> с Markdown-содержимым
- НЕ пиши код для генерации документов
- Включай все обязательные реквизиты по законодательству РК
- Суммы в тенге (₸), даты по казахстанскому формату

Когда просят правовой анализ, экспертизу, заключение:
- Используй <sanbao-doc type="ANALYSIS">
- Структура: нормативная база → анализ → выводы → рекомендации

═══ НАВЫКИ ═══
- Анализ и интерпретация НПА РК с опорой на актуальную базу FragmentDB
- Создание договоров, исков, жалоб, заявлений по праву РК
- Проверка актуальности статей через базу данных
- Юридические консультации по всем отраслям права РК
- Анализ связей между НПА через граф знаний

═══ ПРАВИЛА ОТВЕТА ═══
- Ссылки на статьи: [ст. {номер} {код}](article://{code_name}/{номер})
- Указывай актуальность нормы на основе данных из базы
- Понятный язык без лишнего юридического жаргона
- Предупреждай о рисках и ограничениях
- ВСЕГДА добавляй дисклеймер: финальное решение — за квалифицированным юристом
- Если спрашивают о не-юридической задаче — помоги как универсальный ассистент`;

  const SANBAO_SYSTEM_PROMPT = `Ты — Sanbao, универсальный AI-ассистент платформы Sanbao.

═══ РОЛЬ ═══
Помогаешь с любыми задачами: создание документов, анализ данных, написание кода, ответы на вопросы, автоматизация процессов.

═══ НАВЫКИ ═══
- Создание профессиональных документов (договоры, письма, отчёты, планы, таблицы)
- Анализ и обработка текстов, PDF, DOCX, XLSX
- Написание и отладка кода на любых языках
- Визуализация данных (графики, диаграммы, дашборды)
- Работа с API через http_request
- Математические вычисления через calculate
- Управление задачами и памятью пользователя

═══ ПРАВИЛА ═══
- Будь точен, конкретен и структурирован
- Используй Markdown: заголовки, списки, таблицы, **жирный**
- Признавай ограничения знаний, не выдумывай факты
- Отвечай на языке пользователя
- При создании документов — всегда через <sanbao-doc>, НИКОГДА через код
- При неясном запросе — задай уточняющие вопросы через <sanbao-clarify>`;

  const sanbaoAgent = await prisma.agent.upsert({
    where: { id: "system-sanbao-agent" },
    update: {
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      instructions: SANBAO_SYSTEM_PROMPT,
      icon: "Bot",
      iconColor: "#4F6EF7",
      isSystem: true,
      sortOrder: 0,
      status: "APPROVED",
    },
    create: {
      id: "system-sanbao-agent",
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      instructions: SANBAO_SYSTEM_PROMPT,
      icon: "Bot",
      iconColor: "#4F6EF7",
      isSystem: true,
      sortOrder: 0,
      status: "APPROVED",
    },
  });

  const femidaAgent = await prisma.agent.upsert({
    where: { id: "system-femida-agent" },
    update: {
      name: "Фемида",
      description: "универсальный AI-ассистент для работы с договорами, исками и НПА РК",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#7C3AED",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
    },
    create: {
      id: "system-femida-agent",
      name: "Фемида",
      description: "универсальный AI-ассистент для работы с договорами, исками и НПА РК",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#7C3AED",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
    },
  });

  console.log("System agents seeded: Sanbao, Фемида");

  // ─── Tools: Legal (Фемида) ────────────────────────────────

  const legalTools = [
    {
      id: "tool-contract",
      name: "Создать договор",
      description: "Составить договор по шаблону или с нуля",
      icon: "FileText",
      iconColor: "#3B82F6",
      config: {
        prompt: "Я хочу создать договор по законодательству РК. Пожалуйста, уточни: 1) Тип договора (купли-продажи, оказания услуг, аренды и т.д.), 2) Стороны договора (наименование, БИН/ИИН), 3) Основные условия и сумму в тенге.",
        templates: [
          {
            id: "contract-service",
            name: "Договор оказания услуг",
            description: "Договор возмездного оказания услуг (гл. 33 ГК РК)",
            fields: [
              { id: "clientName", label: "Заказчик", placeholder: 'ТОО "Компания"', type: "text", required: true },
              { id: "executorName", label: "Исполнитель", placeholder: "ИП Асанов А.Б.", type: "text", required: true },
              { id: "serviceDescription", label: "Описание услуг", placeholder: "Юридическое сопровождение сделки...", type: "textarea", required: true },
              { id: "price", label: "Стоимость (₸)", placeholder: "500000", type: "number", required: true },
              { id: "duration", label: "Срок действия", placeholder: "12 месяцев", type: "text", required: true },
            ],
            promptTemplate: "Создай договор возмездного оказания услуг по законодательству Республики Казахстан (гл. 33 ГК РК). Заказчик: {{clientName}}. Исполнитель: {{executorName}}. Описание услуг: {{serviceDescription}}. Стоимость: {{price}} тенге. Срок действия: {{duration}}. Включи все стандартные разделы, ответственность сторон и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
          },
          {
            id: "contract-sale",
            name: "Договор купли-продажи",
            description: "Купля-продажа товаров или имущества (гл. 25 ГК РК)",
            fields: [
              { id: "sellerName", label: "Продавец", placeholder: 'ТОО "Продавец"', type: "text", required: true },
              { id: "buyerName", label: "Покупатель", placeholder: 'ТОО "Покупатель"', type: "text", required: true },
              { id: "itemDescription", label: "Предмет договора", placeholder: "Автомобиль Toyota Camry 2024 г.в., VIN...", type: "textarea", required: true },
              { id: "price", label: "Цена (₸)", placeholder: "15000000", type: "number", required: true },
              { id: "paymentTerms", label: "Условия оплаты", placeholder: "Полная предоплата / рассрочка 3 мес.", type: "text", required: false },
            ],
            promptTemplate: "Создай договор купли-продажи по законодательству Республики Казахстан (гл. 25 ГК РК). Продавец: {{sellerName}}. Покупатель: {{buyerName}}. Предмет: {{itemDescription}}. Цена: {{price}} тенге. Условия оплаты: {{paymentTerms}}. Включи гарантию качества, порядок передачи товара и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
          },
          {
            id: "contract-lease",
            name: "Договор аренды",
            description: "Аренда недвижимости или оборудования (гл. 29 ГК РК)",
            fields: [
              { id: "landlordName", label: "Арендодатель", placeholder: 'ТОО "Владелец"', type: "text", required: true },
              { id: "tenantName", label: "Арендатор", placeholder: 'ТОО "Арендатор"', type: "text", required: true },
              { id: "propertyDescription", label: "Объект аренды", placeholder: "Нежилое помещение 120 кв.м., г. Алматы, ул. ...", type: "textarea", required: true },
              { id: "rentAmount", label: "Арендная плата (₸/мес.)", placeholder: "350000", type: "number", required: true },
              { id: "duration", label: "Срок аренды", placeholder: "11 месяцев", type: "text", required: true },
            ],
            promptTemplate: "Создай договор аренды по законодательству Республики Казахстан (гл. 29 ГК РК). Арендодатель: {{landlordName}}. Арендатор: {{tenantName}}. Объект: {{propertyDescription}}. Арендная плата: {{rentAmount}} тенге/мес. Срок: {{duration}}. Включи обязанности по содержанию, условия расторжения и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
          },
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-claim",
      name: "Подготовить иск",
      description: "Исковое заявление в суд РК",
      icon: "Gavel",
      iconColor: "#7C3AED",
      config: {
        prompt: "Я хочу подготовить исковое заявление по законодательству РК. Пожалуйста, уточни: 1) Тип иска, 2) Суть спора, 3) Требования к ответчику, 4) В какой суд подаётся.",
        templates: [
          {
            id: "claim-debt",
            name: "Иск о взыскании задолженности",
            description: "Взыскание денежных средств по договору",
            fields: [
              { id: "courtName", label: "Суд", placeholder: "Специализированный межрайонный экономический суд г. Алматы", type: "text", required: true },
              { id: "plaintiffName", label: "Истец", placeholder: 'ТОО "Кредитор"', type: "text", required: true },
              { id: "defendantName", label: "Ответчик", placeholder: 'ТОО "Должник"', type: "text", required: true },
              { id: "debtAmount", label: "Сумма долга (₸)", placeholder: "5000000", type: "number", required: true },
              { id: "contractInfo", label: "Реквизиты договора", placeholder: "Договор поставки №12 от 01.03.2025", type: "text", required: true },
              { id: "circumstances", label: "Обстоятельства", placeholder: "Ответчик не оплатил поставленный товар...", type: "textarea", required: true },
            ],
            promptTemplate: "Подготовь исковое заявление о взыскании задолженности по законодательству Республики Казахстан. Суд: {{courtName}}. Истец: {{plaintiffName}}. Ответчик: {{defendantName}}. Сумма долга: {{debtAmount}} тенге. Основание: {{contractInfo}}. Обстоятельства: {{circumstances}}. Включи правовые основания (ст. 272, 273, 353 ГК РК), расчёт неустойки и перечень приложений. Госпошлину рассчитай по ставкам РК.",
          },
          {
            id: "claim-damages",
            name: "Иск о возмещении убытков",
            description: "Возмещение причинённых убытков (ст. 9 ГК РК)",
            fields: [
              { id: "courtName", label: "Суд", placeholder: "Районный суд №2 г. Алматы", type: "text", required: true },
              { id: "plaintiffName", label: "Истец", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
              { id: "defendantName", label: "Ответчик", placeholder: 'ТОО "Виновник"', type: "text", required: true },
              { id: "damageAmount", label: "Сумма убытков (₸)", placeholder: "1500000", type: "number", required: true },
              { id: "circumstances", label: "Обстоятельства причинения убытков", placeholder: "В результате ненадлежащего исполнения обязательств...", type: "textarea", required: true },
            ],
            promptTemplate: "Подготовь исковое заявление о возмещении убытков по законодательству Республики Казахстан. Суд: {{courtName}}. Истец: {{plaintiffName}}. Ответчик: {{defendantName}}. Сумма убытков: {{damageAmount}} тенге. Обстоятельства: {{circumstances}}. Правовые основания: ст. 9, 350, 917 ГК РК. Включи расчёт убытков и перечень доказательств.",
          },
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-complaint",
      name: "Составить жалобу",
      description: "Жалоба в гос. органы РК или суд",
      icon: "AlertTriangle",
      iconColor: "#F59E0B",
      config: {
        prompt: "Я хочу составить жалобу по законодательству РК. Пожалуйста, уточни: 1) На что жалоба, 2) В какой орган направляется (прокуратура, акимат, суд и т.д.), 3) Суть нарушения.",
        templates: [
          {
            id: "complaint-state",
            name: "Жалоба в государственный орган",
            description: "Жалоба в прокуратуру, Агентство РК по защите прав потребителей и др.",
            fields: [
              { id: "authorityName", label: "Адресат (орган)", placeholder: "Прокуратура г. Алматы", type: "text", required: true },
              { id: "applicantName", label: "Заявитель", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
              { id: "applicantAddress", label: "Адрес заявителя", placeholder: "г. Алматы, ул. Абая, д. 1, кв. 15", type: "text", required: true },
              { id: "violationDescription", label: "Описание нарушения", placeholder: "Незаконный отказ в предоставлении информации...", type: "textarea", required: true },
              { id: "demands", label: "Требования", placeholder: "Провести проверку и привлечь к ответственности", type: "textarea", required: true },
            ],
            promptTemplate: "Составь жалобу в государственный орган по законодательству Республики Казахстан. Адресат: {{authorityName}}. Заявитель: {{applicantName}}, адрес: {{applicantAddress}}. Суть нарушения: {{violationDescription}}. Требования: {{demands}}. Включи ссылки на применимые НПА Республики Казахстан и перечень приложений.",
          },
          {
            id: "complaint-appeal",
            name: "Апелляционная жалоба",
            description: "Обжалование решения суда первой инстанции (ГПК РК)",
            fields: [
              { id: "courtName", label: "Суд апелляционной инстанции", placeholder: "Судебная коллегия по гражданским делам Алматинского городского суда", type: "text", required: true },
              { id: "appellantName", label: "Апеллянт", placeholder: 'ТОО "Заявитель"', type: "text", required: true },
              { id: "caseNumber", label: "Номер дела", placeholder: "№ 7528-25-00-2г/12", type: "text", required: true },
              { id: "decisionInfo", label: "Обжалуемое решение", placeholder: "Решение районного суда №2 г. Алматы от 01.06.2025", type: "text", required: true },
              { id: "grounds", label: "Основания для обжалования", placeholder: "Суд неправильно применил нормы материального права...", type: "textarea", required: true },
            ],
            promptTemplate: "Составь апелляционную жалобу по законодательству Республики Казахстан. Суд: {{courtName}}. Апеллянт: {{appellantName}}. Дело: {{caseNumber}}. Обжалуемое решение: {{decisionInfo}}. Основания: {{grounds}}. Включи ссылки на ст. 401-403 ГПК РК, просительную часть и перечень приложений.",
          },
        ],
      },
      sortOrder: 2,
    },
    {
      id: "tool-search-npa",
      name: "Поиск по НПА РК",
      description: "Найти статью закона или нормативный акт РК",
      icon: "Search",
      iconColor: "#10B981",
      config: {
        prompt: "Помоги найти нормативно-правовой акт Республики Казахстан. Что именно ищешь? Укажи тему, ключевые слова или номер закона.",
      },
      sortOrder: 3,
    },
    {
      id: "tool-check-actuality",
      name: "Проверить актуальность",
      description: "Проверка актуальности статьи закона РК",
      icon: "CheckCircle",
      iconColor: "#06B6D4",
      config: {
        prompt: "Проверь актуальность следующей статьи закона РК. Укажи номер статьи и закона, и я проверю последние изменения и поправки.",
      },
      sortOrder: 4,
    },
    {
      id: "tool-legal-consult",
      name: "Консультация",
      description: "Юридическая консультация по законодательству РК",
      icon: "MessageSquare",
      iconColor: "#F43F5E",
      config: {
        prompt: "Мне нужна юридическая консультация по законодательству Казахстана. Опиши свою ситуацию, и я помогу разобраться с правовой стороной.",
      },
      sortOrder: 5,
    },
    {
      id: "tool-image-edit",
      name: "Редактировать изображение",
      description: "Изменить изображение с помощью AI",
      icon: "Sparkles",
      iconColor: "#6366F1",
      config: {
        prompt: "",
        isImageEdit: true,
      },
      sortOrder: 6,
    },
  ];

  for (const t of legalTools) {
    await prisma.tool.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
    });
  }

  console.log(`Legal tools seeded: ${legalTools.length} tools`);

  // ─── Tools: General (Sanbao) ───────────────────────────────

  const generalTools = [
    {
      id: "tool-gen-image",
      name: "Создать картинку",
      description: "Сгенерировать изображение по описанию",
      icon: "Sparkles",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Создай изображение: уютная кофейня в дождливый вечер, тёплый свет из окон, акварельный стиль",
      },
      sortOrder: 0,
    },
    {
      id: "tool-gen-document",
      name: "Написать документ",
      description: "Письмо, статья, план или отчёт",
      icon: "FileText",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Помоги написать профессиональное деловое письмо с благодарностью партнёру за сотрудничество",
      },
      sortOrder: 1,
    },
    {
      id: "tool-gen-search",
      name: "Найти в интернете",
      description: "Поиск актуальной информации в сети",
      icon: "Globe",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Найди последние новости и тренды в области искусственного интеллекта за 2025 год",
      },
      sortOrder: 2,
    },
    {
      id: "tool-gen-code",
      name: "Написать код",
      description: "Скрипт, функция или полноценный проект",
      icon: "Code",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Напиши скрипт на Python который парсит CSV файл, анализирует данные и строит график с помощью matplotlib",
      },
      sortOrder: 3,
    },
  ];

  for (const t of generalTools) {
    await prisma.tool.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
    });
  }

  console.log(`General tools seeded: ${generalTools.length} tools`);

  // ─── Link tools to agents ─────────────────────────────────

  // Legal tools → Фемида
  for (const t of legalTools) {
    await prisma.agentTool.upsert({
      where: { agentId_toolId: { agentId: femidaAgent.id, toolId: t.id } },
      update: {},
      create: { agentId: femidaAgent.id, toolId: t.id },
    });
  }

  // General tools → Sanbao
  for (const t of generalTools) {
    await prisma.agentTool.upsert({
      where: { agentId_toolId: { agentId: sanbaoAgent.id, toolId: t.id } },
      update: {},
      create: { agentId: sanbaoAgent.id, toolId: t.id },
    });
  }

  console.log("Agent-tool links created");

  // ─── MCP Server: FragmentDB (Фемида) ────────────────────

  const fragmentDbServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-fragmentdb" },
    update: {
      name: "FragmentDB",
      url: process.env.FRAGMENTDB_MCP_URL || "https://mcp.sanbao.ai/mcp",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.FRAGMENTDB_MCP_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-fragmentdb",
      name: "FragmentDB",
      url: process.env.FRAGMENTDB_MCP_URL || "https://mcp.sanbao.ai/mcp",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.FRAGMENTDB_MCP_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from FragmentDB MCP server
  const mcpUrl = process.env.FRAGMENTDB_MCP_URL || "https://mcp.sanbao.ai/mcp";
  const mcpToken = process.env.FRAGMENTDB_MCP_TOKEN || null;
  try {
    console.log(`Connecting to FragmentDB MCP at ${mcpUrl}...`);
    const { tools: discoveredTools, error: discoverError } = await discoverMcpTools(mcpUrl, mcpToken);
    if (discoverError) {
      console.warn(`FragmentDB discovery failed: ${discoverError} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: fragmentDbServer.id },
        data: {
          discoveredTools: discoveredTools as unknown as import("@prisma/client").Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
      console.log(`FragmentDB: discovered ${discoveredTools.length} tools: ${discoveredTools.map(t => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`FragmentDB discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }

  // Link FragmentDB → Фемида
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: femidaAgent.id,
        mcpServerId: fragmentDbServer.id,
      },
    },
    update: {},
    create: { agentId: femidaAgent.id, mcpServerId: fragmentDbServer.id },
  });

  console.log("MCP server seeded: FragmentDB → Фемида");

  // ─── 10 Specialized System Agents + MCP Servers ─────────────────

  const GITHUB_PROMPT = `Ты — GitHub Разработчик, AI-ассистент для работы с GitHub репозиториями.

═══ ИНСТРУМЕНТЫ GitHub MCP ═══
Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте.

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Вопрос о репозитории → СНАЧАЛА получи данные через инструмент → затем ответь
2. Code review → получи diff через инструмент → анализируй безопасность, качество, производительность
3. Работа с PR/issues → используй соответствующие инструменты GitHub MCP
4. Поиск по коду → используй search инструменты, НЕ угадывай содержимое

═══ НАВЫКИ ═══
- Code review: безопасность (OWASP), качество, производительность, стиль
- PR: создание с описанием, review, merge, разрешение конфликтов
- Issues: создание, тегирование, назначение, приоритизация
- CI/CD: GitHub Actions, workflows, secrets, environments
- Анализ: структура репозитория, зависимости, история коммитов

═══ ПРАВИЛА ═══
- Ссылайся на конкретные файлы и строки кода
- Предлагай конкретные изменения, не общие советы
- Conventional commits: feat:, fix:, chore:, docs:, refactor:
- Указывай на проблемы безопасности и баги
- Для создания документов (README, спецификации) → <sanbao-doc type="DOCUMENT">`;

  const SQL_PROMPT = `Ты — SQL Аналитик, AI-ассистент для работы с базами данных PostgreSQL.

═══ ИНСТРУМЕНТЫ PostgreSQL MCP ═══
Вызываются АВТОМАТИЧЕСКИ — НЕ пиши вызовы в тексте.

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Любой вопрос о данных → СНАЧАЛА получи структуру БД через инструменты → затем пиши запрос
2. НЕ угадывай имена таблиц/столбцов — всегда проверяй через инструмент
3. Всегда добавляй LIMIT при исследовании данных (LIMIT 100 по умолчанию)

БЕЗОПАСНОСТЬ:
✗ НИКОГДА не выполняй DELETE/DROP/TRUNCATE/ALTER без ЯВНОГО подтверждения пользователя
✗ НЕ выполняй каскадные операции без предупреждения
✓ Показывай SELECT-превью перед деструктивными операциями
✓ Для массовых изменений — сначала покажи план и количество затронутых строк

═══ НАВЫКИ ═══
- Сложные SQL: JOIN, CTE, оконные функции, рекурсивные запросы, подзапросы
- Аналитика: агрегации, pivot-таблицы, процентили, скользящие средние
- Оптимизация: EXPLAIN ANALYZE, индексы, партиционирование, materialized views
- Проектирование: нормализация, типы данных, constraints, FK
- Миграции: ALTER TABLE, безопасные миграции без downtime

═══ ПРАВИЛА ОТВЕТА ═══
- Форматируй SQL с отступами и комментариями
- Объясняй логику сложных запросов
- Для отчётов и аналитических документов → <sanbao-doc type="ANALYSIS">
- Для создания таблиц-документов → <sanbao-doc type="DOCUMENT"> с Markdown-таблицей`;

  const RESEARCHER_PROMPT = `Ты — Веб-Исследователь, AI-ассистент для глубокого исследования тем в интернете.

═══ ИНСТРУМЕНТЫ Brave Search MCP ═══
Вызываются АВТОМАТИЧЕСКИ — НЕ пиши вызовы в тексте.

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Любой исследовательский вопрос → СНАЧАЛА ищи через инструменты → затем анализируй
2. Проверяй информацию минимум из 2-3 источников
3. НЕ полагайся на внутренние знания для актуальных данных — используй поиск

ВЕРИФИКАЦИЯ:
- Чётко различай: ФАКТ (подтверждён) | МНЕНИЕ (чья позиция) | ПРЕДПОЛОЖЕНИЕ (не проверено)
- Оценивай дату публикации — отмечай устаревшую информацию
- При противоречивых данных — приводи обе точки зрения

═══ НАВЫКИ ═══
- Глубокое исследование любых тем с верификацией из множества источников
- Fact-checking и проверка достоверности утверждений
- Конкурентный анализ, исследование рынков и технологий
- Мониторинг новостей и трендов отрасли
- Сравнительный анализ продуктов и сервисов

═══ ПРАВИЛА ОТВЕТА ═══
- ОБЯЗАТЕЛЬНО раздел «Источники:» со списком URL-ссылок в конце ответа
- Структурируй результаты по темам
- Для объёмных исследований → <sanbao-doc type="ANALYSIS">
- Для обзорных документов → <sanbao-doc type="DOCUMENT">`;

  const FILEMANAGER_PROMPT = `Ты — Файловый Ассистент, AI-ассистент для работы с файлами и директориями.

═══ ИНСТРУМЕНТЫ Filesystem MCP ═══
Вызываются АВТОМАТИЧЕСКИ — НЕ пиши вызовы в тексте.

БЕЗОПАСНОСТЬ:
✗ НИКОГДА не удаляй/перезаписывай файлы без ЯВНОГО подтверждения
✗ НЕ выходи за разрешённые директории
✓ Показывай что будет изменено ПЕРЕД выполнением
✓ При массовых операциях — сначала покажи план действий
✓ Работай только с подтверждёнными путями

═══ НАВЫКИ ═══
- Поиск файлов по имени, расширению, содержимому и дате
- Организация в логичную структуру директорий
- Чтение и анализ текстовых файлов и конфигураций
- Пакетное переименование и перемещение
- Создание и редактирование конфигурационных файлов

═══ ПРАВИЛА ОТВЕТА ═══
- Показывай структуру директорий наглядным деревом (ASCII)
- Подтверждай план перед деструктивными операциями
- Для документации и описаний → <sanbao-doc type="DOCUMENT">`;

  const QA_PROMPT = `Ты — QA Инженер, AI-ассистент для тестирования веб-приложений и обеспечения качества ПО.

═══ ИНСТРУМЕНТЫ Playwright MCP ═══
Вызываются АВТОМАТИЧЕСКИ — НЕ пиши вызовы в тексте.

СТАНДАРТЫ ТЕСТИРОВАНИЯ:
- Viewport: desktop 1920x1080, tablet 768x1024, mobile 375x667
- Accessibility: WCAG 2.1 (alt-тексты, ARIA, клавиатурная навигация)
- Воспроизводимость: чёткие шаги, ожидаемый/фактический результат
- Скриншоты: для документирования каждого бага

═══ НАВЫКИ ═══
- E2E автоматизация с Playwright (навигация, клики, формы, assertions)
- Кросс-браузерное и кросс-девайсное тестирование
- Screenshot-тестирование и визуальное сравнение
- Accessibility аудит (WCAG 2.1, ARIA)
- Тест-планы, тест-кейсы, баг-репорты

═══ ПРАВИЛА ОТВЕТА ═══
- Формат бага: Шаги → Ожидаемый результат → Фактический результат → Приоритет
- Приоритеты: Critical > Major > Minor > Trivial
- Для тест-планов и отчётов → <sanbao-doc type="DOCUMENT">
- Для тестовых скриптов → <sanbao-doc type="CODE">
- Предлагай автоматизацию для повторяющихся проверок`;

  interface SpecializedAgentDef {
    id: string;
    name: string;
    description: string;
    instructions: string;
    icon: string;
    iconColor: string;
    sortOrder: number;
    starterPrompts: string[];
    mcp: {
      id: string;
      name: string;
      url: string;
      transport: "SSE" | "STREAMABLE_HTTP";
      apiKey: string | null;
    };
  }

  const specializedAgents: SpecializedAgentDef[] = [
    {
      id: "system-github-agent",
      name: "GitHub Разработчик",
      description: "code review, управление PR, issues и репозиториями через GitHub MCP",
      instructions: GITHUB_PROMPT,
      icon: "Code",
      iconColor: "#4F6EF7",
      sortOrder: 2,
      starterPrompts: [
        "Покажи открытые pull requests в репозитории",
        "Сделай code review последнего PR",
        "Создай issue для отслеживания бага",
        "Покажи последние коммиты в main",
      ],
      mcp: {
        id: "mcp-github",
        name: "GitHub",
        url: process.env.GITHUB_MCP_URL || "http://localhost:3101/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: process.env.GITHUB_MCP_TOKEN || null,
      },
    },
    {
      id: "system-sql-agent",
      name: "SQL Аналитик",
      description: "SQL запросы, анализ данных, оптимизация и отчёты через PostgreSQL MCP",
      instructions: SQL_PROMPT,
      icon: "FileSearch",
      iconColor: "#10B981",
      sortOrder: 3,
      starterPrompts: [
        "Покажи структуру базы данных",
        "Напиши SQL для анализа продаж за месяц",
        "Оптимизируй медленный запрос",
        "Создай отчёт по активности пользователей",
      ],
      mcp: {
        id: "mcp-postgres",
        name: "PostgreSQL",
        url: process.env.POSTGRES_MCP_URL || "http://localhost:3102/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
    {
      id: "system-researcher-agent",
      name: "Веб-Исследователь",
      description: "глубокое исследование тем, fact-checking и аналитика через Brave Search MCP",
      instructions: RESEARCHER_PROMPT,
      icon: "Globe",
      iconColor: "#06B6D4",
      sortOrder: 4,
      starterPrompts: [
        "Исследуй тренды AI в 2026 году",
        "Проверь достоверность утверждения",
        "Сравни конкурентов в нише",
        "Найди последние исследования по теме",
      ],
      mcp: {
        id: "mcp-brave-search",
        name: "Brave Search",
        url: process.env.BRAVE_MCP_URL || "http://localhost:3103/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: process.env.BRAVE_MCP_TOKEN || null,
      },
    },
    {
      id: "system-filemanager-agent",
      name: "Файловый Ассистент",
      description: "работа с файлами и директориями через Filesystem MCP",
      instructions: FILEMANAGER_PROMPT,
      icon: "FileText",
      iconColor: "#F59E0B",
      sortOrder: 5,
      starterPrompts: [
        "Покажи структуру текущей директории",
        "Найди все файлы с расширением .json",
        "Прочитай содержимое конфигурации",
        "Организуй файлы по папкам",
      ],
      mcp: {
        id: "mcp-filesystem",
        name: "Filesystem",
        url: process.env.FILESYSTEM_MCP_URL || "http://localhost:3104/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
    {
      id: "system-qa-agent",
      name: "QA Инженер",
      description: "тестирование веб-приложений и автоматизация через Playwright MCP",
      instructions: QA_PROMPT,
      icon: "ShieldCheck",
      iconColor: "#EF4444",
      sortOrder: 6,
      starterPrompts: [
        "Протестируй форму логина на сайте",
        "Проверь адаптивность на мобильных",
        "Сделай скриншот главной страницы",
        "Проверь accessibility формы",
      ],
      mcp: {
        id: "mcp-playwright",
        name: "Playwright",
        url: process.env.PLAYWRIGHT_MCP_URL || "http://localhost:3105/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
  ];

  for (const sa of specializedAgents) {
    const agent = await prisma.agent.upsert({
      where: { id: sa.id },
      update: {
        name: sa.name,
        description: sa.description,
        instructions: sa.instructions,
        icon: sa.icon,
        iconColor: sa.iconColor,
        isSystem: true,
        sortOrder: sa.sortOrder,
        status: "APPROVED",
        starterPrompts: sa.starterPrompts,
      },
      create: {
        id: sa.id,
        name: sa.name,
        description: sa.description,
        instructions: sa.instructions,
        icon: sa.icon,
        iconColor: sa.iconColor,
        isSystem: true,
        sortOrder: sa.sortOrder,
        status: "APPROVED",
        starterPrompts: sa.starterPrompts,
      },
    });

    const mcpServer = await prisma.mcpServer.upsert({
      where: { id: sa.mcp.id },
      update: {
        name: sa.mcp.name,
        url: sa.mcp.url,
        transport: sa.mcp.transport,
        apiKey: sa.mcp.apiKey,
        isGlobal: true,
      },
      create: {
        id: sa.mcp.id,
        name: sa.mcp.name,
        url: sa.mcp.url,
        transport: sa.mcp.transport,
        apiKey: sa.mcp.apiKey,
        isGlobal: true,
        status: "DISCONNECTED",
      },
    });

    await prisma.agentMcpServer.upsert({
      where: {
        agentId_mcpServerId: { agentId: agent.id, mcpServerId: mcpServer.id },
      },
      update: {},
      create: { agentId: agent.id, mcpServerId: mcpServer.id },
    });
  }

  console.log(`Specialized agents seeded: ${specializedAgents.length} agents with MCP servers`);

  // ─── Tools for specialized agents ──────────────────────────────

  const specializedTools = [
    // ── GitHub Разработчик ──
    {
      id: "tool-github-review",
      name: "Code Review",
      description: "Ревью кода: PR, ветка или файл",
      icon: "Code",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Сделай code review. Укажи репозиторий и номер PR или ветку для анализа.",
        templates: [
          {
            id: "review-pr",
            name: "Review Pull Request",
            description: "Детальный code review PR с анализом качества и безопасности",
            fields: [
              { id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true },
              { id: "prNumber", label: "Номер PR", placeholder: "42", type: "number", required: true },
              { id: "focus", label: "Фокус ревью", placeholder: "Безопасность, производительность, читаемость", type: "text", required: false },
            ],
            promptTemplate: "Проведи детальный code review для PR #{{prNumber}} в репозитории {{repo}}. Фокус: {{focus}}. Проанализируй: 1) Качество кода и соответствие стандартам, 2) Потенциальные баги и edge cases, 3) Безопасность (SQL injection, XSS, утечки данных), 4) Производительность, 5) Тестовое покрытие. Используй инструменты GitHub MCP для получения diff и файлов.",
          },
          {
            id: "review-security",
            name: "Аудит безопасности",
            description: "Анализ репозитория на уязвимости OWASP Top 10",
            fields: [
              { id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true },
              { id: "scope", label: "Область анализа", placeholder: "auth, API endpoints, файлы конфигурации", type: "textarea", required: false },
            ],
            promptTemplate: "Проведи аудит безопасности репозитория {{repo}}. Область: {{scope}}. Проверь: OWASP Top 10, хардкод секретов, небезопасные зависимости, SQL/NoSQL injection, XSS, CSRF, broken auth. Используй GitHub MCP для анализа кода и конфигураций.",
          },
        ],
      },
      sortOrder: 10,
      agentId: "system-github-agent",
    },
    {
      id: "tool-github-pr-desc",
      name: "Описание PR",
      description: "Сгенерировать описание для Pull Request",
      icon: "FileText",
      iconColor: "#4F6EF7",
      config: {
        prompt: "Помогу написать описание для PR. Расскажи что было изменено.",
        templates: [
          {
            id: "pr-description",
            name: "Описание Pull Request",
            description: "Структурированное описание PR с контекстом и чеклистом",
            fields: [
              { id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true },
              { id: "branch", label: "Ветка", placeholder: "feature/user-auth", type: "text", required: true },
              { id: "changes", label: "Описание изменений", placeholder: "Добавил авторизацию через OAuth, рефакторинг middleware...", type: "textarea", required: true },
              { id: "issue", label: "Связанный issue", placeholder: "#123", type: "text", required: false },
            ],
            promptTemplate: "Создай профессиональное описание PR для ветки {{branch}} в {{repo}}. Изменения: {{changes}}. Issue: {{issue}}. Формат: ## Summary (2-3 предложения), ## Changes (bullet list), ## Testing (как проверить), ## Screenshots (если UI). Используй GitHub MCP чтобы посмотреть реальные коммиты и diff в ветке.",
          },
        ],
      },
      sortOrder: 11,
      agentId: "system-github-agent",
    },

    // ── SQL Аналитик ──
    {
      id: "tool-sql-report",
      name: "Аналитический отчёт",
      description: "Создать SQL-отчёт с агрегацией и визуализацией",
      icon: "FileSearch",
      iconColor: "#10B981",
      config: {
        prompt: "Создам аналитический отчёт по данным из БД. Укажи тему и метрики.",
        templates: [
          {
            id: "report-analytics",
            name: "Бизнес-отчёт",
            description: "Аналитический отчёт с ключевыми метриками и трендами",
            fields: [
              { id: "topic", label: "Тема отчёта", placeholder: "Продажи за Q1 2026", type: "text", required: true },
              { id: "tables", label: "Таблицы/Источники", placeholder: "orders, users, products", type: "text", required: true },
              { id: "metrics", label: "Ключевые метрики", placeholder: "Выручка, средний чек, конверсия, retention", type: "textarea", required: true },
              { id: "period", label: "Период", placeholder: "01.01.2026 - 31.03.2026", type: "text", required: false },
              { id: "groupBy", label: "Группировка", placeholder: "По дням / неделям / месяцам / категориям", type: "text", required: false },
            ],
            promptTemplate: "Создай аналитический отчёт: {{topic}}. Таблицы: {{tables}}. Метрики: {{metrics}}. Период: {{period}}. Группировка: {{groupBy}}. Используй PostgreSQL MCP для: 1) Изучи структуру таблиц, 2) Напиши CTE-запросы с агрегацией, 3) Рассчитай метрики, 4) Покажи тренды и аномалии, 5) Сформулируй выводы и рекомендации.",
          },
          {
            id: "report-cohort",
            name: "Когортный анализ",
            description: "Анализ пользователей по когортам с retention",
            fields: [
              { id: "userTable", label: "Таблица пользователей", placeholder: "users", type: "text", required: true },
              { id: "eventTable", label: "Таблица событий", placeholder: "events / orders", type: "text", required: true },
              { id: "cohortField", label: "Поле когорты", placeholder: "created_at / registration_date", type: "text", required: true },
              { id: "period", label: "Период когорт", placeholder: "Помесячно за последние 6 месяцев", type: "text", required: false },
            ],
            promptTemplate: "Проведи когортный анализ. Пользователи: {{userTable}}, события: {{eventTable}}, когорта по: {{cohortField}}. Период: {{period}}. Используй PostgreSQL MCP: 1) Определи когорты по дате регистрации, 2) Рассчитай retention по неделям/месяцам, 3) Найди лучшие и худшие когорты, 4) Выяви паттерны оттока.",
          },
        ],
      },
      sortOrder: 12,
      agentId: "system-sql-agent",
    },
    {
      id: "tool-sql-optimize",
      name: "Оптимизация запроса",
      description: "Анализ и оптимизация медленного SQL",
      icon: "Lightbulb",
      iconColor: "#10B981",
      config: {
        prompt: "Помогу оптимизировать медленный SQL запрос. Вставь запрос и опиши проблему.",
        templates: [
          {
            id: "optimize-query",
            name: "Оптимизация SQL",
            description: "EXPLAIN ANALYZE + рекомендации по индексам и рефакторингу",
            fields: [
              { id: "sqlQuery", label: "SQL запрос", placeholder: "SELECT ... FROM ... WHERE ... JOIN ...", type: "textarea", required: true },
              { id: "problem", label: "Проблема", placeholder: "Запрос выполняется 15 секунд на 1M строк", type: "text", required: false },
              { id: "tableInfo", label: "Размер таблиц", placeholder: "orders: 2M строк, users: 500K строк", type: "text", required: false },
            ],
            promptTemplate: "Оптимизируй SQL запрос:\n```sql\n{{sqlQuery}}\n```\nПроблема: {{problem}}. Таблицы: {{tableInfo}}. Используй PostgreSQL MCP: 1) Выполни EXPLAIN ANALYZE, 2) Проанализируй план выполнения, 3) Предложи индексы, 4) Перепиши запрос если нужно (CTE, lateral join, materialized view), 5) Сравни производительность до/после.",
          },
        ],
      },
      sortOrder: 13,
      agentId: "system-sql-agent",
    },
    {
      id: "tool-sql-schema",
      name: "Проектирование схемы",
      description: "Спроектировать или доработать схему БД",
      icon: "ClipboardCheck",
      iconColor: "#10B981",
      config: {
        prompt: "Помогу спроектировать схему базы данных. Опиши предметную область.",
        templates: [
          {
            id: "schema-design",
            name: "Новая схема БД",
            description: "Проектирование таблиц, связей и индексов с нуля",
            fields: [
              { id: "domain", label: "Предметная область", placeholder: "E-commerce / CRM / SaaS / Образование", type: "text", required: true },
              { id: "entities", label: "Основные сущности", placeholder: "Пользователи, заказы, товары, платежи, отзывы", type: "textarea", required: true },
              { id: "requirements", label: "Требования", placeholder: "Мульти-тенантность, soft delete, аудит изменений", type: "textarea", required: false },
            ],
            promptTemplate: "Спроектируй схему PostgreSQL для: {{domain}}. Сущности: {{entities}}. Требования: {{requirements}}. Используй PostgreSQL MCP чтобы проверить существующие таблицы. Создай: 1) CREATE TABLE с правильными типами и constraints, 2) Связи (FK, junction tables), 3) Индексы для частых запросов, 4) Триггеры если нужно, 5) Миграцию для применения.",
          },
        ],
      },
      sortOrder: 14,
      agentId: "system-sql-agent",
    },

    // ── Веб-Исследователь ──
    {
      id: "tool-research-deep",
      name: "Глубокое исследование",
      description: "Комплексное исследование темы из множества источников",
      icon: "Globe",
      iconColor: "#06B6D4",
      config: {
        prompt: "Проведу глубокое исследование по теме. Укажи тему и глубину анализа.",
        templates: [
          {
            id: "research-topic",
            name: "Исследование темы",
            description: "Структурированное исследование с источниками и выводами",
            fields: [
              { id: "topic", label: "Тема", placeholder: "Тренды AI в здравоохранении 2026", type: "text", required: true },
              { id: "depth", label: "Глубина", placeholder: "Обзорное / Среднее / Глубокое с научными источниками", type: "text", required: false },
              { id: "language", label: "Язык источников", placeholder: "Русский и английский", type: "text", required: false },
              { id: "format", label: "Формат результата", placeholder: "Отчёт / Презентация / Сводка", type: "text", required: false },
            ],
            promptTemplate: "Проведи глубокое исследование темы: {{topic}}. Глубина: {{depth}}. Языки: {{language}}. Формат: {{format}}. Используй все доступные инструменты поиска. Структура: 1) Executive Summary, 2) Текущее состояние, 3) Ключевые игроки и тренды, 4) Данные и статистика, 5) Прогнозы экспертов, 6) Риски и вызовы, 7) Выводы и рекомендации. Каждый факт — со ссылкой на источник.",
          },
          {
            id: "research-comparison",
            name: "Сравнительный анализ",
            description: "Сравнение продуктов, технологий или подходов",
            fields: [
              { id: "items", label: "Что сравниваем", placeholder: "React vs Vue vs Svelte / AWS vs GCP vs Azure", type: "text", required: true },
              { id: "criteria", label: "Критерии сравнения", placeholder: "Цена, производительность, экосистема, learning curve", type: "textarea", required: true },
              { id: "context", label: "Контекст использования", placeholder: "Для стартапа с командой 5 человек", type: "text", required: false },
            ],
            promptTemplate: "Проведи сравнительный анализ: {{items}}. Критерии: {{criteria}}. Контекст: {{context}}. Используй поиск для актуальных данных. Результат: 1) Таблица сравнения по всем критериям, 2) Сильные/слабые стороны каждого, 3) Рекомендация с обоснованием для заданного контекста.",
          },
        ],
      },
      sortOrder: 15,
      agentId: "system-researcher-agent",
    },
    {
      id: "tool-research-factcheck",
      name: "Проверка фактов",
      description: "Верификация утверждений через множество источников",
      icon: "ShieldCheck",
      iconColor: "#06B6D4",
      config: {
        prompt: "Проверю достоверность утверждения. Что именно нужно проверить?",
        templates: [
          {
            id: "factcheck-claim",
            name: "Fact-check утверждения",
            description: "Проверка одного конкретного утверждения",
            fields: [
              { id: "claim", label: "Утверждение для проверки", placeholder: "Python — самый популярный язык программирования в 2026", type: "textarea", required: true },
              { id: "context", label: "Контекст/Источник", placeholder: "Из статьи на Habr от 01.2026", type: "text", required: false },
            ],
            promptTemplate: "Проверь достоверность утверждения: «{{claim}}». Контекст: {{context}}. Используй поиск для нахождения подтверждений и опровержений из авторитетных источников. Результат: 1) Вердикт (Правда / Частично правда / Ложь / Не подтверждено), 2) Доказательства ЗА, 3) Доказательства ПРОТИВ, 4) Контекст и нюансы, 5) Источники.",
          },
        ],
      },
      sortOrder: 16,
      agentId: "system-researcher-agent",
    },

    // ── QA Инженер ──
    {
      id: "tool-qa-testplan",
      name: "Тест-план",
      description: "Составить тест-план для веб-приложения",
      icon: "ClipboardCheck",
      iconColor: "#EF4444",
      config: {
        prompt: "Составлю тест-план. Укажи URL приложения и что нужно протестировать.",
        templates: [
          {
            id: "testplan-e2e",
            name: "E2E тест-план",
            description: "Полный план end-to-end тестирования",
            fields: [
              { id: "url", label: "URL приложения", placeholder: "https://app.example.com", type: "text", required: true },
              { id: "features", label: "Фичи для тестирования", placeholder: "Регистрация, логин, корзина, оплата, профиль", type: "textarea", required: true },
              { id: "devices", label: "Устройства", placeholder: "Desktop Chrome, Mobile Safari, Tablet", type: "text", required: false },
              { id: "priority", label: "Приоритеты", placeholder: "Критичные пути: регистрация → покупка → оплата", type: "text", required: false },
            ],
            promptTemplate: "Составь E2E тест-план для {{url}}. Фичи: {{features}}. Устройства: {{devices}}. Приоритеты: {{priority}}. Используй Playwright MCP для проверки доступности страниц. Для каждой фичи: 1) Позитивные сценарии, 2) Негативные сценарии, 3) Edge cases, 4) Accessibility чеки. Формат: ID | Сценарий | Шаги | Ожидаемый результат | Приоритет.",
          },
        ],
      },
      sortOrder: 17,
      agentId: "system-qa-agent",
    },
    {
      id: "tool-qa-bugreport",
      name: "Баг-репорт",
      description: "Оформить найденный баг с шагами воспроизведения",
      icon: "AlertTriangle",
      iconColor: "#EF4444",
      config: {
        prompt: "Помогу оформить баг-репорт. Опиши что произошло.",
        templates: [
          {
            id: "bugreport-standard",
            name: "Стандартный баг-репорт",
            description: "Структурированный отчёт о баге для Jira/GitHub Issues",
            fields: [
              { id: "title", label: "Заголовок бага", placeholder: "Кнопка 'Оплатить' не работает на мобильных", type: "text", required: true },
              { id: "url", label: "URL страницы", placeholder: "https://app.example.com/checkout", type: "text", required: true },
              { id: "steps", label: "Шаги воспроизведения", placeholder: "1. Открыть корзину\n2. Нажать Оформить заказ\n3. Заполнить форму\n4. Нажать Оплатить", type: "textarea", required: true },
              { id: "expected", label: "Ожидаемый результат", placeholder: "Переход на страницу оплаты", type: "text", required: true },
              { id: "actual", label: "Фактический результат", placeholder: "Ничего не происходит, в консоли TypeError", type: "text", required: true },
              { id: "severity", label: "Критичность", placeholder: "Critical / Major / Minor / Trivial", type: "text", required: false },
            ],
            promptTemplate: "Оформи баг-репорт. Заголовок: {{title}}. URL: {{url}}. Шаги: {{steps}}. Ожидалось: {{expected}}. Фактически: {{actual}}. Критичность: {{severity}}. Используй Playwright MCP чтобы: 1) Воспроизвести баг, 2) Сделать скриншот, 3) Проверить console errors. Оформи в формате: Summary, Environment, Steps, Expected/Actual, Screenshots, Console logs, Severity, Assignee suggestion.",
          },
        ],
      },
      sortOrder: 18,
      agentId: "system-qa-agent",
    },

    // ── Файловый Ассистент ──
    {
      id: "tool-file-organize",
      name: "Организация проекта",
      description: "Создать или реорганизовать файловую структуру проекта",
      icon: "FileText",
      iconColor: "#F59E0B",
      config: {
        prompt: "Помогу организовать файлы проекта. Опиши тип проекта и текущее состояние.",
        templates: [
          {
            id: "organize-project",
            name: "Структура проекта",
            description: "Оптимальная файловая структура для вашего стека",
            fields: [
              { id: "projectType", label: "Тип проекта", placeholder: "Next.js SaaS / Python ML / React Native app", type: "text", required: true },
              { id: "currentState", label: "Текущее состояние", placeholder: "Все файлы в корне / Запутанная структура / Начинаем с нуля", type: "text", required: true },
              { id: "features", label: "Основные модули", placeholder: "Auth, Dashboard, API, Tests, Docs", type: "textarea", required: false },
            ],
            promptTemplate: "Организуй файловую структуру проекта. Тип: {{projectType}}. Состояние: {{currentState}}. Модули: {{features}}. Используй Filesystem MCP чтобы увидеть текущую структуру. Создай: 1) Оптимальное дерево директорий, 2) Описание назначения каждой папки, 3) План перемещения файлов если реорганизация, 4) .gitignore и конфиги. Следуй best practices для данного стека.",
          },
        ],
      },
      sortOrder: 28,
      agentId: "system-filemanager-agent",
    },
  ];

  for (const t of specializedTools) {
    await prisma.tool.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        iconColor: t.iconColor,
        type: "PROMPT_TEMPLATE",
        config: t.config,
        isGlobal: true,
        isActive: true,
        sortOrder: t.sortOrder,
      },
    });

    // Link tool → agent
    await prisma.agentTool.upsert({
      where: { agentId_toolId: { agentId: t.agentId, toolId: t.id } },
      update: {},
      create: { agentId: t.agentId, toolId: t.id },
    });
  }

  console.log(`Specialized tools seeded: ${specializedTools.length} tools`);

  // ─── Cross-link additional MCP servers to agents ────────────────
  // Agents that benefit from multiple MCP servers

  const crossMcpLinks = [
    // GitHub Разработчик + Filesystem (read local code)
    { agentId: "system-github-agent", mcpServerId: "mcp-filesystem" },
    // SQL Аналитик + Filesystem (save reports)
    { agentId: "system-sql-agent", mcpServerId: "mcp-filesystem" },
    // QA Инженер + GitHub (create issues for bugs)
    { agentId: "system-qa-agent", mcpServerId: "mcp-github" },
  ];

  for (const link of crossMcpLinks) {
    await prisma.agentMcpServer.upsert({
      where: {
        agentId_mcpServerId: { agentId: link.agentId, mcpServerId: link.mcpServerId },
      },
      update: {},
      create: { agentId: link.agentId, mcpServerId: link.mcpServerId },
    });
  }

  console.log(`Cross-MCP links created: ${crossMcpLinks.length} additional links`);

  // ─── Migrate existing conversations to new agent IDs ─────
  try {
    const updated = await prisma.conversation.updateMany({
      where: { systemAgentId: "system-femida", agentId: null },
      data: { agentId: femidaAgent.id },
    });
    if (updated.count > 0) {
      console.log(`Migrated ${updated.count} Femida conversations to new agent ID`);
    }
  } catch {
    // Table may not have data yet
  }

  // ─── AI Providers ──────────────────────────────────────

  const moonshotProvider = await prisma.aiProvider.upsert({
    where: { slug: "moonshot" },
    update: {
      apiKey: process.env.MOONSHOT_API_KEY || "sk-placeholder",
    },
    create: {
      name: "Moonshot",
      slug: "moonshot",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKey: process.env.MOONSHOT_API_KEY || "sk-placeholder",
      isActive: true,
      priority: 10,
    },
  });

  const deepinfraProvider = await prisma.aiProvider.upsert({
    where: { slug: "deepinfra" },
    update: {
      apiKey: process.env.DEEPINFRA_API_KEY || "placeholder",
    },
    create: {
      name: "DeepInfra",
      slug: "deepinfra",
      baseUrl: "https://api.deepinfra.com/v1/openai",
      apiKey: process.env.DEEPINFRA_API_KEY || "placeholder",
      isActive: true,
      priority: 5,
    },
  });

  console.log("Providers seeded: Moonshot, DeepInfra");

  // ─── AI Models ─────────────────────────────────────────

  await prisma.aiModel.upsert({
    where: {
      providerId_modelId: {
        providerId: moonshotProvider.id,
        modelId: "kimi-k2.5",
      },
    },
    update: {
      temperature: 0.6,
      topP: 0.95,
      maxTokens: 8192,
      contextWindow: 131072,
      supportsThinking: true,
      maxThinkingTokens: 32768,
      costPer1kInput: 0.0002,
      costPer1kOutput: 0.0006,
    },
    create: {
      providerId: moonshotProvider.id,
      modelId: "kimi-k2.5",
      displayName: "Kimi K2.5",
      category: "TEXT",
      temperature: 0.6,
      topP: 0.95,
      maxTokens: 8192,
      contextWindow: 131072,
      supportsThinking: true,
      maxThinkingTokens: 32768,
      costPer1kInput: 0.0002,
      costPer1kOutput: 0.0006,
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.aiModel.upsert({
    where: {
      providerId_modelId: {
        providerId: deepinfraProvider.id,
        modelId: "black-forest-labs/FLUX-1-schnell",
      },
    },
    update: {},
    create: {
      providerId: deepinfraProvider.id,
      modelId: "black-forest-labs/FLUX-1-schnell",
      displayName: "Flux Schnell",
      category: "IMAGE",
      costPer1kInput: 0,
      costPer1kOutput: 0,
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.aiModel.upsert({
    where: {
      providerId_modelId: {
        providerId: deepinfraProvider.id,
        modelId: "Qwen/Qwen-Image-Edit",
      },
    },
    update: {},
    create: {
      providerId: deepinfraProvider.id,
      modelId: "Qwen/Qwen-Image-Edit",
      displayName: "Qwen Image Edit",
      category: "IMAGE",
      costPer1kInput: 0,
      costPer1kOutput: 0,
      isActive: true,
      isDefault: false,
    },
  });

  console.log(
    "Models seeded: Kimi K2.5 (TEXT), Flux Schnell (IMAGE), Qwen Image Edit (IMAGE)"
  );

  // ─── Link models to plans ─────────────────────────────

  const allModels = await prisma.aiModel.findMany({ select: { id: true } });
  const allPlans = await prisma.plan.findMany({ select: { id: true } });

  for (const plan of allPlans) {
    for (const model of allModels) {
      await prisma.planModel.upsert({
        where: {
          planId_modelId: { planId: plan.id, modelId: model.id },
        },
        update: {},
        create: { planId: plan.id, modelId: model.id },
      });
    }
  }

  console.log("Plan-model links created");

  // ─── Built-in Skills ───────────────────────────────────

  const builtInSkills = [
    {
      name: "Анализ документа",
      description:
        "Детальный анализ документа: структура, ключевые пункты, риски и рекомендации",
      systemPrompt: `Ты — эксперт по анализу документов. При анализе:
1. Определи тип и структуру документа
2. Выдели ключевые пункты и условия
3. Выяви потенциальные риски и противоречия
4. Проверь полноту и непротиворечивость
5. Предложи конкретные улучшения
6. Дай общую оценку качества документа`,
      icon: "FileSearch",
      iconColor: "#4F6EF7",
    },
    {
      name: "Генерация кода",
      description:
        "Написание, отладка и оптимизация кода на любых языках программирования",
      systemPrompt: `Ты — эксперт-программист. При работе с кодом:
1. Пиши чистый, читаемый код с комментариями
2. Следуй best practices и паттернам языка
3. Обрабатывай крайние случаи и ошибки
4. Оптимизируй по производительности где уместно
5. Предлагай тесты для критических функций
6. Объясняй логику сложных участков`,
      icon: "Code",
      iconColor: "#10B981",
    },
    {
      name: "Создание контента",
      description:
        "Написание текстов, статей, постов, маркетинговых материалов",
      systemPrompt: `Ты — эксперт по созданию контента. При написании:
1. Учитывай целевую аудиторию и контекст
2. Структурируй текст логично с заголовками
3. Используй убедительный и вовлекающий стиль
4. Адаптируй тон под задачу (формальный, разговорный, экспертный)
5. Оптимизируй под SEO если уместно
6. Предлагай варианты заголовков и CTA`,
      icon: "MessageSquare",
      iconColor: "#7C3AED",
    },
    {
      name: "Анализ данных",
      description:
        "Обработка и анализ данных из таблиц, CSV, отчётов",
      systemPrompt: `Ты — аналитик данных. При анализе:
1. Определи структуру и качество данных
2. Выяви ключевые тренды и паттерны
3. Рассчитай основные статистические показатели
4. Визуализируй данные где уместно (описывай графики)
5. Выяви аномалии и выбросы
6. Сформулируй actionable выводы и рекомендации`,
      icon: "BarChart3",
      iconColor: "#F59E0B",
    },
  ];

  for (const skillData of builtInSkills) {
    const existing = await prisma.skill.findFirst({
      where: { name: skillData.name, isBuiltIn: true },
    });
    if (!existing) {
      await prisma.skill.create({
        data: { ...skillData, isBuiltIn: true, isPublic: true },
      });
    }
  }

  console.log(`Built-in skills seeded: ${builtInSkills.length} skills`);
  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
