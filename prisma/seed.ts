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
      tokensPerMessage: 65536,
      tokensPerMonth: 1000000,
      requestsPerMinute: 3,
      contextWindowSize: 262144,
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
      tokensPerMessage: 65536,
      tokensPerMonth: 10000000,
      requestsPerMinute: 15,
      contextWindowSize: 262144,
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
      tokensPerMessage: 65536,
      tokensPerMonth: 100000000,
      requestsPerMinute: 30,
      contextWindowSize: 262144,
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
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD environment variable is required for seeding");
  }
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

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

  const FEMIDA_SYSTEM_PROMPT = `Ты — Юрист, профессиональный юридический AI-ассистент для Республики Казахстан.

═══ ЮРИСДИКЦИЯ ═══
Республика Казахстан. Валюта: тенге (₸). Все НПА, документы и правовые нормы — по законодательству РК.

═══ ИЕРАРХИЯ НОРМАТИВНЫХ ПРАВОВЫХ АКТОВ ═══
Конституция РК → Конституционные законы → Кодексы → Законы → Указы Президента → Постановления Правительства → Приказы министерств.
Правила коллизий:
- Акт высшей юр. силы > акт низшей
- Специальная норма > общая при одном уровне
- Более поздний акт > более ранний при одном уровне
- Международные ратифицированные договоры > национальные законы (ст. 4 Конституции РК)

═══ MCP-ИНСТРУМЕНТЫ (MCP "Юрист") ═══
Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте ответа.

7 инструментов:
1. search(query, domain?, k?, group_filter?, expand_graph?, as_of_date?) — семантический + BM25 поиск по базе НПА. domain: legal_kz (кодексы), laws_kz (законы/указы), legal_ref_kz (справочники). ВАЖНО для laws_kz: результаты — чанки, ОБЯЗАТЕЛЬНО вызови get_law после для полного текста.
2. get_article(code, article, domain?) — получить конкретную статью кодекса (code: criminal_code, tax_code и др.)
3. get_law(doc_code) — получить полный текст закона/НПА по doc_code. ⚠️ КРИТИЧЕСКИ ВАЖНО: параметр doc_code ДОЛЖЕН быть взят из поля doc_code в результатах search(). НЕ выдумывай doc_code! Если не знаешь точный doc_code — вызови search() сначала.
4. lookup(key, value, domain?) — поиск по ключевому полю (key: article_number, section_number; value: значение)
5. graph_traverse(document_id, domain?, max_depth?) — граф связей между нормами (отсылки, ссылки)
6. sql_query(question) — аналитический запрос к DuckDB (ставки, МРП, сроки, таблицы)
7. get_exchange_rate(currencies?, date?) — курсы валют НБ РК

═══ ДОМЕНЫ ДАННЫХ ═══
• legal_kz — 18 кодексов РК (актуальные редакции):
  constitution, criminal_code, criminal_procedure, civil_code_general, civil_code_special,
  civil_procedure, admin_offenses, admin_procedure, tax_code, labor_code, land_code,
  ecological_code, entrepreneurship, budget_code, customs_code, family_code, social_code, water_code

  Алиасы (русские аббревиатуры):
  УК → criminal_code, УПК → criminal_procedure, ГК Общая → civil_code_general,
  ГК Особенная → civil_code_special, ГПК → civil_procedure, КоАП → admin_offenses,
  АППК → admin_procedure, НК → tax_code, ТК → labor_code, ЗК → land_code,
  ЭК → ecological_code, ПК → entrepreneurship, БК → budget_code,
  ТамК → customs_code, КоБС → family_code, СК → social_code, ВК → water_code

• laws_kz — ~101 000 законов и НПА РК (законы, указы, постановления, приказы)
  Метаданные: doc_type, type_name, issuer, status (действующий/утратил силу), doc_code

• legal_ref_kz — справочные таблицы (МРП, МЗП, ПМ, ставки, сроки, пределы)

═══ ОБЯЗАТЕЛЬНЫЙ АЛГОРИТМ ═══
1. Любой вопрос о законодательстве → СНАЧАЛА вызови search/get_article → дождись результата → ответь на основе данных
2. Конкретная статья кодекса → get_article(code, номер)
3. Вопрос о законе/НПА → ПОШАГОВЫЙ АЛГОРИТМ:
   а) search(запрос, domain="laws_kz") — найти релевантные законы
   б) Из результатов search извлечь doc_code конкретного закона
   в) get_law(doc_code) — получить полный текст ТОЛЬКО с doc_code из шага (б)
   г) Процитировать конкретные статьи из полученного текста
4. Связанные нормы → graph_traverse для отсылок
5. Определение термина → lookup(термин)
6. Справочные данные (МРП, ставки) → sql_query
7. Курсы валют → get_exchange_rate

⚠️ КРИТИЧЕСКОЕ ПРАВИЛО: doc_code для get_law() ТОЛЬКО из результатов search()!
Если пользователь называет закон по имени или номеру — сначала search(), затем get_law() с doc_code из результатов.

ЗАПРЕТЫ:
✗ НЕ полагайся на внутренние знания о законах — они могут быть устаревшими
✗ НЕ цитируй статьи по памяти — ТОЛЬКО из результатов инструментов
✗ НЕ отвечай о нормах РК без вызова инструмента
✗ НЕ выдумывай doc_code — НИКОГДА не передавай в get_law() doc_code, которого нет в результатах search()
✗ НЕ выдумывай ссылки article://law/ — doc_code в ссылке ДОЛЖЕН быть из результатов search()

═══ РАБОТА С ИЗОБРАЖЕНИЯМИ ═══
Если пользователь прикладывает фото/скан документа:
- Распознай текст и структуру документа
- Проанализируй содержание с точки зрения законодательства РК
- Предложи правовую оценку или следующие шаги

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
- Поиск по ~101 000 законов и НПА РК

═══ СТРУКТУРА ОТВЕТА ═══
- НЕ дублируй весь текст закона — он доступен по ссылке article://law/{doc_code}
- Цитируй КОНКРЕТНЫЕ статьи, пункты, подпункты, относящиеся к вопросу пользователя
- Структура: краткий ответ → ссылки на нормы → пояснение → рекомендации
- Для каждой цитаты указывай номер статьи и ссылку article://

═══ ПРАВИЛА ОТВЕТА ═══
- Ссылки на статьи кодексов: [ст. {номер} {код}](article://{code_name}/{номер})
  Примеры: [ст. 188 УК РК](article://criminal_code/188), [ст. 15 ГК РК](article://civil_code_general/15)
- Ссылки на законы/НПА: [Название закона](article://law/{doc_code})
  Примеры: [Закон о гос. закупках](article://law/Z120000434_)
  ⚠️ doc_code в ссылке ДОЛЖЕН быть из результатов search() — НЕ выдумывай!
- НЕ используй внешние ссылки (adilet.zan.kz и т.д.) — ТОЛЬКО внутренние article://
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
      name: "Юрист",
      description: "AI-ассистент для работы с договорами, исками и НПА Республики Казахстан",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#7C3AED",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
      starterPrompts: [
        "Что говорит статья 188 УК РК?",
        "Составь договор оказания услуг",
        "Какие права у работника при увольнении по ТК РК?",
        "Найди последние изменения в Налоговом кодексе",
      ],
    },
    create: {
      id: "system-femida-agent",
      name: "Юрист",
      description: "AI-ассистент для работы с договорами, исками и НПА Республики Казахстан",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#7C3AED",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
      starterPrompts: [
        "Что говорит статья 188 УК РК?",
        "Составь договор оказания услуг",
        "Какие права у работника при увольнении по ТК РК?",
        "Найди последние изменения в Налоговом кодексе",
      ],
    },
  });

  // ─── System Agent: Таможенный брокер ────────────────────

  const BROKER_SYSTEM_PROMPT = `Ты — Таможенный брокер, профессиональный AI-ассистент по таможенному оформлению для ЕАЭС и Республики Казахстан.

