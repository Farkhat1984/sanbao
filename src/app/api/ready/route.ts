import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRedisAvailable, getRedis } from "@/lib/redis";
import { isShutdown } from "@/lib/shutdown";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Lightweight readiness probe for k8s.
 * Checks DB connection pool + Redis ping. No heavy queries.
 * Returns 200 when ready, 503 when not.
 *
 * Use /api/health for full liveness diagnostics.
 * Use /api/ready for k8s readinessProbe (fast, frequent).
 */
export async function GET(req: Request) {
  // Rate limit: 60 requests/min per IP to prevent DoS via health probe hammering
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await checkRateLimit(`ready:${ip}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ ready: false, reason: "rate_limited" }, { status: 429 });
  }

  if (isShutdown()) {
    return NextResponse.json({ ready: false, reason: "shutting_down" }, { status: 503 });
  }

  // DB: lightweight connection pool check
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ ready: false, reason: "db_unavailable" }, { status: 503 });
  }

  // Redis: optional (app works without it)
  let redisOk: boolean | null = null;
  try {
    const client = getRedis();
    if (client && isRedisAvailable()) {
      await client.ping();
      redisOk = true;
    }
  } catch {
    redisOk = false;
  }

  return NextResponse.json(
    { ready: true, redis: redisOk ?? "not_configured" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
