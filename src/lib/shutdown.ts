/**
 * Graceful shutdown handler.
 * Drains active connections and closes Redis/BullMQ before exit.
 */

import { closeRedis } from "@/lib/redis";
import { closeQueues } from "@/lib/queue";
import { closeMcpPool } from "@/lib/mcp-client";
import { logger } from "@/lib/logger";

let isShuttingDown = false;

export function isShutdown(): boolean {
  return isShuttingDown;
}

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Starting graceful shutdown", { signal });

  // Give active requests time to finish (15s drain period)
  const drainMs = parseInt(process.env.SHUTDOWN_DRAIN_MS || "15000", 10);
  logger.info("Draining active connections", { drainMs });
  await new Promise((resolve) => setTimeout(resolve, drainMs));

  // Close MCP connection pool
  logger.info("Closing MCP connection pool");
  await closeMcpPool().catch((err) =>
    logger.error("MCP pool close error", { error: err instanceof Error ? err.message : String(err) })
  );

  // Close BullMQ workers and queues
  logger.info("Closing job queues");
  await closeQueues().catch((err) =>
    logger.error("Queue close error", { error: err instanceof Error ? err.message : String(err) })
  );

  // Close Redis
  logger.info("Closing Redis");
  await closeRedis().catch((err) =>
    logger.error("Redis close error", { error: err instanceof Error ? err.message : String(err) })
  );

  logger.info("Shutdown complete");
  process.exit(0);
}

// Register signal handlers
if (typeof process !== "undefined" && process.on) {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
