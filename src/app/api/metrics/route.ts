import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestDurationMetrics } from "@/lib/request-metrics";
import { isRedisAvailable, getRedis } from "@/lib/redis";

export async function GET(req: Request) {
  // Allow Prometheus scraping with a bearer token, or require admin auth
  const authHeader = req.headers.get("authorization");
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken && authHeader === `Bearer ${metricsToken}`) {
    // Token auth for Prometheus — proceed
  } else {
    // Fallback: require admin session
    const { requireAdmin } = await import("@/lib/admin");
    const result = await requireAdmin();
    if (result.error) return result.error;
  }
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
    // ─── Business metrics ───────────────────────────
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

  // ─── Process metrics ────────────────────────────────
  const mem = process.memoryUsage();
  lines.push("");
  lines.push("# HELP process_heap_bytes Node.js heap usage in bytes");
  lines.push("# TYPE process_heap_bytes gauge");
  lines.push(`process_heap_bytes{type="used"} ${mem.heapUsed}`);
  lines.push(`process_heap_bytes{type="total"} ${mem.heapTotal}`);
  lines.push(`process_heap_bytes{type="rss"} ${mem.rss}`);
  lines.push(`process_heap_bytes{type="external"} ${mem.external}`);

  lines.push("");
  lines.push("# HELP process_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

  if (typeof process.cpuUsage === "function") {
    const cpu = process.cpuUsage();
    lines.push("");
    lines.push("# HELP process_cpu_microseconds CPU time in microseconds");
    lines.push("# TYPE process_cpu_microseconds counter");
    lines.push(`process_cpu_microseconds{type="user"} ${cpu.user}`);
    lines.push(`process_cpu_microseconds{type="system"} ${cpu.system}`);
  }

  // ─── Redis metrics ──────────────────────────────────
  lines.push("");
  lines.push("# HELP sanbao_redis_connected Whether Redis is connected");
  lines.push("# TYPE sanbao_redis_connected gauge");
  lines.push(`sanbao_redis_connected ${isRedisAvailable() ? 1 : 0}`);

  if (isRedisAvailable()) {
    try {
      const client = getRedis();
      if (client) {
        const info = await client.info("memory");
        const usedMatch = info.match(/used_memory:(\d+)/);
        if (usedMatch) {
          lines.push("");
          lines.push("# HELP sanbao_redis_memory_bytes Redis memory usage");
          lines.push("# TYPE sanbao_redis_memory_bytes gauge");
          lines.push(`sanbao_redis_memory_bytes ${usedMatch[1]}`);
        }
        const keysInfo = await client.info("keyspace");
        const keysMatch = keysInfo.match(/db0:keys=(\d+)/);
        if (keysMatch) {
          lines.push("");
          lines.push("# HELP sanbao_redis_keys Total keys in Redis");
          lines.push("# TYPE sanbao_redis_keys gauge");
          lines.push(`sanbao_redis_keys ${keysMatch[1]}`);
        }
      }
    } catch {
      // Redis metrics unavailable, skip
    }
  }

  // ─── Request duration histogram ─────────────────────
  const durationMetrics = getRequestDurationMetrics();
  if (durationMetrics) {
    lines.push("");
    lines.push(durationMetrics);
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