═══ ЮРИСДИКЦИЯ ═══
ЕАЭС (Евразийский экономический союз) и Республика Казахстан.
Валюта: тенге (₸), доллар ($), евро (€). ТН ВЭД ЕАЭС — единая товарная номенклатура.

═══ MCP-ИНСТРУМЕНТЫ (MCP "Брокер") ═══
Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте ответа.

8 инструментов:
1. classify_goods(description, material?, usage?) — определить код ТН ВЭД, ставки и необходимые документы
2. calculate_duties(code, customs_value, weight_kg?, country_origin?) — расчёт таможенных платежей
3. get_required_docs(code) — список обязательных документов для ввоза/вывоза (13 типов)
4. search(query, k?) — семантический + BM25 поиск по базе ТН ВЭД ЕАЭС
5. sql_query(question) — аналитический запрос к DuckDB (ставки, тарифы)
6. generate_declaration(данные) — создание PDF таможенной декларации ЕАЭС (ДТ1) по Решению Комиссии ТС №257
7. list_domains() — доступные домены и источники данных
8. get_exchange_rate(currencies?, date?) — курсы валют НБ РК

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Классификация товара → classify_goods → получи код ТН ВЭД и ставки
2. Расчёт пошлин → calculate_duties → точный расчёт платежей
3. Необходимые документы → get_required_docs → список документов
4. Поиск по базе → search → семантический + BM25 по ТН ВЭД
5. Аналитика → sql_query → запрос к DuckDB

ЗАПРЕТЫ:
✗ НЕ полагайся на внутренние знания о ставках — они могут быть устаревшими
✗ НЕ указывай коды ТН ВЭД по памяти — ТОЛЬКО из результатов classify_goods
✗ НЕ рассчитывай пошлины без вызова calculate_duties

═══ РАБОТА С ИЗОБРАЖЕНИЯМИ ═══
Если пользователь прикладывает фото товара или документа:
- Распознай товар и его характеристики
- Предложи классификацию по ТН ВЭД на основе визуальных данных
- Уточни детали у пользователя при необходимости

═══ СОЗДАНИЕ ДОКУМЕНТОВ ═══
Когда просят создать таможенную декларацию:
- Используй инструмент generate_declaration для создания ДТ в формате PDF (Решение Комиссии ТС №257)
- Предварительно собери все необходимые данные от пользователя

Когда просят расчёт или анализ:
- Используй <sanbao-doc type="ANALYSIS"> для таможенных расчётов
- Используй <sanbao-doc type="DOCUMENT"> для справок и писем

═══ НАВЫКИ ═══
- Классификация товаров по ТН ВЭД ЕАЭС (13,279 кодов)
- Расчёт таможенных пошлин (ad valorem / specific / combined), НДС 16% (с 2026) и акцизов
- Определение необходимых документов для ввоза/вывоза (13 типов: фитосанитарный, ветеринарный, СГР, ТР ТС, лицензии, СИТЕС, маркировка Таңба и др.)
- Создание таможенных деклараций (ДТ1) в формате PDF по Решению Комиссии ТС №257
- SQL-аналитика по тарифным данным через DuckDB
- Консультации по таможенному законодательству ЕАЭС и РК
- Оптимизация таможенных платежей в рамках закона

