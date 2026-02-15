import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30d";

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Messages per day
  const dailyMessages = await prisma.dailyUsage.groupBy({
    by: ["date"],
    where: { date: { gte: since } },
    _sum: { messageCount: true, tokenCount: true },
    orderBy: { date: "asc" },
  });

  // New registrations count
  const newUsersCount = await prisma.user.count({
    where: { createdAt: { gte: since } },
  });

  // Registrations by day (server-side grouping)
  const regRows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt")::date::text AS day, COUNT(*)::bigint AS count
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `;

  const regsByDay: Record<string, number> = {};
  for (const row of regRows) {
    regsByDay[row.day] = Number(row.count);
  }

  // Top 10 users by token usage
  const topUsers = await prisma.dailyUsage.groupBy({
    by: ["userId"],
    where: { date: { gte: since } },
    _sum: { tokenCount: true, messageCount: true },
    orderBy: { _sum: { tokenCount: "desc" } },
    take: 10,
  });

  const topUserIds = topUsers.map((u) => u.userId);
  const userNames = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, email: true },
  });
  const nameMap = Object.fromEntries(userNames.map((u) => [u.id, u.name || u.email]));

  const topUsersWithNames = topUsers.map((u) => ({
    userId: u.userId,
    name: nameMap[u.userId] || u.userId,
    tokens: u._sum.tokenCount || 0,
    messages: u._sum.messageCount || 0,
  }));

  // Provider distribution
  const providerDist = await prisma.tokenLog.groupBy({
    by: ["provider"],
    where: { createdAt: { gte: since } },
    _count: true,
    _sum: { inputTokens: true, outputTokens: true, cost: true },
  });

  const providerDistribution = providerDist.map((p) => ({
    provider: p.provider,
    requests: p._count,
    tokens: (p._sum.inputTokens || 0) + (p._sum.outputTokens || 0),
    cost: p._sum.cost || 0,
  }));

  // Financial: cost per user
  const userCosts = await prisma.tokenLog.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: since } },
    _sum: { cost: true },
    orderBy: { _sum: { cost: "desc" } },
    take: 10,
  });

  const costUserIds = userCosts.map((u) => u.userId);
  const costUserNames = await prisma.user.findMany({
    where: { id: { in: costUserIds } },
    select: { id: true, name: true, email: true },
  });
  const costNameMap = Object.fromEntries(costUserNames.map((u) => [u.id, u.name || u.email]));

  const costPerUser = userCosts.map((u) => ({
    userId: u.userId,
    name: costNameMap[u.userId] || u.userId,
    cost: u._sum.cost || 0,
  }));

  // Total cost
  const totalCostAgg = await prisma.tokenLog.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { cost: true },
  });

  // Anomaly: users with cost > 3x average
  const avgCost = costPerUser.length > 0
    ? costPerUser.reduce((s, u) => s + u.cost, 0) / costPerUser.length
    : 0;
  const anomalies = costPerUser.filter((u) => u.cost > avgCost * 3);

  return NextResponse.json({
    period,
    dailyMessages: dailyMessages.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      messages: d._sum.messageCount || 0,
      tokens: d._sum.tokenCount || 0,
    })),
    registrationsByDay: regsByDay,
    newUsersTotal: newUsersCount,
    topUsers: topUsersWithNames,
    providerDistribution,
    costPerUser,
    totalCost: totalCostAgg._sum.cost || 0,
    anomalies,
  });
}
