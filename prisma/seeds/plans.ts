import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed subscription plans (Free, Pro, Business) and the admin user.
 * Plans must be seeded first because other entities (admin subscription, PlanModel) depend on them.
 */
export async function seedPlans(prisma: PrismaClient): Promise<void> {
  const plans = [
    {
      slug: "free",
      name: "Free",
      description: "Базовый доступ к AI-ассистенту с ограниченными возможностями",
      price: 0,
      messagesPerDay: 30,
      tokensPerMessage: 32768,
      tokensPerMonth: 500000,
      requestsPerMinute: 3,
      contextWindowSize: 131072,
      maxConversations: 10,
      maxAgents: 0,
      documentsPerMonth: 3,
      canUseAdvancedTools: false,
      canUseReasoning: false,
      canUseSkills: false,
      canUseRag: false,
      canUseGraph: false,
      canChooseProvider: false,
      isDefault: true,
      sortOrder: 0,
      highlighted: false,
      trialDays: 0,
      maxStorageMb: 50,
      maxOrganizations: 0,
    },
    {
      slug: "pro",
      name: "Pro",
      description:
        "Расширенные возможности: reasoning, агенты, скиллы, продвинутые инструменты",
      price: 20,
      messagesPerDay: 500,
      tokensPerMessage: 65536,
      tokensPerMonth: 20000000,
      requestsPerMinute: 20,
      contextWindowSize: 262144,
      maxConversations: 100,
      maxAgents: 15,
      documentsPerMonth: 100,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: false,
      canUseGraph: false,
      canChooseProvider: true,
      isDefault: false,
      sortOrder: 1,
      highlighted: true,
      trialDays: 7,
      maxStorageMb: 1024,
      maxOrganizations: 0,
    },
    {
      slug: "business",
      name: "Business",
      description:
        "Максимум: все функции, база знаний, организации, безлимит диалогов и агентов",
      price: 60,
      messagesPerDay: 0,
      tokensPerMessage: 131072,
      tokensPerMonth: 0,
      requestsPerMinute: 60,
      contextWindowSize: 262144,
      maxConversations: 0,
      maxAgents: 0,
      documentsPerMonth: 0,
      canUseAdvancedTools: true,
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: true,
      canUseGraph: false,
      canChooseProvider: true,
      isDefault: false,
      sortOrder: 2,
      highlighted: false,
      trialDays: 14,
      maxStorageMb: 10240,
      maxOrganizations: 5,
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
  const { BCRYPT_SALT_ROUNDS } = await import("../../src/lib/constants");
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

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
}
