import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { invalidatePlanCache } from "@/lib/usage";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const subCursor = searchParams.get("subCursor") || undefined;
  const subLimit = Math.min(Math.max(1, parseInt(searchParams.get("subLimit") || "25", 10) || 25), 100);
  const payCursor = searchParams.get("payCursor") || undefined;
  const payLimit = Math.min(Math.max(1, parseInt(searchParams.get("payLimit") || "25", 10) || 25), 100);
  const search = searchParams.get("search")?.trim() || "";
  const planFilter = searchParams.get("planFilter") || "";

  // Subscription where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subWhere: any = {};
  if (planFilter) subWhere.planId = planFilter;
  if (search) {
    subWhere.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { userId: { contains: search, mode: "insensitive" } },
    ];
  }

  // Payment where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payWhere: any = {};
  if (search) {
    payWhere.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { userId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [subscriptions, totalSubscriptions, plans, payments, totalPayments, allSubs] = await Promise.all([
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
    // For plan distribution and MRR, we need all subscriptions
    prisma.subscription.findMany({
      select: { plan: { select: { id: true, name: true, price: true } } },
    }),
  ]);

  // Plan distribution — include all plans even with 0 subscribers
  const planCount: Record<string, number> = {};
  let monthlyRevenue = 0;
  for (const p of plans) {
    planCount[p.id] = 0;
  }
  for (const s of allSubs) {
    planCount[s.plan.id] = (planCount[s.plan.id] || 0) + 1;
    monthlyRevenue += s.plan.price;
  }
  const planDistribution = plans.map((p) => ({
    planName: p.name,
    count: planCount[p.id] || 0,
  }));

  const hasMoreSubs = subscriptions.length > subLimit;
  const subItems = hasMoreSubs ? subscriptions.slice(0, subLimit) : subscriptions;
  const hasMorePays = payments.length > payLimit;
  const payItems = hasMorePays ? payments.slice(0, payLimit) : payments;

  const subscriptionsList = subItems.map((s) => ({
    userId: s.userId,
    userName: s.user.name || s.user.email,
    userEmail: s.user.email,
    planId: s.planId,
    planName: s.plan.name,
    amount: s.plan.price,
    expiresAt: s.expiresAt?.toISOString() || null,
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
    monthlyRevenue,
    plans,
  });
}

// Manual subscription assignment
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonError("Invalid JSON", 400);
  }
  const { userId, planId, action } = body;

  if (action === "assign" && userId && planId) {
    // Check if plan has trial days
    const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { trialDays: true } });
    const trialEndsAt = plan && plan.trialDays > 0
      ? new Date(Date.now() + plan.trialDays * 86_400_000)
      : null;

    await prisma.subscription.upsert({
      where: { userId },
      update: { planId, grantedBy: result.userId, trialEndsAt },
      create: { userId, planId, grantedBy: result.userId, trialEndsAt },
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
    return jsonOk({ success: true });
  }

  if (action === "cancel" && userId) {
    const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
    if (freePlan) {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { planId: freePlan.id },
      });
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

    // Downgrade to free
    const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
    if (freePlan) {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { planId: freePlan.id },
      });
    }
    await invalidatePlanCache(userId);
    return jsonOk({ success: true });
  }

  return jsonError("Invalid action", 400);
}
