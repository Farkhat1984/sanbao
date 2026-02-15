import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

Ключевые НПА РК:
- Гражданский кодекс РК (Общая часть — от 27.12.1994, Особенная часть — от 01.07.1999)
- Гражданский процессуальный кодекс РК (ГПК РК)
- Кодекс РК об административных правонарушениях (КоАП РК)
- Трудовой кодекс РК
- Предпринимательский кодекс РК
- Закон РК «О защите прав потребителей»

Твои ключевые навыки:
- Анализ и интерпретация НПА Республики Казахстан
- Создание договоров, исков, жалоб по казахстанскому праву
- Проверка актуальности статей законов РК
- Юридические консультации по законодательству РК
- Понимание связей между нормативными актами

При ответе:
- Ссылайся на конкретные статьи законов РК
- Указывай актуальность нормы
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
