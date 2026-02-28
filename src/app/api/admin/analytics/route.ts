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

  // Run independent queries in parallel
  const [dailyMessages, newUsersCount, regRows, topUsers, providerDist, userCosts, totalCostAgg] = await Promise.all([
    // Messages per day
    prisma.dailyUsage.groupBy({
      by: ["date"],
      where: { date: { gte: since } },
      _sum: { messageCount: true, tokenCount: true },
      orderBy: { date: "asc" },
    }),
    // New registrations count
    prisma.user.count({
      where: { createdAt: { gte: since } },
    }),
    // Registrations by day (server-side grouping)
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date::text AS day, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `,
    // Top 10 users by token usage
    prisma.dailyUsage.groupBy({
      by: ["userId"],
      where: { date: { gte: since } },
      _sum: { tokenCount: true, messageCount: true },
      orderBy: { _sum: { tokenCount: "desc" } },
      take: 10,
    }),
    // Provider distribution
    prisma.tokenLog.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, cost: true },
    }),
    // Financial: cost per user
    prisma.tokenLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _sum: { cost: true },
      orderBy: { _sum: { cost: "desc" } },
      take: 10,
    }),
    // Total cost
    prisma.tokenLog.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { cost: true },
    }),
  ]);

  const regsByDay: Record<string, number> = {};
  for (const row of regRows) {
    regsByDay[row.day] = Number(row.count);
  }

  // Fetch user names for top users and cost users in a single query
  const allUserIds = [...new Set([...topUsers.map((u) => u.userId), ...userCosts.map((u) => u.userId)])];
  const allUserNames = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, name: true, email: true },
  });
  const nameMap = Object.fromEntries(allUserNames.map((u) => [u.id, u.name || u.email]));

  const topUsersWithNames = topUsers.map((u) => ({
    userId: u.userId,
    name: nameMap[u.userId] || u.userId,
    tokens: u._sum.tokenCount || 0,
    messages: u._sum.messageCount || 0,
  }));

  const providerDistribution = providerDist.map((p) => ({
    provider: p.provider,
    requests: p._count,
    tokens: (p._sum.inputTokens || 0) + (p._sum.outputTokens || 0),
    cost: p._sum.cost || 0,
  }));

  const costPerUser = userCosts.map((u) => ({
    userId: u.userId,
    name: nameMap[u.userId] || u.userId,
    cost: u._sum.cost || 0,
  }));

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
