import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { invalidatePlanCache } from "@/lib/usage";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { logSubscriptionChange } from "@/lib/subscription-history";
import { sendSubscriptionActivatedEmail, sendSubscriptionExpiredEmail } from "@/lib/invoice";
import { fireAndForget } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const DEFAULT_DURATION_DAYS = 30;

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const subCursor = searchParams.get("subCursor") || undefined;
  const subLimit = Math.min(Math.max(1, parseInt(searchParams.get("subLimit") || "25", 10) || 25), 100);
  const payCursor = searchParams.get("payCursor") || undefined;
  const payLimit = Math.min(Math.max(1, parseInt(searchParams.get("payLimit") || "25", 10) || 25), 100);
  const historyCursor = searchParams.get("historyCursor") || undefined;
  const historyLimit = Math.min(Math.max(1, parseInt(searchParams.get("historyLimit") || "25", 10) || 25), 100);
  const search = searchParams.get("search")?.trim() || "";
  const planFilter = searchParams.get("planFilter") || "";

  // Subscription where clause
  const subWhere: Prisma.SubscriptionWhereInput = {
    ...(planFilter ? { planId: planFilter } : {}),
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { userId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Payment where clause
  const payWhere: Prisma.PaymentWhereInput = {
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { userId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // History where clause
  const historyWhere: Prisma.SubscriptionHistoryWhereInput = {
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { userId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const now = new Date();

  const [subscriptions, totalSubscriptions, plans, payments, totalPayments, allSubs, history, totalHistory] = await Promise.all([
    prisma.subscription.findMany({
      where: subWhere,
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
      take: subLimit + 1,
      ...(subCursor ? { cursor: { userId: subCursor }, skip: 1 } : {}),
    }),
    prisma.subscription.count({ where: subWhere }),
    prisma.plan.findMany({ select: { id: true, name: true, price: true }, orderBy: { sortOrder: "asc" } }),
    prisma.payment.findMany({
      where: payWhere,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: payLimit + 1,
      ...(payCursor ? { cursor: { id: payCursor }, skip: 1 } : {}),
    }),
    prisma.payment.count({ where: payWhere }),
    // For plan distribution and MRR
    prisma.subscription.findMany({
      select: {
        plan: { select: { id: true, name: true, price: true } },
        expiresAt: true,
      },
    }),
    // Subscription history
    prisma.subscriptionHistory.findMany({
      where: historyWhere,
      include: {
        user: { select: { name: true, email: true } },
        fromPlan: { select: { name: true } },
        toPlan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: historyLimit + 1,
      ...(historyCursor ? { cursor: { id: historyCursor }, skip: 1 } : {}),
    }),
    prisma.subscriptionHistory.count({ where: historyWhere }),
  ]);

  // Plan distribution — include all plans even with 0 subscribers
  const planCount: Record<string, number> = {};
  let monthlyRevenue = 0;
  for (const p of plans) {
    planCount[p.id] = 0;
  }
  for (const s of allSubs) {
    planCount[s.plan.id] = (planCount[s.plan.id] || 0) + 1;
    // MRR: only count subscriptions that are active (expiresAt in future or null with paid plan)
    const isActive = s.expiresAt ? s.expiresAt > now : false;
    if (isActive && s.plan.price > 0) {
      monthlyRevenue += s.plan.price;
    }
  }
  const planDistribution = plans.map((p) => ({
    planName: p.name,
    count: planCount[p.id] || 0,
  }));

  const hasMoreSubs = subscriptions.length > subLimit;
  const subItems = hasMoreSubs ? subscriptions.slice(0, subLimit) : subscriptions;
  const hasMorePays = payments.length > payLimit;
  const payItems = hasMorePays ? payments.slice(0, payLimit) : payments;
  const hasMoreHistory = history.length > historyLimit;
  const historyItems = hasMoreHistory ? history.slice(0, historyLimit) : history;

  const subscriptionsList = subItems.map((s) => ({
    userId: s.userId,
    userName: s.user.name || s.user.email,
    userEmail: s.user.email,
    planId: s.planId,
    planName: s.plan.name,
    amount: s.plan.price,
    expiresAt: s.expiresAt?.toISOString() || null,
    trialEndsAt: s.trialEndsAt?.toISOString() || null,
    grantedBy: s.grantedBy,
    createdAt: s.createdAt.toISOString(),
  }));

  const paymentsList = payItems.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name || p.user.email,
    userEmail: p.user.email,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    createdAt: p.createdAt.toISOString(),
  }));

  const historyList = historyItems.map((h) => ({
    id: h.id,
    userId: h.userId,
    userName: h.user.name || h.user.email,
    userEmail: h.user.email,
    action: h.action,
    fromPlan: h.fromPlan?.name || null,
    toPlan: h.toPlan.name,
    expiresAt: h.expiresAt?.toISOString() || null,
    reason: h.reason,
    performedBy: h.performedBy,
    createdAt: h.createdAt.toISOString(),
  }));

  return jsonOk({
    totalSubscriptions,
    planDistribution,
    subscriptions: subscriptionsList,
    hasMoreSubs,
    nextSubCursor: hasMoreSubs ? subItems[subItems.length - 1]?.userId : null,
    payments: paymentsList,
    totalPayments,
    hasMorePays,
    nextPayCursor: hasMorePays ? payItems[payItems.length - 1]?.id : null,
    history: historyList,
    totalHistory,
    hasMoreHistory,
    nextHistoryCursor: hasMoreHistory ? historyItems[historyItems.length - 1]?.id : null,
    monthlyRevenue,
    plans,
  });
}

// Manual subscription management
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonError("Invalid JSON", 400);
  }
  const { userId, planId, action, durationDays } = body;

  if (action === "assign" && userId && planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { trialDays: true, name: true } });
    if (!plan) return jsonError("Plan not found", 404);

    const days = typeof durationDays === "number" && durationDays > 0 ? durationDays : DEFAULT_DURATION_DAYS;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const trialEndsAt = plan.trialDays > 0
      ? new Date(Date.now() + plan.trialDays * 86_400_000)
      : null;

    // Get current subscription for history
    const currentSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, planId: true },
    });

    const sub = await prisma.subscription.upsert({
      where: { userId },
      update: { planId, grantedBy: result.userId, expiresAt, trialEndsAt },
      create: { userId, planId, grantedBy: result.userId, expiresAt, trialEndsAt },
    });

    await logSubscriptionChange({
      subscriptionId: sub.id,
      userId,
      action: "ACTIVATED",
      fromPlanId: currentSub?.planId ?? null,
      toPlanId: planId,
      expiresAt,
      reason: `Назначено вручную на ${days} дней`,
      performedBy: result.userId,
    });

    await prisma.payment.create({
      data: {
        userId,
        amount: 0,
        currency: DEFAULT_CURRENCY,
        status: "COMPLETED",
        provider: "manual",
      },
    });

    await invalidatePlanCache(userId);

    // Send activation email
    fireAndForget(
      sendSubscriptionActivatedEmail({ userId, planName: plan.name, expiresAt }),
      "admin:sendSubscriptionActivatedEmail"
    );

    return jsonOk({ success: true });
  }

  if (action === "cancel" && userId) {
    const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
    if (!freePlan) return jsonError("Free plan not found", 500);

    const currentSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, planId: true, plan: { select: { name: true } } },
    });

    if (currentSub) {
      await prisma.subscription.update({
        where: { userId },
        data: { planId: freePlan.id, expiresAt: null, trialEndsAt: null },
      });

      await logSubscriptionChange({
        subscriptionId: currentSub.id,
        userId,
        action: "CANCELLED",
        fromPlanId: currentSub.planId,
        toPlanId: freePlan.id,
        reason: "Отменено администратором",
        performedBy: result.userId,
      });

      // Notify user
      fireAndForget(
        sendSubscriptionExpiredEmail({
          userId,
          planName: currentSub.plan.name,
          reason: "отменена администратором",
        }),
        "admin:sendSubscriptionExpiredEmail"
      );
    }

    await invalidatePlanCache(userId);
    return jsonOk({ success: true });
  }

  if (action === "refund" && userId) {
    const lastPayment = await prisma.payment.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });
    if (lastPayment) {
      await prisma.payment.update({
        where: { id: lastPayment.id },
        data: { status: "REFUNDED" },
      });
    }

    const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
    if (!freePlan) return jsonError("Free plan not found", 500);

    const currentSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, planId: true, plan: { select: { name: true } } },
    });

    if (currentSub) {
      await prisma.subscription.update({
        where: { userId },
        data: { planId: freePlan.id, expiresAt: null, trialEndsAt: null },
      });

      await logSubscriptionChange({
        subscriptionId: currentSub.id,
        userId,
        action: "REFUNDED",
        fromPlanId: currentSub.planId,
        toPlanId: freePlan.id,
        reason: "Возврат средств",
        performedBy: result.userId,
      });
    }

    await invalidatePlanCache(userId);
    return jsonOk({ success: true });
  }

  return jsonError("Invalid action", 400);
}
