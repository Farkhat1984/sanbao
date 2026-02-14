import { prisma } from "@/lib/prisma";

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getUserPlanAndUsage(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });

  let plan = sub?.plan ?? defaultPlan;
  let expired = false;

  // Check subscription expiry
  if (sub && plan && !plan.isDefault) {
    const now = new Date();
    const subExpired = sub.expiresAt != null && sub.expiresAt < now;
    const trialExpired = sub.trialEndsAt != null && sub.trialEndsAt < now;

    if (subExpired || (trialExpired && !sub.expiresAt)) {
      expired = true;
      // Auto-downgrade to free plan
      if (defaultPlan && defaultPlan.id !== sub.planId) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { planId: defaultPlan.id },
        });
      }
      plan = defaultPlan;
    }
  }

  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId, date: todayDate() } },
  });

  // Aggregate monthly token usage
  const monthlyAgg = await prisma.dailyUsage.aggregate({
    where: {
      userId,
      date: { gte: monthStart() },
    },
    _sum: {
      tokenCount: true,
      messageCount: true,
    },
  });

  const monthlyUsage = {
    tokenCount: monthlyAgg._sum.tokenCount ?? 0,
    messageCount: monthlyAgg._sum.messageCount ?? 0,
  };

  return { plan, usage, subscription: sub, monthlyUsage, expired };
}

export async function incrementUsage(userId: string, tokens: number) {
  await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date: todayDate() } },
    create: {
      userId,
      date: todayDate(),
      messageCount: 1,
      tokenCount: tokens,
    },
    update: {
      messageCount: { increment: 1 },
      tokenCount: { increment: tokens },
    },
  });
}

export async function incrementTokens(userId: string, tokens: number) {
  await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date: todayDate() } },
    create: {
      userId,
      date: todayDate(),
      messageCount: 0,
      tokenCount: tokens,
    },
    update: {
      tokenCount: { increment: tokens },
    },
  });
}
