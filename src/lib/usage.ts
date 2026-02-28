import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

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

function todayKey(): string {
  return todayDate().toISOString().slice(0, 10);
}

// ─── Plan cache (Redis-first, 30s TTL) ──────────────────

const PLAN_CACHE_TTL = 5; // seconds (short TTL to reduce race window on usage checks)

export async function getUserPlanAndUsage(userId: string) {
  // Try Redis cache for plan data
  const cacheKey = `plan:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return data;
    } catch {
      // corrupt cache, continue to DB
    }
  }

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

  const result = { plan, usage, subscription: sub, monthlyUsage, expired };

  // Cache in Redis (30s TTL) — serializable subset
  await cacheSet(cacheKey, JSON.stringify(result), PLAN_CACHE_TTL);

  return result;
}

/** Invalidate plan cache for a user (call after subscription changes). */
export async function invalidatePlanCache(userId: string) {
  await cacheDel(`plan:${userId}`);
}

// ─── Token counting with Redis accumulation ──────────────

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
  // Invalidate plan cache so next request sees updated counts
  await cacheDel(`plan:${userId}`);
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
  await cacheDel(`plan:${userId}`);
}
