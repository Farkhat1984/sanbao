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

  await prisma.systemAgent.upsert({
    where: { name: "Sanbao" },
    update: {},
    create: {
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      systemPrompt: `Ты — Sanbao, универсальный AI-ассистент. Ты помогаешь пользователям с любыми задачами: анализ текстов, написание кода, создание контента, ответы на вопросы, работа с данными и документами.

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
- Отвечай на языке пользователя`,
      icon: "Bot",
      iconColor: "#4F6EF7",
      model: "default",
      isActive: true,
      sortOrder: 0,
    },
  });

  console.log("System agent seeded: Sanbao");

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

  // Kimi K2.5 — default TEXT model
  // Best practice settings from Moonshot docs:
  //   temperature: 0.6 (instant), 1.0 (thinking) — handled in chat route
  //   top_p: 0.95
  //   max range: temperature [0, 1], NOT [0, 2]
  //   context: 256K (K2.5), using 131K as safe default
  //   supports thinking mode with temperature=1.0
  //   cost: ~$0.20/1M input, ~$0.60/1M output (Moonshot pricing)
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

  // Flux Schnell — default IMAGE model
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

  // Qwen Image Edit — secondary IMAGE model
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
