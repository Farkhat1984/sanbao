import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      slug: "free",
      name: "Free",
      description: "Базовый доступ к юридическому AI-ассистенту",
      price: "0 ₸",
      messagesPerDay: 20,
      tokensPerMessage: 2000,
      tokensPerMonth: 100000,
      requestsPerMinute: 3,
      contextWindowSize: 8192,
      maxConversations: 10,
      maxAgents: 0,
      documentsPerMonth: 0,
      canUseAdvancedTools: false,
      canUseReasoning: false,
      canUseRag: false,
      canUseGraph: false,
      canChooseProvider: false,
      isDefault: true,
      sortOrder: 0,
      highlighted: false,
    },
    {
      slug: "pro",
      name: "Pro",
      description:
        "Рассуждения, создание документов, кастомные агенты с RAG",
      price: "9 900 ₸/мес",
      messagesPerDay: 200,
      tokensPerMessage: 8000,
      tokensPerMonth: 2000000,
      requestsPerMinute: 20,
      contextWindowSize: 32000,
      maxConversations: 100,
      maxAgents: 5,
      documentsPerMonth: 50,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseRag: true,
      canUseGraph: false,
      canChooseProvider: false,
      isDefault: false,
      sortOrder: 1,
      highlighted: true,
    },
    {
      slug: "business",
      name: "Business",
      description:
        "Полный доступ: безлимит документов, агенты с RAG + граф знаний",
      price: "29 900 ₸/мес",
      messagesPerDay: 0,
      tokensPerMessage: 16000,
      tokensPerMonth: 6000000,
      requestsPerMinute: 60,
      contextWindowSize: 128000,
      maxConversations: 0,
      maxAgents: -1,
      documentsPerMonth: -1,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseRag: true,
      canUseGraph: true,
      canChooseProvider: true,
      isDefault: false,
      sortOrder: 2,
      highlighted: false,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log("Seed completed: 3 plans created (Free, Pro, Business)");

  // ─── Admin user ──────────────────────────────────────────
  const adminEmail = "admin@leema.kz";
  const adminPassword = await bcrypt.hash("Ckdshfh231161!", 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", password: adminPassword },
    create: {
      email: adminEmail,
      name: "Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Assign Business plan to admin
  const businessPlan = await prisma.plan.findUnique({ where: { slug: "business" } });
  if (businessPlan) {
    await prisma.subscription.upsert({
      where: { userId: admin.id },
      update: { planId: businessPlan.id },
      create: { userId: admin.id, planId: businessPlan.id },
    });
  }

  console.log("Admin user created: admin@leema.kz (ADMIN, Business plan)");

  // ─── Built-in Skills ───────────────────────────────────

  const builtInSkills = [
    {
      name: "Анализ договора",
      description:
        "Детальный анализ договора на юридические риски, пропущенные условия и соответствие законодательству",
      systemPrompt: `Ты — эксперт по анализу договоров. При анализе документа:
1. Проверяй существенные условия (предмет, цена, сроки)
2. Выявляй юридические риски для каждой стороны
3. Проверяй соответствие действующему законодательству
4. Отмечай отсутствующие но рекомендуемые пункты
5. Предлагай конкретные формулировки для улучшения
6. Оценивай баланс интересов сторон
7. Проверяй соблюдение императивных норм`,
      citationRules:
        "Ссылайся на конкретные статьи ГК РФ с указанием пунктов и подпунктов. Для каждого риска указывай правовое основание.",
      jurisdiction: "RU",
      icon: "FileSearch",
      iconColor: "#4F6EF7",
    },
    {
      name: "GDPR / ФЗ-152 Compliance",
      description:
        "Проверка соответствия документов и процессов требованиям GDPR и ФЗ-152 о персональных данных",
      systemPrompt: `Ты — эксперт по защите персональных данных (GDPR + ФЗ-152). При анализе:
1. Определяй категории обрабатываемых персональных данных
2. Проверяй наличие правовых оснований для обработки
3. Оценивай соблюдение принципов минимизации данных
4. Проверяй уведомления и согласия субъектов
5. Анализируй трансграничную передачу данных
6. Оценивай технические и организационные меры защиты
7. Проверяй сроки хранения и процедуры удаления`,
      citationRules:
        "Ссылайся на статьи GDPR и ФЗ-152 параллельно. Указывай соответствие между нормами ЕС и РФ.",
      jurisdiction: "EU/RU",
      icon: "ShieldCheck",
      iconColor: "#10B981",
    },
    {
      name: "Патентный анализ",
      description:
        "Анализ патентоспособности, патентная чистота, сравнение формул изобретений",
      systemPrompt: `Ты — патентный эксперт. При анализе:
1. Оценивай патентоспособность (новизна, изобретательский уровень, промышленная применимость)
2. Анализируй формулу изобретения по существенным признакам
3. Сравнивай с аналогами и прототипами
4. Проверяй патентную чистоту
5. Оценивай объём правовой охраны
6. Анализируй зависимые и независимые пункты формулы`,
      citationRules:
        "Ссылайся на ГК РФ часть IV, Парижскую конвенцию, PCT, регламент Роспатента.",
      jurisdiction: "RU",
      icon: "Lightbulb",
      iconColor: "#F59E0B",
    },
    {
      name: "Due Diligence",
      description:
        "Комплексная юридическая проверка компании или сделки",
      systemPrompt: `Ты — эксперт по due diligence. При проверке:
1. Анализируй корпоративную структуру и учредительные документы
2. Проверяй права на активы (недвижимость, интеллектуальная собственность)
3. Анализируй существенные договоры и обязательства
4. Проверяй трудовые отношения и ключевой персонал
5. Оценивай судебные и административные разбирательства
6. Анализируй налоговые риски
7. Проверяй соблюдение антимонопольного законодательства
8. Оценивай экологические риски и комплаенс`,
      citationRules:
        "Ссылайся на ГК РФ, ФЗ об ООО/АО, НК РФ, антимонопольное законодательство. Для каждого риска указывай уровень (высокий/средний/низкий).",
      jurisdiction: "RU",
      icon: "ClipboardCheck",
      iconColor: "#7C3AED",
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

  console.log("Built-in skills seeded: 4 skills");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
