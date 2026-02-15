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
    "# HELP sanbao_users_total Total number of registered users",
    "# TYPE sanbao_users_total gauge",
    `sanbao_users_total ${totalUsers}`,
    "",
    "# HELP sanbao_active_users_today Users active today",
    "# TYPE sanbao_active_users_today gauge",
    `sanbao_active_users_today ${activeUsersToday}`,
    "",
    "# HELP sanbao_conversations_total Total conversations",
    "# TYPE sanbao_conversations_total gauge",
    `sanbao_conversations_total ${totalConversations}`,
    "",
    "# HELP sanbao_messages_today Messages sent today",
    "# TYPE sanbao_messages_today gauge",
    `sanbao_messages_today ${messagesToday}`,
    "",
    "# HELP sanbao_tokens_today Tokens used today",
    "# TYPE sanbao_tokens_today gauge",
    `sanbao_tokens_today ${tokensToday}`,
    "",
    "# HELP sanbao_errors_1h Errors in last hour",
    "# TYPE sanbao_errors_1h gauge",
    `sanbao_errors_1h ${errorCount1h}`,
    "",
    "# HELP sanbao_provider_requests_total Requests per provider",
    "# TYPE sanbao_provider_requests_total counter",
  ];

  for (const p of providerStats) {
    lines.push(`sanbao_provider_requests_total{provider="${p.provider}"} ${p._count}`);
  }

  lines.push("");
  lines.push("# HELP sanbao_provider_tokens_total Tokens per provider");
  lines.push("# TYPE sanbao_provider_tokens_total counter");

  for (const p of providerStats) {
    const total = (p._sum.inputTokens || 0) + (p._sum.outputTokens || 0);
    lines.push(`sanbao_provider_tokens_total{provider="${p.provider}"} ${total}`);
  }

  lines.push("");
  lines.push("# HELP sanbao_provider_cost_total Cost per provider");
  lines.push("# TYPE sanbao_provider_cost_total counter");

  for (const p of providerStats) {
    lines.push(`sanbao_provider_cost_total{provider="${p.provider}"} ${p._sum.cost || 0}`);
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
