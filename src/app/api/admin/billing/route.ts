import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { invalidatePlanCache } from "@/lib/usage";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const [subscriptions, plans, payments] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.plan.findMany({ select: { id: true, name: true, price: true } }),
    prisma.payment.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Plan distribution
  const planCount: Record<string, number> = {};
  for (const s of subscriptions) {
    const name = s.plan.name;
    planCount[name] = (planCount[name] || 0) + 1;
  }

  const planDistribution = Object.entries(planCount).map(([planName, count]) => ({ planName, count }));

  // Monthly revenue estimate (parse price from plan)
  let monthlyRevenue = 0;
  for (const s of subscriptions) {
    const priceNum = parseInt(s.plan.price.replace(/\D/g, ""), 10);
    if (!isNaN(priceNum)) monthlyRevenue += priceNum;
  }

  // Recent subscriptions as "payments"
  const recentPayments = subscriptions.slice(0, 20).map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.user.name || s.user.email,
    planName: s.plan.name,
    amount: s.plan.price,
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

  const subscriptionsList = subscriptions.map((s) => ({
    userId: s.userId,
    userName: s.user.name || s.user.email,
    planId: s.planId,
    planName: s.plan.name,
    expiresAt: s.expiresAt?.toISOString() || null,
    grantedBy: s.grantedBy,
  }));

  return NextResponse.json({
    totalSubscriptions: subscriptions.length,
    planDistribution,
    recentPayments,
    payments: paymentsList,
    monthlyRevenue,
    plans,
    subscriptions: subscriptionsList,
  });
}

// Manual subscription assignment
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { userId, planId, action } = await req.json();

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
    return NextResponse.json({ success: true });
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
    return NextResponse.json({ success: true });
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
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
