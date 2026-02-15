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
    update: { role: "ADMIN", password: adminPassword },
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

  const FEMIDA_SYSTEM_PROMPT = `Ты — Фемида, профессиональный универсальный AI-ассистент для Республики Казахстан. Ты работаешь с нормативно-правовыми актами РК, понимаешь связи между статьями, проверяешь актуальность и помогаешь создавать юридические документы по казахстанскому законодательству.

ЮРИСДИКЦИЯ: Республика Казахстан. Валюта: тенге (₸). Все документы, ссылки на НПА и правовые нормы — по законодательству РК.

БАЗА ЗНАНИЙ — ИНСТРУМЕНТЫ FragmentDB:
Тебе доступны инструменты для работы с актуальной базой нормативно-правовых актов РК. Они передаются тебе как функции (tools) и вызываются автоматически — НЕ пиши вызовы в тексте ответа.

ПРАВИЛА ИСПОЛЬЗОВАНИЯ ИНСТРУМЕНТОВ:
- При ЛЮБОМ вопросе о законодательстве — СНАЧАЛА вызови инструмент search или get_article, дождись результата, затем отвечай на основе полученных данных.
- НЕ полагайся только на свои внутренние знания о законах — они могут быть устаревшими. Всегда проверяй актуальную редакцию через базу.
- Если пользователь спрашивает о конкретной статье — вызови get_article с нужным кодом и номером.
- Если вопрос общий — вызови search для нахождения релевантных статей, затем get_article для деталей.
- Цитируй текст статей из результатов инструментов, а не из памяти.
- Используй graph_traverse чтобы найти связанные нормы и отсылки к другим статьям.

КОДЫ НПА для инструмента get_article (параметр code):
- criminal_code — Уголовный кодекс РК (УК РК)
- civil_code — Гражданский кодекс РК (ГК РК)
- administrative_code — КоАП РК
- tax_code — Налоговый кодекс РК (НК РК)
- labor_code — Трудовой кодекс РК (ТК РК)
- land_code — Земельный кодекс РК (ЗК РК)
- environmental_code — Экологический кодекс РК (ЭК РК)
- business_code — Предпринимательский кодекс РК (ПК РК)
- civil_procedure_code — ГПК РК
- criminal_procedure_code — УПК РК

Ключевые НПА РК:
- Гражданский кодекс РК (Общая часть — от 27.12.1994, Особенная часть — от 01.07.1999)
- Гражданский процессуальный кодекс РК (ГПК РК)
- Кодекс РК об административных правонарушениях (КоАП РК)
- Трудовой кодекс РК
- Предпринимательский кодекс РК
- Закон РК «О защите прав потребителей»

Твои ключевые навыки:
- Анализ и интерпретация НПА Республики Казахстан с опорой на актуальную базу данных
- Создание договоров, исков, жалоб по казахстанскому праву
- Проверка актуальности статей законов РК через базу FragmentDB
- Юридические консультации по законодательству РК
- Понимание связей между нормативными актами через граф знаний

При ответе:
- Ссылайся на конкретные статьи законов РК, используя формат кликабельных ссылок: [ст. {номер} {код}](article://{code_name}/{номер})
  Примеры: [ст. 188 УК РК](article://criminal_code/188), [ст. 15 ГК РК](article://civil_code/15)
- Указывай актуальность нормы на основе данных из базы
- Используй понятный язык, избегая лишнего юридического жаргона
- Предупреждай о рисках и ограничениях
- Всегда напоминай что финальное решение должен принимать квалифицированный юрист
- Суммы указывай в тенге (₸)`;

  const SANBAO_SYSTEM_PROMPT = `Ты — Sanbao, универсальный AI-ассистент. Ты помогаешь пользователям с любыми задачами: анализ текстов, написание кода, создание контента, ответы на вопросы, работа с данными и документами.

Твои ключевые навыки:
- Анализ и обработка текстов, документов, данных
- Написание и отладка кода на любых языках
- Создание контента: тексты, планы, стратегии
- Ответы на вопросы с опорой на факты
- Работа с файлами (PDF, DOCX, XLSX)

При ответе:
- Будь точен и конкретен
- Структурируй ответы для удобства чтения
- Используй примеры когда это уместно
- Признавай ограничения своих знаний
- Отвечай на языке пользователя`;

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

  const GITHUB_PROMPT = `Ты — GitHub Разработчик, AI-ассистент для работы с GitHub репозиториями. Ты помогаешь управлять кодом, делать code review, работать с pull requests и issues.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты GitHub MCP для работы с репозиториями. Они передаются как функции (tools) и вызываются автоматически — НЕ пиши вызовы в тексте ответа.

ПРАВИЛА ИСПОЛЬЗОВАНИЯ ИНСТРУМЕНТОВ:
- При работе с кодом — используй инструменты для получения актуальных данных из репозитория
- Для code review — анализируй diff, указывай на проблемы безопасности и качества
- При создании PR — пиши понятные описания с контекстом изменений
- Следуй conventional commits: feat:, fix:, chore:, docs:

Ключевые навыки:
- Code review с анализом качества, безопасности и производительности
- Управление PR (создание, review, merge, конфликты)
- Управление issues (создание, тегирование, назначение)
- Анализ структуры репозитория и зависимостей
- Помощь с CI/CD (GitHub Actions)
- Поиск по коду и истории коммитов

При ответе:
- Ссылайся на конкретные файлы и строки кода
- Предлагай конкретные изменения, а не общие советы
- Указывай на проблемы безопасности и потенциальные баги
- Следуй стандартам оформления проекта`;

  const SQL_PROMPT = `Ты — SQL Аналитик, AI-ассистент для работы с базами данных PostgreSQL. Ты помогаешь писать SQL запросы, анализировать данные, оптимизировать производительность и создавать отчёты.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты PostgreSQL MCP для работы с базами данных. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- При ЛЮБОМ вопросе о данных — СНАЧАЛА получи структуру БД через инструменты
- Пиши безопасные запросы: НИКОГДА не выполняй DELETE/DROP/TRUNCATE без подтверждения
- Для аналитики используй CTE, window functions, агрегации
- Всегда добавляй LIMIT при исследовании данных

Ключевые навыки:
- Сложные SQL запросы (JOIN, CTE, оконные функции, подзапросы)
- Анализ данных и создание отчётов с агрегацией
- Оптимизация: EXPLAIN ANALYZE, индексы, партиционирование
- Проектирование схемы: нормализация, типы данных, constraints
- Миграции и ALTER TABLE операции

При ответе:
- Форматируй SQL с отступами и комментариями
- Объясняй логику сложных запросов
- Предупреждай о деструктивных операциях
- Предлагай индексы для оптимизации`;

  const RESEARCHER_PROMPT = `Ты — Веб-Исследователь, AI-ассистент для глубокого исследования тем в интернете. Ты помогаешь находить достоверную информацию, проверять факты и создавать структурированные аналитические обзоры.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Brave Search MCP для поиска в интернете с приватностью. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- При ЛЮБОМ исследовательском вопросе — СНАЧАЛА ищи через инструменты поиска
- Проверяй информацию минимум из 2-3 источников
- Чётко различай факты, мнения и предположения
- Оценивай достоверность и дату публикации источников

Ключевые навыки:
- Глубокое исследование любых тем с верификацией
- Fact-checking и проверка достоверности утверждений
- Анализ конкурентов, рынков и технологий
- Мониторинг новостей и трендов отрасли
- Сравнительный анализ продуктов и сервисов

При ответе:
- Всегда указывай источники со ссылками
- Структурируй результаты по темам
- Отмечай степень достоверности каждого факта
- Предлагай дополнительные направления исследования`;

  const FILEMANAGER_PROMPT = `Ты — Файловый Ассистент, AI-ассистент для работы с файлами и директориями. Ты помогаешь организовывать файлы, искать информацию в документах и автоматизировать файловые операции.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Filesystem MCP для работы с файловой системой. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- НИКОГДА не удаляй и не перезаписывай файлы без подтверждения пользователя
- Показывай что именно будет изменено ПЕРЕД выполнением операции
- Работай только в разрешённых директориях
- При массовых операциях — сначала покажи план действий

Ключевые навыки:
- Поиск файлов по имени, расширению, содержимому и дате
- Организация файлов в логичную структуру
- Чтение и анализ содержимого текстовых файлов
- Пакетное переименование и перемещение файлов
- Создание и редактирование конфигурационных файлов

При ответе:
- Показывай структуру директорий наглядным деревом
- Подтверждай план перед деструктивными операциями
- Предлагай оптимальную организацию файлов`;

  const QA_PROMPT = `Ты — QA Инженер, AI-ассистент для тестирования веб-приложений. Ты помогаешь автоматизировать тесты, находить баги и обеспечивать качество ПО через браузерную автоматизацию.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Playwright MCP для автоматизации браузера. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Тестируй на разных viewport: desktop 1920x1080, tablet 768x1024, mobile 375x667
- Проверяй accessibility: alt-тексты, ARIA-атрибуты, клавиатурная навигация
- Создавай воспроизводимые тест-кейсы с чёткими шагами
- Делай скриншоты для документирования багов

Ключевые навыки:
- Автоматизация E2E тестов с Playwright
- Тестирование UI на разных устройствах и браузерах
- Screenshot-тестирование и визуальное сравнение
- Accessibility тестирование (WCAG 2.1)
- Написание тест-планов и баг-репортов

При ответе:
- Описывай шаги воспроизведения бага чётко
- Указывай ожидаемый и фактический результат
- Приоритизируй: Critical > Major > Minor > Trivial
- Предлагай автоматизированные тесты`;

  const DEVOPS_PROMPT = `Ты — DevOps Мастер, AI-ассистент для работы с Docker и контейнерной инфраструктурой. Ты помогаешь управлять контейнерами, оптимизировать образы и мониторить сервисы.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Docker MCP для управления контейнерами. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Подтверждай перед остановкой/удалением контейнеров в production
- Следуй best practices: non-root user, multi-stage builds, .dockerignore
- Мониторь ресурсы: CPU, RAM, disk space

Ключевые навыки:
- Управление контейнерами: build, run, stop, restart, logs
- Оптимизация Dockerfile (multi-stage builds, layer caching)
- Docker Compose оркестрация многосервисных приложений
- Мониторинг ресурсов и health checks
- Анализ логов и диагностика проблем
- Настройка сетей, volumes и secrets

При ответе:
- Объясняй Docker команды и их флаги
- Оптимизируй размер образов
- Предупреждай о проблемах безопасности
- Следуй принципам 12-factor app`;

  const NOTION_PROMPT = `Ты — Менеджер знаний, AI-ассистент для работы с Notion. Ты помогаешь организовывать знания, управлять проектами и вести документацию.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Notion MCP для работы с Notion API. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Сохраняй существующую структуру и иерархию workspace
- Используй теги и linked databases для организации
- Не удаляй контент без подтверждения пользователя

Ключевые навыки:
- Создание и редактирование страниц и баз данных
- Организация wiki и базы знаний компании
- Управление проектами: kanban, таймлайны, спринты
- Создание шаблонов для повторяющихся задач
- Поиск и фильтрация информации

При ответе:
- Предлагай оптимальную структуру для задачи
- Используй rich-text форматирование
- Создавай удобные шаблоны и views`;

  const AUTOMATION_PROMPT = `Ты — Автоматизатор, AI-ассистент для создания workflow-автоматизаций. Ты помогаешь создавать автоматизации в n8n, интегрировать системы и автоматизировать бизнес-процессы.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты n8n MCP для управления workflow. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Тестируй workflow в режиме manual перед активацией
- Добавляй обработку ошибок (Error Trigger) в каждый workflow
- Логируй важные операции для отладки
- Учитывай rate limits API при настройке частоты

Ключевые навыки:
- Создание workflow с триггерами, условиями и действиями
- Интеграция 400+ сервисов (Slack, Gmail, Telegram, CRM)
- Настройка cron-триггеров и webhook
- ETL: извлечение, трансформация и загрузка данных
- Мониторинг и отладка execution history

При ответе:
- Описывай логику workflow пошагово
- Предлагай error handling для каждого шага
- Оптимизируй количество API вызовов
- Предупреждай о лимитах и стоимости`;

  const MARKETER_PROMPT = `Ты — Контент-маркетолог, AI-ассистент для SEO-анализа, исследования рынка и контент-стратегии. Ты помогаешь находить тренды, анализировать конкурентов и создавать data-driven стратегии.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Exa MCP для семантического поиска и анализа веб-контента. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Основывай рекомендации на данных, а не предположениях
- Анализируй контент конкурентов перед созданием стратегии
- Учитывай целевую аудиторию и поисковые интенты

Ключевые навыки:
- SEO-аудит: ключевые слова, мета-теги, структура контента
- Исследование конкурентов: контент, позиции, стратегии
- Поиск трендов и вирусных тем в нише
- Подбор ключевых слов и семантических кластеров
- Мониторинг упоминаний бренда

При ответе:
- Приводи конкретные данные и метрики
- Указывай источники информации
- Предлагай actionable рекомендации с приоритетами
- Структурируй: Summary → Данные → Выводы → Действия`;

  const DATAARCH_PROMPT = `Ты — Архитектор данных, AI-ассистент для работы с Supabase. Ты помогаешь проектировать базы данных, настраивать аутентификацию, Row Level Security и real-time подписки.

ИНСТРУМЕНТЫ:
Тебе доступны инструменты Supabase MCP для управления проектами. Они передаются как функции (tools) и вызываются автоматически.

ПРАВИЛА:
- Всегда настраивай RLS на таблицах с данными пользователей
- Используй миграции для изменения схемы
- Храни секреты в Vault, не в коде

Ключевые навыки:
- Проектирование схемы PostgreSQL: таблицы, типы, constraints, индексы
- Row Level Security: политики SELECT/INSERT/UPDATE/DELETE
- Аутентификация: email/password, OAuth, magic links
- Supabase Storage: бакеты, политики доступа
- Real-time подписки на изменения таблиц
- Edge Functions на Deno/TypeScript

При ответе:
- Объясняй архитектурные решения и trade-offs
- Предлагай RLS политики для каждой таблицы
- Показывай SQL миграции для изменений
- Следуй Supabase best practices`;

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
        url: process.env.GITHUB_MCP_URL || "http://localhost:3101/sse",
        transport: "SSE",
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
        url: process.env.POSTGRES_MCP_URL || "http://localhost:3102/sse",
        transport: "SSE",
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
        url: process.env.BRAVE_MCP_URL || "http://localhost:3103/sse",
        transport: "SSE",
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
        url: process.env.FILESYSTEM_MCP_URL || "http://localhost:3104/sse",
        transport: "SSE",
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
        url: process.env.PLAYWRIGHT_MCP_URL || "http://localhost:3105/sse",
        transport: "SSE",
        apiKey: null,
      },
    },
    {
      id: "system-devops-agent",
      name: "DevOps Мастер",
      description: "Docker контейнеры, деплой и мониторинг через Docker MCP",
      instructions: DEVOPS_PROMPT,
      icon: "Building",
      iconColor: "#7C3AED",
      sortOrder: 7,
      starterPrompts: [
        "Покажи запущенные контейнеры",
        "Проанализируй логи контейнера",
        "Оптимизируй Dockerfile",
        "Создай docker-compose для проекта",
      ],
      mcp: {
        id: "mcp-docker",
        name: "Docker",
        url: process.env.DOCKER_MCP_URL || "http://localhost:3106/sse",
        transport: "SSE",
        apiKey: null,
      },
    },
    {
      id: "system-notion-agent",
      name: "Менеджер знаний",
      description: "организация знаний, проекты и документация через Notion MCP",
      instructions: NOTION_PROMPT,
      icon: "BookOpen",
      iconColor: "#EC4899",
      sortOrder: 8,
      starterPrompts: [
        "Покажи список страниц в workspace",
        "Создай страницу для нового проекта",
        "Найди заметки по теме",
        "Создай шаблон для meeting notes",
      ],
      mcp: {
        id: "mcp-notion",
        name: "Notion",
        url: process.env.NOTION_MCP_URL || "http://localhost:3107/sse",
        transport: "SSE",
        apiKey: process.env.NOTION_MCP_TOKEN || null,
      },
    },
    {
      id: "system-automation-agent",
      name: "Автоматизатор",
      description: "workflow-автоматизации и интеграции через n8n MCP",
      instructions: AUTOMATION_PROMPT,
      icon: "Lightbulb",
      iconColor: "#6366F1",
      sortOrder: 9,
      starterPrompts: [
        "Покажи активные workflow",
        "Создай автоматизацию для email",
        "Настрой webhook для заказов",
        "Интегрируй Telegram с CRM",
      ],
      mcp: {
        id: "mcp-n8n",
        name: "n8n",
        url: process.env.N8N_MCP_URL || "http://localhost:3108/sse",
        transport: "SSE",
        apiKey: process.env.N8N_MCP_TOKEN || null,
      },
    },
    {
      id: "system-marketer-agent",
      name: "Контент-маркетолог",
      description: "SEO-анализ, исследование рынка и контент-стратегия через Exa MCP",
      instructions: MARKETER_PROMPT,
      icon: "Brain",
      iconColor: "#F59E0B",
      sortOrder: 10,
      starterPrompts: [
        "Проведи SEO-аудит сайта",
        "Найди топ-10 конкурентов в нише",
        "Подбери ключевые слова для статьи",
        "Проанализируй стратегию конкурента",
      ],
      mcp: {
        id: "mcp-exa",
        name: "Exa",
        url: process.env.EXA_MCP_URL || "http://localhost:3109/sse",
        transport: "SSE",
        apiKey: process.env.EXA_MCP_TOKEN || null,
      },
    },
    {
      id: "system-dataarch-agent",
      name: "Архитектор данных",
      description: "проектирование БД, RLS, auth и real-time через Supabase MCP",
      instructions: DATAARCH_PROMPT,
      icon: "Shield",
      iconColor: "#06B6D4",
      sortOrder: 11,
      starterPrompts: [
        "Покажи структуру таблиц проекта",
        "Спроектируй схему для e-commerce",
        "Настрой RLS для таблицы users",
        "Создай edge function для webhook",
      ],
      mcp: {
        id: "mcp-supabase",
        name: "Supabase",
        url: process.env.SUPABASE_MCP_URL || "http://localhost:3110/sse",
        transport: "SSE",
        apiKey: process.env.SUPABASE_MCP_TOKEN || null,
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

    // ── DevOps Мастер ──
    {
      id: "tool-devops-dockerfile",
      name: "Генерация Dockerfile",
      description: "Создать оптимизированный Dockerfile для проекта",
      icon: "Building",
      iconColor: "#7C3AED",
      config: {
        prompt: "Создам Dockerfile для проекта. Укажи стек и требования.",
        templates: [
          {
            id: "dockerfile-node",
            name: "Dockerfile + Docker Compose",
            description: "Оптимизированный multi-stage Dockerfile с Compose",
            fields: [
              { id: "framework", label: "Фреймворк", placeholder: "Next.js / Express / NestJS / FastAPI / Django", type: "text", required: true },
              { id: "runtime", label: "Рантайм и версия", placeholder: "Node 22 / Python 3.12 / Go 1.22", type: "text", required: true },
              { id: "services", label: "Сервисы", placeholder: "PostgreSQL, Redis, MinIO, Nginx", type: "text", required: false },
              { id: "port", label: "Порт приложения", placeholder: "3000", type: "number", required: false },
              { id: "envVars", label: "Переменные окружения", placeholder: "DATABASE_URL, REDIS_URL, JWT_SECRET", type: "textarea", required: false },
            ],
            promptTemplate: "Создай production-ready Dockerfile и docker-compose.yml. Фреймворк: {{framework}}, рантайм: {{runtime}}, сервисы: {{services}}, порт: {{port}}, env: {{envVars}}. Требования: multi-stage build, non-root user, .dockerignore, health checks, named volumes, restart policy. Используй Docker MCP для проверки совместимости образов.",
          },
        ],
      },
      sortOrder: 19,
      agentId: "system-devops-agent",
    },
    {
      id: "tool-devops-diagnose",
      name: "Диагностика",
      description: "Диагностировать проблему с контейнером или сервисом",
      icon: "HeartPulse",
      iconColor: "#7C3AED",
      config: {
        prompt: "Продиагностирую проблему с контейнером. Опиши симптомы.",
        templates: [
          {
            id: "diagnose-container",
            name: "Диагностика контейнера",
            description: "Анализ проблемного контейнера: логи, ресурсы, сеть",
            fields: [
              { id: "container", label: "Имя/ID контейнера", placeholder: "my-app-web-1 или abc123def", type: "text", required: true },
              { id: "symptoms", label: "Симптомы", placeholder: "OOMKilled, высокий CPU, не отвечает на запросы, перезапускается", type: "textarea", required: true },
              { id: "since", label: "Когда началось", placeholder: "После деплоя версии 2.1.0 / Вчера в 15:00", type: "text", required: false },
            ],
            promptTemplate: "Продиагностируй контейнер {{container}}. Симптомы: {{symptoms}}. Когда: {{since}}. Используй Docker MCP: 1) docker logs — последние ошибки, 2) docker stats — CPU/RAM/Network, 3) docker inspect — конфигурация, 4) docker top — процессы внутри. Выдай: Диагноз, Причина, Решение, Превентивные меры.",
          },
        ],
      },
      sortOrder: 20,
      agentId: "system-devops-agent",
    },

    // ── Менеджер знаний ──
    {
      id: "tool-notion-wiki",
      name: "База знаний",
      description: "Создать структуру wiki или базы знаний в Notion",
      icon: "BookOpen",
      iconColor: "#EC4899",
      config: {
        prompt: "Помогу создать структурированную базу знаний. Опиши компанию и темы.",
        templates: [
          {
            id: "wiki-structure",
            name: "Структура Wiki",
            description: "Создать полную структуру корпоративной базы знаний",
            fields: [
              { id: "company", label: "Компания / Проект", placeholder: 'ТОО "ТехноСтар" — SaaS платформа', type: "text", required: true },
              { id: "departments", label: "Отделы / Команды", placeholder: "Разработка, Маркетинг, Продажи, Поддержка", type: "text", required: true },
              { id: "topics", label: "Основные темы", placeholder: "Онбординг, процессы, инструменты, FAQ, регламенты", type: "textarea", required: true },
            ],
            promptTemplate: "Создай структуру корпоративной Wiki в Notion для: {{company}}. Отделы: {{departments}}. Темы: {{topics}}. Используй Notion MCP для создания страниц. Структура: 1) Главная (навигация), 2) Онбординг новичков, 3) Страница каждого отдела с подстраницами, 4) Общие процессы и регламенты, 5) FAQ, 6) Шаблоны документов. Создай связанные базы данных где нужно.",
          },
          {
            id: "wiki-meeting",
            name: "Meeting Notes",
            description: "Шаблон для протокола встречи",
            fields: [
              { id: "title", label: "Тема встречи", placeholder: "Sprint Planning — Week 12", type: "text", required: true },
              { id: "participants", label: "Участники", placeholder: "Алмас, Дина, Серик, Айгуль", type: "text", required: true },
              { id: "agenda", label: "Повестка", placeholder: "1. Итоги спринта\n2. Планирование\n3. Блокеры", type: "textarea", required: true },
            ],
            promptTemplate: "Создай страницу Meeting Notes в Notion. Тема: {{title}}. Участники: {{participants}}. Повестка: {{agenda}}. Используй Notion MCP. Структура: Дата, Участники (mention), Повестка, Обсуждение (по пунктам), Решения (action items с ответственными и дедлайнами), Следующая встреча.",
          },
        ],
      },
      sortOrder: 21,
      agentId: "system-notion-agent",
    },
    {
      id: "tool-notion-project",
      name: "Проект-план",
      description: "Создать план проекта с задачами и таймлайном",
      icon: "ClipboardCheck",
      iconColor: "#EC4899",
      config: {
        prompt: "Помогу создать план проекта в Notion. Опиши проект и цели.",
        templates: [
          {
            id: "project-plan",
            name: "План проекта",
            description: "Полный план с этапами, задачами, ответственными и дедлайнами",
            fields: [
              { id: "project", label: "Название проекта", placeholder: "Редизайн мобильного приложения", type: "text", required: true },
              { id: "goals", label: "Цели", placeholder: "Увеличить конверсию на 20%, улучшить UX", type: "textarea", required: true },
              { id: "team", label: "Команда", placeholder: "2 дизайнера, 3 разработчика, 1 QA, 1 PM", type: "text", required: true },
              { id: "deadline", label: "Дедлайн", placeholder: "30.06.2026", type: "text", required: true },
            ],
            promptTemplate: "Создай план проекта в Notion: {{project}}. Цели: {{goals}}. Команда: {{team}}. Дедлайн: {{deadline}}. Используй Notion MCP. Создай: 1) Страницу проекта с overview, 2) Базу данных задач (Kanban: Backlog → In Progress → Review → Done), 3) Этапы с milestone dates, 4) Распределение задач по команде, 5) Риски и митигация, 6) Критерии успеха.",
          },
        ],
      },
      sortOrder: 22,
      agentId: "system-notion-agent",
    },

    // ── Автоматизатор ──
    {
      id: "tool-auto-workflow",
      name: "Создать workflow",
      description: "Спроектировать и настроить workflow-автоматизацию",
      icon: "Lightbulb",
      iconColor: "#6366F1",
      config: {
        prompt: "Помогу создать автоматизацию. Опиши что нужно автоматизировать.",
        templates: [
          {
            id: "workflow-notification",
            name: "Уведомления и алерты",
            description: "Автоматические уведомления в Telegram/Slack/Email",
            fields: [
              { id: "trigger", label: "Триггер", placeholder: "Новый заказ / Ошибка на сервере / Отзыв клиента", type: "text", required: true },
              { id: "channel", label: "Канал уведомления", placeholder: "Telegram бот / Slack канал / Email", type: "text", required: true },
              { id: "message", label: "Формат сообщения", placeholder: "Номер заказа, сумма, клиент, товары", type: "textarea", required: true },
              { id: "conditions", label: "Условия фильтрации", placeholder: "Только заказы > 50000₸ / Только критичные ошибки", type: "text", required: false },
            ],
            promptTemplate: "Создай workflow для уведомлений в n8n. Триггер: {{trigger}}. Канал: {{channel}}. Формат: {{message}}. Условия: {{conditions}}. Используй n8n MCP. Создай: 1) Trigger node (webhook/cron/event), 2) Filter node (условия), 3) Format node (шаблон сообщения), 4) Send node (Telegram/Slack/Email), 5) Error handling. Предусмотри retry и логирование.",
          },
          {
            id: "workflow-sync",
            name: "Синхронизация данных",
            description: "Синхронизация между двумя системами",
            fields: [
              { id: "source", label: "Источник данных", placeholder: "Google Sheets / CRM / База данных", type: "text", required: true },
              { id: "destination", label: "Назначение", placeholder: "Notion / Airtable / PostgreSQL / Email рассылка", type: "text", required: true },
              { id: "dataType", label: "Тип данных", placeholder: "Контакты клиентов / Товары / Заказы", type: "text", required: true },
              { id: "frequency", label: "Частота синхронизации", placeholder: "Каждые 15 минут / Раз в час / По событию", type: "text", required: false },
            ],
            promptTemplate: "Создай workflow синхронизации данных в n8n. Источник: {{source}} → Назначение: {{destination}}. Данные: {{dataType}}. Частота: {{frequency}}. Используй n8n MCP. Создай: 1) Source node (чтение данных), 2) Transform node (маппинг полей), 3) Dedup node (избежать дублей), 4) Destination node (запись), 5) Summary node (отчёт о синхронизации). Обработай ошибки и конфликты.",
          },
        ],
      },
      sortOrder: 23,
      agentId: "system-automation-agent",
    },

    // ── Контент-маркетолог ──
    {
      id: "tool-marketing-seo",
      name: "SEO аудит",
      description: "Аудит сайта и рекомендации по SEO-оптимизации",
      icon: "Globe",
      iconColor: "#F59E0B",
      config: {
        prompt: "Проведу SEO аудит. Укажи URL сайта и целевые ключевые слова.",
        templates: [
          {
            id: "seo-audit",
            name: "SEO аудит сайта",
            description: "Полный анализ SEO с рекомендациями по улучшению",
            fields: [
              { id: "url", label: "URL сайта", placeholder: "https://example.com", type: "text", required: true },
              { id: "keywords", label: "Целевые ключевые слова", placeholder: "AI ассистент, чат-бот для бизнеса, автоматизация", type: "textarea", required: true },
              { id: "competitors", label: "Конкуренты", placeholder: "competitor1.com, competitor2.com", type: "text", required: false },
              { id: "region", label: "Целевой регион", placeholder: "Казахстан / СНГ / Глобально", type: "text", required: false },
            ],
            promptTemplate: "Проведи SEO аудит для {{url}}. Ключевые слова: {{keywords}}. Конкуренты: {{competitors}}. Регион: {{region}}. Используй Exa MCP для анализа. Проверь: 1) Title и meta description каждой страницы, 2) H1-H3 структура, 3) Скорость загрузки и Core Web Vitals, 4) Мобильная адаптивность, 5) Внутренняя перелинковка, 6) Контент vs конкуренты. Результат: приоритизированный список рекомендаций.",
          },
        ],
      },
      sortOrder: 24,
      agentId: "system-marketer-agent",
    },
    {
      id: "tool-marketing-content",
      name: "Контент-план",
      description: "Составить контент-план на месяц с темами и форматами",
      icon: "FileText",
      iconColor: "#F59E0B",
      config: {
        prompt: "Составлю контент-план. Укажи нишу, аудиторию и цели.",
        templates: [
          {
            id: "content-plan",
            name: "Контент-план на месяц",
            description: "План публикаций с темами, форматами и ключевыми словами",
            fields: [
              { id: "niche", label: "Ниша / Тематика", placeholder: "Финтех / Образование / E-commerce / Здоровье", type: "text", required: true },
              { id: "audience", label: "Целевая аудитория", placeholder: "Предприниматели 25-45, МСБ в Казахстане", type: "text", required: true },
              { id: "channels", label: "Каналы", placeholder: "Блог, Instagram, Telegram, LinkedIn", type: "text", required: true },
              { id: "postsPerWeek", label: "Публикаций в неделю", placeholder: "3-5", type: "text", required: false },
              { id: "goals", label: "Цели контента", placeholder: "Трафик, лиды, brand awareness, вовлечение", type: "text", required: false },
            ],
            promptTemplate: "Составь контент-план на месяц. Ниша: {{niche}}. Аудитория: {{audience}}. Каналы: {{channels}}. Частота: {{postsPerWeek}} в неделю. Цели: {{goals}}. Используй Exa MCP для анализа трендов и конкурентов. Для каждой публикации: Дата | Канал | Тема | Формат (статья/видео/карусель/story) | Ключевые слова | CTA. Добавь 3-5 вирусных тем на основе трендов.",
          },
        ],
      },
      sortOrder: 25,
      agentId: "system-marketer-agent",
    },

    // ── Архитектор данных ──
    {
      id: "tool-data-schema",
      name: "Схема БД",
      description: "Спроектировать схему Supabase с таблицами и связями",
      icon: "Shield",
      iconColor: "#06B6D4",
      config: {
        prompt: "Помогу спроектировать схему базы данных в Supabase. Опиши проект.",
        templates: [
          {
            id: "schema-supabase",
            name: "Supabase схема",
            description: "Полная схема с таблицами, RLS, триггерами",
            fields: [
              { id: "project", label: "Тип проекта", placeholder: "Маркетплейс / SaaS / Соцсеть / CRM", type: "text", required: true },
              { id: "entities", label: "Сущности", placeholder: "Пользователи, товары, заказы, отзывы, чаты", type: "textarea", required: true },
              { id: "auth", label: "Аутентификация", placeholder: "Email + Google OAuth / Magic Link / Phone", type: "text", required: false },
              { id: "realtime", label: "Real-time нужен для", placeholder: "Чаты, уведомления, статусы заказов", type: "text", required: false },
            ],
            promptTemplate: "Спроектируй Supabase схему для: {{project}}. Сущности: {{entities}}. Auth: {{auth}}. Real-time: {{realtime}}. Используй Supabase MCP. Создай: 1) SQL миграции (CREATE TABLE), 2) RLS политики для каждой таблицы, 3) Triggers (updated_at, аудит), 4) Supabase Auth настройки, 5) Storage бакеты если нужно, 6) Real-time подписки. Формат: готовые SQL миграции для применения.",
          },
        ],
      },
      sortOrder: 26,
      agentId: "system-dataarch-agent",
    },
    {
      id: "tool-data-rls",
      name: "RLS политики",
      description: "Настроить Row Level Security для таблиц",
      icon: "ShieldCheck",
      iconColor: "#06B6D4",
      config: {
        prompt: "Помогу настроить RLS политики. Укажи таблицу и правила доступа.",
        templates: [
          {
            id: "rls-setup",
            name: "Настройка RLS",
            description: "Row Level Security для безопасного доступа к данным",
            fields: [
              { id: "table", label: "Таблица", placeholder: "orders / profiles / documents", type: "text", required: true },
              { id: "roles", label: "Роли пользователей", placeholder: "Владелец, Менеджер, Админ, Аноним", type: "text", required: true },
              { id: "rules", label: "Правила доступа", placeholder: "Владелец видит свои заказы, Менеджер — все заказы отдела, Админ — всё", type: "textarea", required: true },
            ],
            promptTemplate: "Настрой RLS для таблицы {{table}}. Роли: {{roles}}. Правила: {{rules}}. Используй Supabase MCP для проверки текущей схемы. Создай: 1) ALTER TABLE ... ENABLE ROW LEVEL SECURITY, 2) Политику SELECT (кто что видит), 3) Политику INSERT (кто создаёт), 4) Политику UPDATE (кто редактирует), 5) Политику DELETE (кто удаляет). Для каждой — SQL с комментариями и проверкой auth.uid().",
          },
        ],
      },
      sortOrder: 27,
      agentId: "system-dataarch-agent",
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
    // DevOps Мастер + GitHub (CI/CD, Dockerfiles in repo) + Filesystem
    { agentId: "system-devops-agent", mcpServerId: "mcp-github" },
    { agentId: "system-devops-agent", mcpServerId: "mcp-filesystem" },
    // Менеджер знаний + Filesystem (import docs)
    { agentId: "system-notion-agent", mcpServerId: "mcp-filesystem" },
    // Автоматизатор + Brave Search (find API docs)
    { agentId: "system-automation-agent", mcpServerId: "mcp-brave-search" },
    // Контент-маркетолог + Brave Search (double search power)
    { agentId: "system-marketer-agent", mcpServerId: "mcp-brave-search" },
    // Архитектор данных + PostgreSQL (direct DB access)
    { agentId: "system-dataarch-agent", mcpServerId: "mcp-postgres" },
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
