import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestDurationMetrics } from "@/lib/request-metrics";

export async function GET() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hour = new Date(now.getTime() - 3600_000);

  const [
    totalUsers,
    activeUsersToday,
    totalConversations,
    messagesToday,
    tokensToday,
    errorCount1h,
    providerStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.dailyUsage.groupBy({
      by: ["userId"],
      where: { date: { gte: today } },
    }).then((r) => r.length),
    prisma.conversation.count(),
    prisma.dailyUsage.aggregate({
      where: { date: { gte: today } },
      _sum: { messageCount: true },
    }).then((r) => r._sum.messageCount || 0),
    prisma.dailyUsage.aggregate({
      where: { date: { gte: today } },
      _sum: { tokenCount: true },
    }).then((r) => r._sum.tokenCount || 0),
    prisma.errorLog.count({ where: { createdAt: { gte: hour } } }),
    prisma.tokenLog.groupBy({
      by: ["provider"],
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, cost: true },
    }),
  ]);

  const lines: string[] = [
    "# HELP leema_users_total Total number of registered users",
    "# TYPE leema_users_total gauge",
    `leema_users_total ${totalUsers}`,
    "",
    "# HELP leema_active_users_today Users active today",
    "# TYPE leema_active_users_today gauge",
    `leema_active_users_today ${activeUsersToday}`,
    "",
    "# HELP leema_conversations_total Total conversations",
    "# TYPE leema_conversations_total gauge",
    `leema_conversations_total ${totalConversations}`,
    "",
    "# HELP leema_messages_today Messages sent today",
    "# TYPE leema_messages_today gauge",
    `leema_messages_today ${messagesToday}`,
    "",
    "# HELP leema_tokens_today Tokens used today",
    "# TYPE leema_tokens_today gauge",
    `leema_tokens_today ${tokensToday}`,
    "",
    "# HELP leema_errors_1h Errors in last hour",
    "# TYPE leema_errors_1h gauge",
    `leema_errors_1h ${errorCount1h}`,
    "",
    "# HELP leema_provider_requests_total Requests per provider",
    "# TYPE leema_provider_requests_total counter",
  ];

  for (const p of providerStats) {
    lines.push(`leema_provider_requests_total{provider="${p.provider}"} ${p._count}`);
  }

  lines.push("");
  lines.push("# HELP leema_provider_tokens_total Tokens per provider");
  lines.push("# TYPE leema_provider_tokens_total counter");

  for (const p of providerStats) {
    const total = (p._sum.inputTokens || 0) + (p._sum.outputTokens || 0);
    lines.push(`leema_provider_tokens_total{provider="${p.provider}"} ${total}`);
  }

  lines.push("");
  lines.push("# HELP leema_provider_cost_total Cost per provider");
  lines.push("# TYPE leema_provider_cost_total counter");

  for (const p of providerStats) {
    lines.push(`leema_provider_cost_total{provider="${p.provider}"} ${p._sum.cost || 0}`);
  }

  // Request duration histogram
  const durationMetrics = getRequestDurationMetrics();
  if (durationMetrics) {
    lines.push("");
    lines.push(durationMetrics);
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
