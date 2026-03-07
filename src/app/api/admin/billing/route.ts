import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { invalidatePlanCache } from "@/lib/usage";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const subPage = Math.max(1, parseInt(searchParams.get("subPage") || "1", 10) || 1);
  const subLimit = Math.min(Math.max(1, parseInt(searchParams.get("subLimit") || "25", 10) || 25), 100);
  const payPage = Math.max(1, parseInt(searchParams.get("payPage") || "1", 10) || 1);
  const payLimit = Math.min(Math.max(1, parseInt(searchParams.get("payLimit") || "25", 10) || 25), 100);

  const [subscriptions, totalSubscriptions, plans, payments, totalPayments, allSubs] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (subPage - 1) * subLimit,
      take: subLimit,
    }),
    prisma.subscription.count(),
    prisma.plan.findMany({ select: { id: true, name: true, price: true } }),
    prisma.payment.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (payPage - 1) * payLimit,
      take: payLimit,
    }),
    prisma.payment.count(),
    // For plan distribution and MRR, we need all subscriptions
    prisma.subscription.findMany({
      select: { plan: { select: { name: true, price: true } } },
    }),
  ]);

  // Plan distribution (from all subscriptions)
  const planCount: Record<string, number> = {};
  let monthlyRevenue = 0;
  for (const s of allSubs) {
    planCount[s.plan.name] = (planCount[s.plan.name] || 0) + 1;
    monthlyRevenue += s.plan.price;
  }
  const planDistribution = Object.entries(planCount).map(([planName, count]) => ({ planName, count }));

  const subscriptionsList = subscriptions.map((s) => ({
    userId: s.userId,
    userName: s.user.name || s.user.email,
    planId: s.planId,
    planName: s.plan.name,
    amount: s.plan.price,
    expiresAt: s.expiresAt?.toISOString() || null,
    grantedBy: s.grantedBy,
    createdAt: s.createdAt.toISOString(),
  }));

  const paymentsList = payments.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name || p.user.email,
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
    subPage,
    subLimit,
    payments: paymentsList,
    totalPayments,
    payPage,
    payLimit,
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
