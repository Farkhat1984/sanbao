import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      slug: "free",
      name: "Free",
      description: "Базовый доступ к юридическому AI-ассистенту",
      price: "0 ₽",
      messagesPerDay: 20,
      tokensPerMessage: 4096,
      requestsPerMinute: 5,
      contextWindowSize: 8192,
      maxConversations: 10,
      canUseAdvancedTools: false,
      canChooseProvider: false,
      isDefault: true,
      sortOrder: 0,
      highlighted: false,
    },
    {
      slug: "pro",
      name: "Pro",
      description:
        "Расширенные лимиты, продвинутые инструменты и приоритетный доступ",
      price: "990 ₽/мес",
      messagesPerDay: 100,
      tokensPerMessage: 8192,
      requestsPerMinute: 15,
      contextWindowSize: 32000,
      maxConversations: 100,
      canUseAdvancedTools: true,
      canChooseProvider: false,
      isDefault: false,
      sortOrder: 1,
      highlighted: true,
    },
    {
      slug: "max",
      name: "Max",
      description:
        "Безлимитный доступ, максимальный контекст и выбор AI-провайдера",
      price: "2990 ₽/мес",
      messagesPerDay: 0,
      tokensPerMessage: 16384,
      requestsPerMinute: 30,
      contextWindowSize: 128000,
      maxConversations: 0,
      canUseAdvancedTools: true,
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

  console.log("Seed completed: 3 plans created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
