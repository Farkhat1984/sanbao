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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
