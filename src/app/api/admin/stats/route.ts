import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers, totalMessagesToday, usersByPlan] = await Promise.all([
    prisma.user.count(),
    prisma.dailyUsage.aggregate({
      where: { date: today },
      _sum: { messageCount: true },
    }),
    prisma.subscription.groupBy({
      by: ["planId"],
      _count: true,
    }),
  ]);

  const plans = await prisma.plan.findMany({
    select: { id: true, slug: true },
  });
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.slug]));

  const byPlan: Record<string, number> = {};
  for (const group of usersByPlan) {
    const slug = planMap[group.planId] || "unknown";
    byPlan[slug] = group._count;
  }

  const subscribedCount = usersByPlan.reduce((sum, g) => sum + g._count, 0);
  byPlan["free"] = (byPlan["free"] || 0) + (totalUsers - subscribedCount);

  const activeToday = await prisma.dailyUsage.count({
    where: { date: today },
  });

  return NextResponse.json({
    totalUsers,
    activeToday,
    totalMessagesToday: totalMessagesToday._sum.messageCount || 0,
    usersByPlan: byPlan,
  });
}
