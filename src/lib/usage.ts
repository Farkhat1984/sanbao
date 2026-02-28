import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel, cacheIncr } from "@/lib/redis";

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

/** Seconds remaining until midnight (UTC) — used as TTL for daily counters. */
function secondsUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.max(Math.ceil((tomorrow.getTime() - now.getTime()) / 1000), 1);
}

// ─── Plan cache (Redis-first, 5s TTL) ──────────────────

const PLAN_CACHE_TTL = 5; // seconds (short TTL to reduce race window on usage checks)

export async function getUserPlanAndUsage(userId: string) {
  // Try Redis cache for plan data (excluding message count — that uses atomic counter)
  const cacheKey = `plan:${userId}`;
  const cached = await cacheGet(cacheKey);

  let planData: {
    plan: Awaited<ReturnType<typeof prisma.plan.findFirst>>;
    subscription: Awaited<ReturnType<typeof prisma.subscription.findUnique>>;
    monthlyUsage: { tokenCount: number; messageCount: number };
    expired: boolean;
  } | null = null;

  if (cached) {
    try {
      planData = JSON.parse(cached);
    } catch {
      // corrupt cache, continue to DB
    }
  }

  if (!planData) {
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

    planData = { plan, subscription: sub, monthlyUsage, expired };

    // Cache plan data in Redis (5s TTL)
    await cacheSet(cacheKey, JSON.stringify(planData), PLAN_CACHE_TTL);
  }

  // Get today's message count from atomic Redis counter (authoritative)
  const atomicCount = await getAtomicMessageCount(userId);

  // Build the daily usage object — prefer atomic counter for messageCount
  const dbUsage = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId, date: todayDate() } },
  });

  const usage = dbUsage
    ? { ...dbUsage, messageCount: atomicCount ?? dbUsage.messageCount }
    : atomicCount != null && atomicCount > 0
      ? { messageCount: atomicCount, tokenCount: 0 }
      : null;

  return { ...planData, usage };
}

/** Invalidate plan cache for a user (call after subscription changes). */
export async function invalidatePlanCache(userId: string) {
  await cacheDel(`plan:${userId}`);
}

// ─── Atomic message count (Redis INCR) ──────────────────

/**
 * Atomically increment the daily message counter for a user.
 * Uses Redis INCR with a daily-expiring key for race-free counting.
 * Returns the new count, or null if Redis is unavailable (falls back to DB).
 */
export async function incrementMessageUsage(userId: string): Promise<number | null> {
  const key = `usage:msg:${userId}:${todayKey()}`;
  const ttl = secondsUntilMidnight();
  const count = await cacheIncr(key, ttl);
  return count;
}

/**
 * Get the current atomic message count for today.
 * Returns null if Redis is unavailable — caller should fall back to DB.
 */
export async function getAtomicMessageCount(userId: string): Promise<number | null> {
  const key = `usage:msg:${userId}:${todayKey()}`;
  const val = await cacheGet(key);
  if (val === null) return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

// ─── Token counting with Redis accumulation ──────────────

export async function incrementUsage(userId: string, tokens: number) {
  // Atomically increment the Redis message counter
  await incrementMessageUsage(userId);

  // Persist to DB (source of truth for tokens + historical data)
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
