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

  const plan =
    sub?.plan ?? (await prisma.plan.findFirst({ where: { isDefault: true } }));

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

  return { plan, usage, subscription: sub, monthlyUsage };
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
