import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRedisAvailable, getRedis } from "@/lib/redis";
import { isShutdown } from "@/lib/shutdown";
import { timingSafeEqual } from "crypto";

function isTokenValid(header: string | null, token: string): boolean {
  const expected = `Bearer ${token}`;
  if (!header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(req: Request) {
  // Check if caller is authenticated admin (for detailed response)
  let isAdmin = false;
  const authHeader = req.headers.get("authorization");
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken && isTokenValid(authHeader, metricsToken)) {
    isAdmin = true;
  }
  // If shutting down, immediately return 503 so LB drains this instance
  if (isShutdown()) {
    return NextResponse.json(
      { status: "shutting_down", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", latency: Date.now() - dbStart, error: err instanceof Error ? err.message : "Unknown" };
  }

  // Redis
  const redisStart = Date.now();
  try {
    const client = getRedis();
    if (client && isRedisAvailable()) {
      await client.ping();
      checks.redis = { status: "ok", latency: Date.now() - redisStart };
    } else {
      checks.redis = { status: "unavailable" };
    }
  } catch {
    checks.redis = { status: "error", latency: Date.now() - redisStart };
  }

  // AI Providers & MCP — only for authenticated callers (prevents info disclosure)
  if (isAdmin) {
    try {
      const providers = await prisma.aiProvider.findMany({
        where: { isActive: true },
        select: { slug: true, baseUrl: true },
      });
      for (const p of providers) {
        const start = Date.now();
        try {
          const res = await fetch(`${p.baseUrl}/models`, {
            signal: AbortSignal.timeout(5000),
          });
          checks[`ai_${p.slug}`] = { status: res.ok ? "ok" : "degraded", latency: Date.now() - start };
        } catch {
          checks[`ai_${p.slug}`] = { status: "error", latency: Date.now() - start };
        }
      }
    } catch {
      checks.ai_providers = { status: "error", error: "Failed to query providers" };
    }

    try {
      const mcpServers = await prisma.mcpServer.findMany({
        where: { isGlobal: true },
        select: { name: true, url: true, status: true },
      });
      for (const s of mcpServers) {
        checks[`mcp_${s.name}`] = { status: s.status === "CONNECTED" ? "ok" : "disconnected" };
      }
    } catch {
      checks.mcp = { status: "error" };
    }
  }

  const overallOk = Object.values(checks).every((c) => c.status === "ok" || c.status === "disconnected" || c.status === "unavailable");

  return NextResponse.json(
    { status: overallOk ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: overallOk ? 200 : 503 }
  );
}
