import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { isRedisAvailable, getRedis } from "@/lib/redis";
import { isShutdown } from "@/lib/shutdown";

/**
 * Lightweight readiness probe for k8s / Docker healthcheck.
 * Checks DB connection pool + Redis ping. No heavy queries.
 * Returns 200 when ready, 503 when not.
 *
 * No rate limiting — this is an internal health endpoint called
 * frequently by Docker/k8s from multiple replicas.
 *
 * Use /api/health for full liveness diagnostics.
 * Use /api/ready for k8s readinessProbe (fast, frequent).
 */
export async function GET() {
  if (isShutdown()) {
    return jsonOk({ ready: false, reason: "shutting_down" }, 503);
  }

  // DB: lightweight connection pool check
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return jsonOk({ ready: false, reason: "db_unavailable" }, 503);
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