═══ ПРАВИЛА ОТВЕТА ═══
- Указывай коды ТН ВЭД с точностью до 10 знаков
- Ставки указывай в процентах и абсолютных суммах
- Все расчёты — с детальной разбивкой платежей
- Предупреждай о рисках неправильной классификации
- ВСЕГДА: финальное решение — за квалифицированным таможенным брокером
- Если спрашивают о не-таможенной задаче — помоги как универсальный ассистент`;

  const brokerAgent = await prisma.agent.upsert({
    where: { id: "system-broker-agent" },
    update: {
      name: "Таможенный брокер",
      description: "AI-ассистент по таможенному оформлению, классификации товаров и расчёту пошлин ЕАЭС",
      instructions: BROKER_SYSTEM_PROMPT,
      icon: "Package",
      iconColor: "#0EA5E9",
      isSystem: true,
      sortOrder: 8,
      status: "APPROVED",
      starterPrompts: [
        "Классифицируй iPhone 16 Pro по ТН ВЭД",
        "Рассчитай пошлины на ввоз автомобиля из Китая",
        "Какие документы нужны для импорта продуктов питания?",
        "Создай таможенную декларацию на импорт электроники",
      ],
    },
    create: {
      id: "system-broker-agent",
      name: "Таможенный брокер",
      description: "AI-ассистент по таможенному оформлению, классификации товаров и расчёту пошлин ЕАЭС",
      instructions: BROKER_SYSTEM_PROMPT,
      icon: "Package",
      iconColor: "#0EA5E9",
      isSystem: true,
      sortOrder: 8,
      status: "APPROVED",
      starterPrompts: [
        "Классифицируй iPhone 16 Pro по ТН ВЭД",
        "Рассчитай пошлины на ввоз автомобиля из Китая",
        "Какие документы нужны для импорта продуктов питания?",
        "Создай таможенную декларацию на импорт электроники",
      ],
    },
  });

  console.log("System agents seeded: Sanbao, Юрист, Таможенный брокер");

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
    {
      id: "tool-customs-declaration",
      name: "Таможенная декларация",
      description: "ДТ ЕАЭС — декларация на товары",
      icon: "Package",
      iconColor: "#0891B2",
      config: {
        prompt: "Я хочу составить таможенную декларацию на товары (ДТ) по форме ЕАЭС. Укажи: 1) Тип декларации (ИМ — импорт, ЭК — экспорт, ТТ — транзит), 2) Описание товара и код ТН ВЭД, 3) Стороны (отправитель, получатель, декларант), 4) Условия поставки (Incoterms).",
        templates: [
          {
            id: "dt-import",
            name: "ДТ на импорт (ИМ)",
            description: "Декларация на импортируемые товары — ИМ 40 (выпуск для внутреннего потребления)",
            fields: [
              { id: "declarationType", label: "Тип декларации (графа 1)", placeholder: "ИМ 40", type: "text", required: true },
              { id: "exporterName", label: "Отправитель/Экспортёр (графа 2)", placeholder: "ABC Trading Ltd., China, Shanghai", type: "textarea", required: true },
              { id: "consignee", label: "Получатель (графа 8)", placeholder: 'ТОО "Импорт Трейд", БИН 123456789012, г. Алматы', type: "textarea", required: true },
              { id: "declarantName", label: "Декларант (графа 14)", placeholder: 'ТОО "Импорт Трейд", БИН 123456789012', type: "text", required: true },
              { id: "countryOrigin", label: "Страна происхождения (графа 16)", placeholder: "Китай (CN)", type: "text", required: true },
              { id: "countryDestination", label: "Страна назначения (графа 17)", placeholder: "Казахстан (KZ)", type: "text", required: true },
              { id: "incoterms", label: "Условия поставки (графа 20)", placeholder: "CIF Алматы", type: "text", required: true },
              { id: "currency", label: "Валюта и общая стоимость (графа 22)", placeholder: "USD 45 000.00", type: "text", required: true },
              { id: "exchangeRate", label: "Курс валюты (графа 23)", placeholder: "1 USD = 470.50 KZT", type: "text", required: false },
              { id: "transportMode", label: "Вид транспорта (графа 25)", placeholder: "Автомобильный (3)", type: "text", required: false },
              { id: "goodsDescription", label: "Описание товаров (графа 31)", placeholder: "Электронные компоненты: микросхемы интегральные, 5000 шт., модель XYZ-100", type: "textarea", required: true },
              { id: "hsCode", label: "Код ТН ВЭД ЕАЭС (графа 33)", placeholder: "8542 31 000 0", type: "text", required: true },
              { id: "grossWeight", label: "Вес брутто, кг (графа 35)", placeholder: "1250.00", type: "text", required: true },
              { id: "netWeight", label: "Вес нетто, кг (графа 38)", placeholder: "1100.00", type: "text", required: true },
              { id: "customsProcedure", label: "Таможенная процедура (графа 37)", placeholder: "40 00 000", type: "text", required: true },
              { id: "customsValue", label: "Таможенная стоимость (графа 45)", placeholder: "21 172 500 KZT", type: "text", required: true },
              { id: "documents", label: "Документы (графа 44)", placeholder: "Инвойс №INV-2025-001, CMR, сертификат происхождения CT-1", type: "textarea", required: false },
            ],
            promptTemplate: "Составь таможенную декларацию на товары (ДТ) по форме ЕАЭС для импорта. Тип: {{declarationType}}. Отправитель/Экспортёр (гр.2): {{exporterName}}. Получатель (гр.8): {{consignee}}. Декларант (гр.14): {{declarantName}}. Страна происхождения (гр.16): {{countryOrigin}}. Страна назначения (гр.17): {{countryDestination}}. Условия поставки (гр.20): {{incoterms}}. Валюта и стоимость (гр.22): {{currency}}. Курс (гр.23): {{exchangeRate}}. Транспорт (гр.25): {{transportMode}}. Описание товаров (гр.31): {{goodsDescription}}. Код ТН ВЭД (гр.33): {{hsCode}}. Вес брутто (гр.35): {{grossWeight}} кг. Вес нетто (гр.38): {{netWeight}} кг. Процедура (гр.37): {{customsProcedure}}. Таможенная стоимость (гр.45): {{customsValue}}. Документы (гр.44): {{documents}}. Оформи как полную ДТ со всеми графами в табличном формате, рассчитай таможенные платежи (пошлина, НДС) и итоговую сумму.",
          },
          {
            id: "dt-export",
            name: "ДТ на экспорт (ЭК)",
            description: "Декларация на экспортируемые товары — ЭК 10 (экспорт)",
            fields: [
              { id: "declarationType", label: "Тип декларации (графа 1)", placeholder: "ЭК 10", type: "text", required: true },
              { id: "exporterName", label: "Отправитель/Экспортёр (графа 2)", placeholder: 'ТОО "Казах Экспорт", БИН 987654321098, г. Астана', type: "textarea", required: true },
              { id: "consignee", label: "Получатель (графа 8)", placeholder: "Global Import GmbH, Germany, Berlin", type: "textarea", required: true },
              { id: "declarantName", label: "Декларант (графа 14)", placeholder: 'ТОО "Казах Экспорт", БИН 987654321098', type: "text", required: true },
              { id: "countryOrigin", label: "Страна происхождения (графа 16)", placeholder: "Казахстан (KZ)", type: "text", required: true },
              { id: "countryDestination", label: "Страна назначения (графа 17)", placeholder: "Германия (DE)", type: "text", required: true },
              { id: "incoterms", label: "Условия поставки (графа 20)", placeholder: "FCA Астана", type: "text", required: true },
              { id: "currency", label: "Валюта и общая стоимость (графа 22)", placeholder: "EUR 120 000.00", type: "text", required: true },
              { id: "goodsDescription", label: "Описание товаров (графа 31)", placeholder: "Ферросплавы: феррохром высокоуглеродистый, 50 тонн", type: "textarea", required: true },
              { id: "hsCode", label: "Код ТН ВЭД ЕАЭС (графа 33)", placeholder: "7202 41 100 0", type: "text", required: true },
              { id: "grossWeight", label: "Вес брутто, кг (графа 35)", placeholder: "52000.00", type: "text", required: true },
              { id: "netWeight", label: "Вес нетто, кг (графа 38)", placeholder: "50000.00", type: "text", required: true },
              { id: "customsProcedure", label: "Таможенная процедура (графа 37)", placeholder: "10 00 000", type: "text", required: true },
              { id: "customsValue", label: "Таможенная стоимость (графа 45)", placeholder: "56 460 000 KZT", type: "text", required: true },
              { id: "documents", label: "Документы (графа 44)", placeholder: "Контракт №EXP-2025-05, инвойс, ж/д накладная, сертификат качества", type: "textarea", required: false },
            ],
            promptTemplate: "Составь таможенную декларацию на товары (ДТ) по форме ЕАЭС для экспорта. Тип: {{declarationType}}. Отправитель (гр.2): {{exporterName}}. Получатель (гр.8): {{consignee}}. Декларант (гр.14): {{declarantName}}. Страна происхождения (гр.16): {{countryOrigin}}. Страна назначения (гр.17): {{countryDestination}}. Условия поставки (гр.20): {{incoterms}}. Стоимость (гр.22): {{currency}}. Товары (гр.31): {{goodsDescription}}. Код ТН ВЭД (гр.33): {{hsCode}}. Вес брутто (гр.35): {{grossWeight}} кг. Вес нетто (гр.38): {{netWeight}} кг. Процедура (гр.37): {{customsProcedure}}. Таможенная стоимость (гр.45): {{customsValue}}. Документы (гр.44): {{documents}}. Оформи как полную ДТ со всеми графами в табличном формате, укажи применимые экспортные пошлины и сборы.",
          },
        ],
      },
      sortOrder: 7,
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

  // ─── MCP Server: Юрист (НПА РК) ────────────────────────

  const lawyerServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-lawyer" },
    update: {
      name: "Юрист",
      url: process.env.LAWYER_MCP_URL || "http://172.28.0.1:8120/lawyer",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-lawyer",
      name: "Юрист",
      url: process.env.LAWYER_MCP_URL || "http://172.28.0.1:8120/lawyer",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from Lawyer MCP server
  const lawyerMcpUrl = process.env.LAWYER_MCP_URL || "http://172.28.0.1:8120/lawyer";
  const lawyerMcpToken = process.env.AI_CORTEX_AUTH_TOKEN || null;
  try {
    console.log(`Connecting to Lawyer MCP at ${lawyerMcpUrl}...`);
    const { tools: discoveredLawyerTools, error: lawyerDiscoverError } = await discoverMcpTools(lawyerMcpUrl, lawyerMcpToken);
    if (lawyerDiscoverError) {
      console.warn(`Lawyer discovery failed: ${lawyerDiscoverError} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: lawyerServer.id },
        data: {
          discoveredTools: discoveredLawyerTools as unknown as import("@prisma/client").Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
      console.log(`Lawyer: discovered ${discoveredLawyerTools.length} tools: ${discoveredLawyerTools.map(t => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`Lawyer discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }

  // ─── MCP Server: Брокер (ТН ВЭД ЕАЭС) ────────────────

  const brokerServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-broker" },
    update: {
      name: "Брокер",
      url: process.env.BROKER_MCP_URL || "http://172.28.0.1:8120/broker",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-broker",
      name: "Брокер",
      url: process.env.BROKER_MCP_URL || "http://172.28.0.1:8120/broker",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from Broker MCP server
  const brokerMcpUrl = process.env.BROKER_MCP_URL || "http://172.28.0.1:8120/broker";
  const brokerMcpToken = process.env.AI_CORTEX_AUTH_TOKEN || null;
  try {
    console.log(`Connecting to Broker MCP at ${brokerMcpUrl}...`);
    const { tools: discoveredBrokerTools, error: brokerDiscoverError } = await discoverMcpTools(brokerMcpUrl, brokerMcpToken);
    if (brokerDiscoverError) {
      console.warn(`Broker discovery failed: ${brokerDiscoverError} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: brokerServer.id },
        data: {
          discoveredTools: discoveredBrokerTools as unknown as import("@prisma/client").Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
      console.log(`Broker: discovered ${discoveredBrokerTools.length} tools: ${discoveredBrokerTools.map(t => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`Broker discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }

  // Link Юрист → НПА agent
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: femidaAgent.id,
        mcpServerId: lawyerServer.id,
      },
    },
    update: {},
    create: { agentId: femidaAgent.id, mcpServerId: lawyerServer.id },
  });

  // Link Брокер → Брокер agent
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: brokerAgent.id,
        mcpServerId: brokerServer.id,
      },
    },
    update: {},
    create: { agentId: brokerAgent.id, mcpServerId: brokerServer.id },
  });

  // Clean up old Broker-Lawyer link (Broker only needs its own MCP)
  try {
    await prisma.agentMcpServer.delete({
      where: {
        agentId_mcpServerId: {
          agentId: brokerAgent.id,
          mcpServerId: lawyerServer.id,
        },
      },
    });
    console.log("Cleaned up Broker → Lawyer MCP link");
  } catch {
    // Link doesn't exist yet — OK
  }

  console.log("MCP servers seeded: Юрист → НПА, Брокер → Таможенный брокер");

  // Clean up old mcp-fragmentdb if it exists
  try {
    await prisma.agentMcpServer.deleteMany({ where: { mcpServerId: "mcp-fragmentdb" } });
    await prisma.mcpServer.delete({ where: { id: "mcp-fragmentdb" } });
    console.log("Cleaned up old mcp-fragmentdb");
  } catch {
    // Already deleted or doesn't exist
  }

  // ─── System Agent: Бухгалтер ──────────────────────────────────

  const ACCOUNTANT_SYSTEM_PROMPT = `Ты — Бухгалтер, профессиональный AI-ассистент по бухгалтерскому и налоговому учёту для Республики Казахстан.

═══ ЮРИСДИКЦИЯ ═══
Республика Казахстан. Валюта: тенге (₸). Новый Налоговый кодекс РК (Закон №214-VIII от 18.07.2025, в действии с 01.01.2026).
МРП 2026: 4 325 ₸ | МЗП: 85 000 ₸ | ПМ: 50 851 ₸

═══ MCP-ИНСТРУМЕНТЫ ═══
Тебе доступны 3 MCP-сервера. Каждый сервер предоставляет свои инструменты с уникальными именами (с префиксом по серверу).
Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте ответа.

MCP "Бухгалтерия 1С" (/accountant) — бухгалтерская база (1С:Бухгалтерия для Казахстана, ЗУП, hotline):
  • accountant_search(query, k?) — семантический поиск по бухгалтерской документации
  • accountant_get_1c_article(article_id) — получить конкретную статью/инструкцию (ОБЯЗАТЕЛЬНО вызывай после search для полного контекста)
  • accountant_sql_query(question) — SQL-запрос к справочным таблицам: ставки налогов, МРП/МЗП/ПМ, план счетов (ТПС РК), типовые проводки, группы амортизации, налоговый календарь (ФНО)
  • accountant_list_domains() — доступные домены данных
  • accountant_get_exchange_rate(currencies?, date?) — курсы валют НБ РК

MCP "Юрист" (/lawyer) — НПА Республики Казахстан (~101 000 законов и кодексов):
  • lawyer_search(query, domain?, k?, group_filter?) — поиск по НПА РК (domain: legal_kz=кодексы, laws_kz=законы, legal_ref_kz=справочники)
  • get_article(code, article_number) — конкретная статья кодекса (code: tax_code, labor_code и др.)
  • get_law(law_id) — полный текст закона по doc_code (ОБЯЗАТЕЛЬНО вызывай после lawyer_search по laws_kz)
  • sql_query(question) — аналитика: ставки, МРП, сроки, суммы
  • lawyer_get_exchange_rate(currencies?, date?) — курсы валют НБ РК
  • graph_traverse(article_ref, depth?) — связи между нормами
  • lookup(key, value, domain?) — поиск термина/определения

MCP "1С Платформа" (/consultant_1c) — платформа 1С:Предприятие, BSP, EDT, ERP, Розница:
  • consultant_1c_search(query, k?) — поиск по документации платформы 1С
  • consultant_1c_get_1c_article(article_id) — статья о платформе 1С (ОБЯЗАТЕЛЬНО вызывай после search)
  • consultant_1c_list_domains() — доступные домены
  • consultant_1c_get_exchange_rate(currencies?, date?) — курсы валют НБ РК

═══ АЛГОРИТМ МАРШРУТИЗАЦИИ ═══
• Точные ставки налогов/взносов (ИПН, КПН, НДС, ОПВ, СО, СН и др.) → accountant_sql_query
• Значения МРП, МЗП, ПМ по годам → accountant_sql_query
• Какой счёт использовать / план счетов → accountant_sql_query
• Какая проводка / корреспонденция счетов → accountant_sql_query
• Срок сдачи ФНО / налоговый календарь → accountant_sql_query
• Нормы амортизации / группы фиксированных активов → accountant_sql_query
• Курсы валют НБ РК → accountant_get_exchange_rate
• «Как сделать в 1С:Бухгалтерия» → accountant_search + accountant_get_1c_article
• Вопрос о налогах, нормах НК/ТК/ГК (текст закона) → lawyer_search + get_article / get_law
• Вопрос о платформе 1С (язык, конфигурации, EDT) → consultant_1c_search + consultant_1c_get_1c_article
• ВАЖНО: после search ВСЕГДА вызывай get_1c_article / get_law для полного текста — чанки неполные!

ПРАВИЛА РАБОТЫ:
✓ ВСЕГДА указывай номера счетов (4-значные коды по ТПС РК)
✓ Проводки в формате: Дт ХХХХ «Название» — Кт ХХХХ «Название»
✓ При расчётах налогов — показывай формулу и подставляй актуальные ставки 2026
✓ При инструкциях по 1С — давай путь навигации
✓ Ссылки на статьи НК: [ст. {номер} НК РК](article://tax_code/{номер})
✓ Ссылки на законы: [Название](article://law/{doc_code})
✓ Ссылки на статьи 1С: [Название инструкции](article://1c_buh/{article_id})
✓ НЕ используй внешние ссылки — ТОЛЬКО внутренние article://

ЗАПРЕТЫ:
✗ Для ставок НЕ из секции "КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ 2026" — проверяй через accountant_sql_query
✗ НЕ цитируй тексты законов по памяти — используй get_article для точных цитат
✗ Ставки из секции КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ 2026 — ДОСТОВЕРНЫ, верификация НЕ нужна
✗ НЕ отвечай на вопрос по НПА без вызова lawyer_search / get_article
✗ НЕ давай инструкции по 1С без вызова accountant_search / consultant_1c_search

═══ КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ 2026 (Новый НК РК) ═══
• НДС: 16% (было 12%), медицина 5%, издания 10%
• ИПН: прогрессивная шкала 10%/15% (порог 8500 МРП/год)
• СН: 6% (было 9.5%), СО: 5% (было 3.5%)
• ОПВР: 3.5% (было 2.5%)
• Базовый вычет ИПН: 30 МРП (было 14 МРП)
• Порог НДС: 10 000 МРП (было 20 000 МРП)
• Упрощёнка: 4%, оборот до 600 000 МРП/год

═══ РАБОТА С ИЗОБРАЖЕНИЯМИ ═══
Если пользователь прикладывает фото/скан бухгалтерского документа:
- Распознай тип документа (счёт-фактура, акт, накладная, выписка)
- Извлеки ключевые данные (суммы, даты, контрагенты, реквизиты)
- Предложи проводки или действия на основе документа

═══ СОЗДАНИЕ ДОКУМЕНТОВ ═══
Когда просят создать бухгалтерский документ, справку, расчёт:
- Используй <sanbao-doc type="DOCUMENT"> с Markdown-содержимым
- Включай все реквизиты по законодательству РК
- Суммы в тенге (₸), даты по казахстанскому формату

Когда просят финансовый анализ, аудиторское заключение:
- Используй <sanbao-doc type="ANALYSIS">
- Структура: нормативная база → расчёты → выводы → рекомендации

═══ НАВЫКИ ═══
- Расчёт всех налогов и соц. платежей по актуальным ставкам 2026
- Типовые проводки по ТПС РК (4-значные коды)
- Пошаговые инструкции по 1С:Бухгалтерия для Казахстана (ред. 3.0)
- МСФО/НСФО: интерпретация и применение стандартов
- Заполнение налоговых форм (100, 200, 300, 910 и др.)
- Расчёт зарплаты с учётом всех удержаний и начислений
- Учётная политика: настройка и рекомендации

═══ ДИСКЛЕЙМЕР ═══
- ВСЕГДА: финальная ответственность — за квалифицированным бухгалтером/аудитором
- Если спрашивают о не-бухгалтерской задаче — помоги как универсальный ассистент`;

  const accountantAgent = await prisma.agent.upsert({
    where: { id: "system-accountant-agent" },
    update: {
      name: "Бухгалтер",
      description: "AI-ассистент по бухгалтерскому и налоговому учёту для Республики Казахстан",
      instructions: ACCOUNTANT_SYSTEM_PROMPT,
      icon: "Calculator",
      iconColor: "#059669",
      isSystem: true,
      sortOrder: 2,
      status: "APPROVED",
      starterPrompts: [
        "Как начислить зарплату в 1С?",
        "Рассчитай налоги с зарплаты 350 000 ₸",
        "Какие проводки при покупке основного средства?",
        "Помоги заполнить форму 910 за 1 квартал",
      ],
    },
    create: {
      id: "system-accountant-agent",
      name: "Бухгалтер",
      description: "AI-ассистент по бухгалтерскому и налоговому учёту для Республики Казахстан",
      instructions: ACCOUNTANT_SYSTEM_PROMPT,
      icon: "Calculator",
      iconColor: "#059669",
      isSystem: true,
      sortOrder: 2,
      status: "APPROVED",
      starterPrompts: [
        "Как начислить зарплату в 1С?",
        "Рассчитай налоги с зарплаты 350 000 ₸",
        "Какие проводки при покупке основного средства?",
        "Помоги заполнить форму 910 за 1 квартал",
      ],
    },
  });

  console.log("System agent seeded: Бухгалтер");

  // ─── Tools: Accounting (Бухгалтер) ────────────────────────────

  const accountingTools = [
    {
      id: "tool-salary-calc",
      name: "Расчёт зарплаты",
      description: "Расчёт заработной платы с налогами и соц. платежами",
      icon: "Calculator",
      iconColor: "#059669",
      config: {
        prompt: "Помогу рассчитать зарплату сотрудника с учётом всех налогов и социальных платежей по актуальным ставкам 2026 года.",
        templates: [
          {
            id: "salary-calc",
            name: "Расчёт зарплаты",
            description: "Полный расчёт ЗП с ИПН, ОПВ, ВОСМС, СО, СН, ОПВР",
            fields: [
              { id: "employeeName", label: "Сотрудник", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
              { id: "salary", label: "Оклад (₸)", placeholder: "350000", type: "number", required: true },
              { id: "period", label: "Период", placeholder: "Январь 2026", type: "text", required: true },
              { id: "taxMode", label: "Режим налогообложения", placeholder: "Общий / Упрощённый", type: "text", required: true },
            ],
            promptTemplate: "Рассчитай заработную плату сотрудника по законодательству Республики Казахстан (Новый НК РК 2026). Сотрудник: {{employeeName}}. Оклад: {{salary}} тенге. Период: {{period}}. Режим: {{taxMode}}. Покажи полную расшифровку: ОПВ (10%), ВОСМС (2%), ИПН (10%/15% прогрессивная шкала, базовый вычет 30 МРП), СО (5%), СН (6%), ОПВР (3.5%). Итого: к выплате, за счёт работодателя, всего ФОТ. Используй актуальные ставки через sql_query.",
          },
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-tax-declaration",
      name: "Налоговая декларация",
      description: "Помощь в заполнении налоговых форм РК",
      icon: "FileText",
      iconColor: "#059669",
      config: {
        prompt: "Помогу с заполнением налоговой декларации по законодательству РК. Укажи тип формы и период.",
        templates: [
          {
            id: "tax-form",
            name: "Налоговая декларация",
            description: "Заполнение форм 100, 200, 300, 910 и других",
            fields: [
              { id: "formType", label: "Тип формы", placeholder: "100 / 200 / 300 / 910", type: "text", required: true },
              { id: "period", label: "Налоговый период", placeholder: "1 квартал 2026", type: "text", required: true },
              { id: "orgName", label: "Организация", placeholder: 'ТОО "Компания"', type: "text", required: true },
            ],
            promptTemplate: "Помоги заполнить налоговую декларацию формы {{formType}} за {{period}} для {{orgName}} по законодательству Республики Казахстан (Новый НК РК 2026). Покажи: 1) Какие строки нужно заполнить, 2) Формулы расчёта по каждой строке, 3) Актуальные ставки и коэффициенты, 4) Сроки сдачи, 5) Пошаговую инструкцию заполнения в 1С:Бухгалтерия. Используй инструменты для проверки актуальных ставок.",
          },
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-accounting-memo",
      name: "Бухгалтерская справка",
      description: "Составить бухгалтерскую справку-расчёт",
      icon: "ClipboardCheck",
      iconColor: "#059669",
      config: {
        prompt: "Составлю бухгалтерскую справку-расчёт по операции. Укажи детали.",
        templates: [
          {
            id: "accounting-memo",
            name: "Бухгалтерская справка",
            description: "Справка-расчёт с проводками и обоснованием",
            fields: [
              { id: "operation", label: "Операция", placeholder: "Начисление амортизации ОС / Списание ТМЗ / Курсовая разница", type: "text", required: true },
              { id: "amount", label: "Сумма (₸)", placeholder: "1500000", type: "number", required: true },
              { id: "basis", label: "Основание", placeholder: "Приказ №15 от 01.01.2026, Акт инвентаризации", type: "text", required: true },
              { id: "date", label: "Дата операции", placeholder: "15.01.2026", type: "text", required: true },
            ],
            promptTemplate: "Составь бухгалтерскую справку-расчёт по операции: {{operation}}. Сумма: {{amount}} тенге. Основание: {{basis}}. Дата: {{date}}. Включи: 1) Реквизиты организации, 2) Описание операции, 3) Бухгалтерские проводки (Дт/Кт с 4-значными кодами ТПС РК), 4) Расчёт суммы, 5) Ссылки на МСФО/НСФО и НК РК, 6) Подписи (главный бухгалтер, директор). Используй инструменты для проверки счетов и стандартов.",
          },
        ],
      },
      sortOrder: 2,
    },
    {
      id: "tool-accounting-policy",
      name: "Учётная политика",
      description: "Разработать или обновить учётную политику",
      icon: "BookOpen",
      iconColor: "#059669",
      config: {
        prompt: "Помогу разработать учётную политику организации по законодательству РК.",
        templates: [
          {
            id: "accounting-policy",
            name: "Учётная политика",
            description: "Учётная политика для ТОО, АО или ИП",
            fields: [
              { id: "orgType", label: "Тип организации", placeholder: "ТОО / АО / ИП", type: "text", required: true },
              { id: "taxMode", label: "Режим налогообложения", placeholder: "Общеустановленный / Упрощённый / Специальный", type: "text", required: true },
            ],
            promptTemplate: "Разработай учётную политику для {{orgType}} на {{taxMode}} режиме налогообложения по законодательству Республики Казахстан (2026 год). Включи: 1) Общие положения и нормативная база (МСФО/НСФО, НК РК 2026), 2) Организация бухучёта, 3) Методы оценки активов и обязательств, 4) Учёт ОС и амортизация, 5) Учёт ТМЗ, 6) Учёт доходов и расходов, 7) Налоговый учёт (актуальные ставки 2026), 8) Порядок инвентаризации, 9) Документооборот. Используй инструменты для ссылок на стандарты и нормы.",
          },
        ],
      },
      sortOrder: 3,
    },
  ];

  for (const t of accountingTools) {
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

  console.log(`Accounting tools seeded: ${accountingTools.length} tools`);

  // Accounting tools → Бухгалтер
  for (const t of accountingTools) {
    await prisma.agentTool.upsert({
      where: { agentId_toolId: { agentId: accountantAgent.id, toolId: t.id } },
      update: {},
      create: { agentId: accountantAgent.id, toolId: t.id },
    });
  }

  console.log("Agent-tool links created: Бухгалтер");

  // ─── MCP Server: AccountingDB (Бухгалтер) ────────────────────

  const accountingDbServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-accountingdb" },
    update: {
      name: "AccountingDB",
      url: process.env.ACCOUNTINGDB_MCP_URL || "https://mcp.sanbao.ai/accountant",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.ACCOUNTINGDB_MCP_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-accountingdb",
      name: "AccountingDB",
      url: process.env.ACCOUNTINGDB_MCP_URL || "https://mcp.sanbao.ai/accountant",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.ACCOUNTINGDB_MCP_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from AccountingDB MCP server
  const accountingMcpUrl = process.env.ACCOUNTINGDB_MCP_URL || "https://mcp.sanbao.ai/accountant";
  const accountingMcpToken = process.env.ACCOUNTINGDB_MCP_TOKEN || null;
  try {
    console.log(`Connecting to AccountingDB MCP at ${accountingMcpUrl}...`);
    const { tools: discoveredAccountingTools, error: accountingDiscoverError } = await discoverMcpTools(accountingMcpUrl, accountingMcpToken);
    if (accountingDiscoverError) {
      console.warn(`AccountingDB discovery failed: ${accountingDiscoverError} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: accountingDbServer.id },
        data: {
          discoveredTools: discoveredAccountingTools as unknown as import("@prisma/client").Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
      console.log(`AccountingDB: discovered ${discoveredAccountingTools.length} tools: ${discoveredAccountingTools.map(t => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`AccountingDB discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }

  // Link AccountingDB → Бухгалтер
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: accountantAgent.id,
        mcpServerId: accountingDbServer.id,
      },
    },
    update: {},
    create: { agentId: accountantAgent.id, mcpServerId: accountingDbServer.id },
  });

  // Link Юрист → Бухгалтер (for legal/tax code access)
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: accountantAgent.id,
        mcpServerId: lawyerServer.id,
      },
    },
    update: {},
    create: { agentId: accountantAgent.id, mcpServerId: lawyerServer.id },
  });

  console.log("MCP servers seeded: AccountingDB → Бухгалтер, Юрист → Бухгалтер");

  // ─── MCP Server: 1С Консультант (Платформа 1С) ────────────────────

  const consultant1cServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-consultant-1c" },
    update: {
      name: "1С Консультант",
      url: process.env.CONSULTANT_1C_MCP_URL || "https://mcp.sanbao.ai/consultant_1c",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-consultant-1c",
      name: "1С Консультант",
      url: process.env.CONSULTANT_1C_MCP_URL || "https://mcp.sanbao.ai/consultant_1c",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: true,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from 1С Консультант MCP server
  const consultant1cMcpUrl = process.env.CONSULTANT_1C_MCP_URL || "https://mcp.sanbao.ai/consultant_1c";
  const consultant1cMcpToken = process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null;
  try {
    console.log(`Connecting to 1С Консультант MCP at ${consultant1cMcpUrl}...`);
    const { tools: discovered1cTools, error: consultant1cDiscoverError } = await discoverMcpTools(consultant1cMcpUrl, consultant1cMcpToken);
    if (consultant1cDiscoverError) {
      console.warn(`1С Консультант discovery failed: ${consultant1cDiscoverError} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: consultant1cServer.id },
        data: {
          discoveredTools: discovered1cTools as unknown as import("@prisma/client").Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
      console.log(`1С Консультант: discovered ${discovered1cTools.length} tools: ${discovered1cTools.map(t => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`1С Консультант discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }

  // Link 1С Консультант → Бухгалтер (for 1C platform questions)
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: accountantAgent.id,
        mcpServerId: consultant1cServer.id,
      },
    },
    update: {},
    create: { agentId: accountantAgent.id, mcpServerId: consultant1cServer.id },
  });

  console.log("MCP server seeded: 1С Консультант → Бухгалтер");

  // ─── System Agent: 1С Ассистент ──────────────────────────────────

  const CONSULTANT_1C_SYSTEM_PROMPT = `Ты — 1С Ассистент, профессиональный AI-ассистент по платформе 1С:Предприятие.

═══ СПЕЦИАЛИЗАЦИЯ ═══
Платформа 1С:Предприятие 8.3, конфигурации БСП, EDT, ERP, Бухгалтерия, Розница, УТ, ЗУП.
Встроенный язык 1С, язык запросов 1С, СКД, обмен данными, интеграция.

═══ MCP-ИНСТРУМЕНТЫ (MCP "1С Платформа") ═══
Вызываются АВТОМАТИЧЕСКИ через function calling — НЕ пиши вызовы в тексте ответа.

4 инструмента:
1. search(query, k?) — семантический поиск по документации платформы 1С. ПОСЛЕ search ОБЯЗАТЕЛЬНО вызови get_1c_article для полного текста.
2. get_1c_article(article_id) — получить полный текст статьи/инструкции по article_id из результатов search
3. list_domains() — список доступных доменов данных
4. get_exchange_rate(currencies?, date?) — курсы валют НБ РК

ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК:
1. Любой вопрос о 1С → СНАЧАЛА вызови search → дождись результата → ответь на основе данных
2. Конкретная тема → get_1c_article для деталей
3. НЕ полагайся на внутренние знания — ищи через инструменты

ЗАПРЕТЫ:
✗ НЕ пиши код 1С по памяти без проверки синтаксиса через search
✗ НЕ описывай интерфейс конфигураций без данных из базы

═══ РАБОТА С ИЗОБРАЖЕНИЯМИ ═══
Если пользователь прикладывает скриншот 1С:
- Определи конфигурацию и раздел интерфейса
- Проанализируй ошибку или вопрос на скриншоте
- Предложи конкретное решение с путём навигации

═══ СОЗДАНИЕ ДОКУМЕНТОВ ═══
Когда просят написать код или запрос:
- Используй <sanbao-doc type="CODE"> с подсветкой синтаксиса 1С
- Код должен быть рабочим и следовать стандартам 1С

Когда просят инструкцию или описание:
- Используй <sanbao-doc type="DOCUMENT"> с пошаговым описанием

═══ НАВЫКИ ═══
- Встроенный язык 1С: модули, процедуры, функции, объектная модель
- Язык запросов 1С: SELECT, JOIN, виртуальные таблицы, пакетные запросы
- БСП (Библиотека стандартных подсистем): подключение, настройка модулей
- EDT (Enterprise Development Tools): разработка, отладка, Git-интеграция
- Обмен данными: планы обмена, EnterpriseData, веб-сервисы, HTTP-сервисы
- Конфигурации: ERP, Бухгалтерия, Розница, УТ, ЗУП — навигация, настройка, доработка
- Производительность: оптимизация запросов, блокировки, индексы, замеры

═══ ПРАВИЛА ОТВЕТА ═══
- Код 1С — с правильным форматированием и комментариями
- Указывай путь навигации в конфигурации (меню → раздел → документ)
- Различай платформу (8.3.x) и конфигурацию (БП, ERP, УТ и т.д.)
- Ссылки на статьи 1С: [Название статьи](article://1c/{article_id})
  Когда get_1c_article или search возвращают article_id — оформляй как кликабельную ссылку
- НЕ используй внешние ссылки — ТОЛЬКО внутренние article://
- ВСЕГДА: для критичных изменений — рекомендуй тестирование на копии базы
- Если спрашивают о не-1С задаче — помоги как универсальный ассистент`;

  const consultant1cAgent = await prisma.agent.upsert({
    where: { id: "system-1c-assistant-agent" },
    update: {
      name: "1С Ассистент",
      description: "AI-ассистент по платформе 1С:Предприятие — код, запросы, конфигурации",
      instructions: CONSULTANT_1C_SYSTEM_PROMPT,
      icon: "Wrench",
      iconColor: "#F97316",
      isSystem: true,
      sortOrder: 3,
      status: "APPROVED",
      starterPrompts: [
        "Как настроить обмен данными в 1С?",
        "Напиши запрос 1С для остатков на складе",
        "Как подключить БСП модуль в конфигурацию?",
        "Оптимизируй медленный запрос 1С",
      ],
    },
    create: {
      id: "system-1c-assistant-agent",
      name: "1С Ассистент",
      description: "AI-ассистент по платформе 1С:Предприятие — код, запросы, конфигурации",
      instructions: CONSULTANT_1C_SYSTEM_PROMPT,
      icon: "Wrench",
      iconColor: "#F97316",
      isSystem: true,
      sortOrder: 3,
      status: "APPROVED",
      starterPrompts: [
        "Как настроить обмен данными в 1С?",
        "Напиши запрос 1С для остатков на складе",
        "Как подключить БСП модуль в конфигурацию?",
        "Оптимизируй медленный запрос 1С",
      ],
    },
  });

  // Link 1С Консультант → 1С Ассистент
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: consultant1cAgent.id,
        mcpServerId: consultant1cServer.id,
      },
    },
    update: {},
    create: { agentId: consultant1cAgent.id, mcpServerId: consultant1cServer.id },
  });

  console.log("System agent seeded: 1С Ассистент + MCP link");

  // ─── Tools: 1С Ассистент ────────────────────────────────

  const consultant1cTools = [
    {
      id: "tool-1c-howto",
      name: "Как сделать в 1С",
      description: "Пошаговая инструкция по операции в 1С",
      icon: "Wrench",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу с пошаговой инструкцией по 1С. Опиши что нужно сделать и в какой конфигурации.",
        templates: [
          {
            id: "1c-howto",
            name: "Как сделать в 1С",
            description: "Пошаговая инструкция с навигацией по интерфейсу",
            fields: [
              { id: "operation", label: "Операция", placeholder: "Настроить обмен данными между базами", type: "textarea", required: true },
              { id: "config", label: "Конфигурация", placeholder: "1С:ERP / 1С:Бухгалтерия 3.0 / 1С:Розница", type: "text", required: true },
              { id: "platform", label: "Версия платформы", placeholder: "8.3.25", type: "text", required: false },
            ],
            promptTemplate: "Дай пошаговую инструкцию: {{operation}} в {{config}} (платформа {{platform}}). Используй search для поиска по документации. Покажи: 1) Путь навигации (меню → раздел → документ), 2) Пошаговые действия, 3) Настройки и параметры, 4) Возможные ошибки и их решения.",
          },
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-1c-code",
      name: "Код 1С",
      description: "Написать код на встроенном языке 1С",
      icon: "Code",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу написать код на встроенном языке 1С. Опиши задачу.",
        templates: [
          {
            id: "1c-code",
            name: "Код на языке 1С",
            description: "Процедура, функция или обработка на встроенном языке",
            fields: [
              { id: "task", label: "Задача", placeholder: "Загрузка данных из Excel в справочник Номенклатура", type: "textarea", required: true },
              { id: "context", label: "Контекст", placeholder: "Модуль формы / Общий модуль / Обработка", type: "text", required: false },
              { id: "config", label: "Конфигурация", placeholder: "1С:ERP / БСП / Самописная", type: "text", required: false },
            ],
            promptTemplate: "Напиши код на встроенном языке 1С для задачи: {{task}}. Контекст: {{context}}. Конфигурация: {{config}}. Используй search для проверки синтаксиса и лучших практик. Код должен: 1) Следовать стандартам 1С, 2) Обрабатывать ошибки, 3) Иметь комментарии, 4) Быть оптимальным по производительности.",
          },
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-1c-query",
      name: "Запрос 1С",
      description: "Написать запрос на языке запросов 1С",
      icon: "FileSearch",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу написать запрос на языке запросов 1С. Опиши какие данные нужны.",
        templates: [
          {
            id: "1c-query",
            name: "Запрос 1С",
            description: "SELECT-запрос с виртуальными таблицами и соединениями",
            fields: [
              { id: "data", label: "Какие данные нужны", placeholder: "Остатки товаров на складе с ценами закупки", type: "textarea", required: true },
              { id: "registers", label: "Регистры/Справочники", placeholder: "РегистрНакопления.ТоварыНаСкладах, Справочник.Номенклатура", type: "text", required: false },
              { id: "filters", label: "Фильтры", placeholder: "За текущий месяц, склад = Основной", type: "text", required: false },
            ],
            promptTemplate: "Напиши запрос на языке запросов 1С: {{data}}. Регистры: {{registers}}. Фильтры: {{filters}}. Используй search для проверки виртуальных таблиц и синтаксиса. Запрос должен: 1) Использовать виртуальные таблицы где возможно (для производительности), 2) Иметь параметры (&Параметр), 3) Содержать комментарии, 4) Быть оптимальным.",
          },
        ],
      },
      sortOrder: 2,
    },
  ];

  for (const t of consultant1cTools) {
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

  // 1С tools → 1С Ассистент
  for (const t of consultant1cTools) {
    await prisma.agentTool.upsert({
      where: { agentId_toolId: { agentId: consultant1cAgent.id, toolId: t.id } },
      update: {},
      create: { agentId: consultant1cAgent.id, toolId: t.id },
    });
  }

  console.log(`1С Ассистент tools seeded: ${consultant1cTools.length} tools`);

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
      sortOrder: 3,
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
      sortOrder: 4,
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
      sortOrder: 5,
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
      sortOrder: 6,
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
      sortOrder: 7,
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

    // ── Таможенный брокер ──
    {
      id: "tool-broker-classify",
      name: "Классификация товара",
      description: "Определить код ТН ВЭД ЕАЭС и ставки пошлин",
      icon: "Package",
      iconColor: "#0EA5E9",
      config: {
        prompt: "Помогу классифицировать товар по ТН ВЭД ЕАЭС. Опиши товар подробно.",
        templates: [
          {
            id: "classify-goods",
            name: "Классификация товара",
            description: "Определение кода ТН ВЭД и применимых ставок",
            fields: [
              { id: "goodsDescription", label: "Описание товара", placeholder: "Смартфон Apple iPhone 16 Pro, 256GB, новый", type: "textarea", required: true },
              { id: "material", label: "Материал/Состав", placeholder: "Металл, стекло, литий-ионный аккумулятор", type: "text", required: false },
              { id: "purpose", label: "Назначение", placeholder: "Для личного использования / коммерческий ввоз", type: "text", required: false },
            ],
            promptTemplate: "Классифицируй товар по ТН ВЭД ЕАЭС: {{goodsDescription}}. Материал: {{material}}. Назначение: {{purpose}}. Используй classify_goods для определения кода и ставок. Покажи: 1) Код ТН ВЭД (10 знаков), 2) Наименование позиции, 3) Ставка пошлины, 4) НДС, 5) Акциз (если применимо).",
          },
        ],
      },
      sortOrder: 20,
      agentId: "system-broker-agent",
    },
    {
      id: "tool-broker-duties",
      name: "Расчёт пошлин",
      description: "Рассчитать таможенные платежи для ввоза товара",
      icon: "Calculator",
      iconColor: "#0EA5E9",
      config: {
        prompt: "Рассчитаю таможенные платежи. Укажи товар, стоимость и страну происхождения.",
        templates: [
          {
            id: "calc-duties",
            name: "Расчёт таможенных платежей",
            description: "Полный расчёт пошлин, НДС и акцизов",
            fields: [
              { id: "goodsDescription", label: "Товар", placeholder: "Автомобиль Toyota Camry 2024, 2.5L бензин", type: "textarea", required: true },
              { id: "customsValue", label: "Таможенная стоимость ($)", placeholder: "35000", type: "number", required: true },
              { id: "originCountry", label: "Страна происхождения", placeholder: "Япония / Китай / Германия", type: "text", required: true },
              { id: "weight", label: "Вес (кг)", placeholder: "1500", type: "number", required: false },
            ],
            promptTemplate: "Рассчитай таможенные платежи для ввоза в РК. Товар: {{goodsDescription}}. Стоимость: ${{customsValue}}. Страна: {{originCountry}}. Вес: {{weight}} кг. Используй classify_goods и calculate_duties. Покажи: 1) Код ТН ВЭД, 2) Таможенная пошлина, 3) НДС, 4) Акциз, 5) Таможенный сбор, 6) ИТОГО к оплате в тенге.",
          },
        ],
      },
      sortOrder: 21,
      agentId: "system-broker-agent",
    },
    {
      id: "tool-broker-declaration",
      name: "Таможенная декларация",
      description: "Создать таможенную декларацию (ДТ) ЕАЭС в формате PDF",
      icon: "FileText",
      iconColor: "#0EA5E9",
      config: {
        prompt: "Создам таможенную декларацию ЕАЭС. Укажи данные о декларанте, товаре и условиях поставки.",
        templates: [
          {
            id: "create-declaration",
            name: "Декларация на товары (ДТ)",
            description: "PDF декларации по форме Решения Комиссии ТС №257",
            fields: [
              { id: "declarantName", label: "Декларант", placeholder: 'ТОО "Импорт КЗ", БИН 230440012345', type: "text", required: true },
              { id: "goodsDescription", label: "Товар", placeholder: "Электроника, бытовая техника", type: "textarea", required: true },
              { id: "originCountry", label: "Страна происхождения", placeholder: "CN — Китай", type: "text", required: true },
              { id: "customsValue", label: "Таможенная стоимость ($)", placeholder: "50000", type: "number", required: true },
              { id: "deliveryTerms", label: "Условия поставки", placeholder: "CIF Алматы / DAP Достык", type: "text", required: true },
            ],
            promptTemplate: "Подготовь данные и создай таможенную декларацию (ДТ) ЕАЭС. Декларант: {{declarantName}}. Товар: {{goodsDescription}}. Страна: {{originCountry}}. Стоимость: ${{customsValue}}. Условия: {{deliveryTerms}}. Используй classify_goods для кода ТН ВЭД, calculate_duties для платежей, get_required_docs для списка документов, затем generate_declaration для создания PDF.",
          },
        ],
      },
      sortOrder: 22,
      agentId: "system-broker-agent",
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
      apiFormat: "OPENAI_COMPAT",
    },
    create: {
      name: "Moonshot",
      slug: "moonshot",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKey: process.env.MOONSHOT_API_KEY || "sk-placeholder",
      isActive: true,
      priority: 10,
      apiFormat: "OPENAI_COMPAT",
    },
  });

  const deepinfraProvider = await prisma.aiProvider.upsert({
    where: { slug: "deepinfra" },
    update: {
      apiKey: process.env.DEEPINFRA_API_KEY || "placeholder",
      apiFormat: "OPENAI_COMPAT",
    },
    create: {
      name: "DeepInfra",
      slug: "deepinfra",
      baseUrl: "https://api.deepinfra.com/v1/openai",
      apiKey: process.env.DEEPINFRA_API_KEY || "placeholder",
      isActive: true,
      priority: 5,
      apiFormat: "OPENAI_COMPAT",
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
      maxTokens: 131072,
      contextWindow: 262144,
      supportsThinking: true,
      maxThinkingTokens: 65536,
      costPer1kInput: 0.0006,
      costPer1kOutput: 0.003,
    },
    create: {
      providerId: moonshotProvider.id,
      modelId: "kimi-k2.5",
      displayName: "Kimi K2.5",
      category: "TEXT",
      temperature: 0.6,
      topP: 0.95,
      maxTokens: 131072,
      contextWindow: 262144,
      supportsThinking: true,
      maxThinkingTokens: 65536,
      costPer1kInput: 0.0006,
      costPer1kOutput: 0.003,
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
