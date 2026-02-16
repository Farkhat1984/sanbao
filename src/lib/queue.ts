/**
 * BullMQ job queue with graceful fallback.
 * If Redis is not available, jobs execute inline (fire-and-forget).
 */

import { Queue, Worker, type Job } from "bullmq";
import { isRedisAvailable } from "@/lib/redis";
import { logger } from "@/lib/logger";

// ─── Queue registry ─────────────────────────────────────

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

type JobProcessor = (data: Record<string, unknown>) => Promise<void>;
const processors = new Map<string, JobProcessor>();

/** Get Redis connection config for BullMQ (uses its own ioredis internally). */
function getConnectionConfig(): { host: string; port: number; password?: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      ...(parsed.password ? { password: parsed.password } : {}),
    };
  } catch {
    return null;
  }
}

function getQueue(name: string): Queue | null {
  if (!isRedisAvailable()) return null;

  let queue = queues.get(name);
  if (queue) return queue;

  const connection = getConnectionConfig();
  if (!connection) return null;

  queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  queues.set(name, queue);
  return queue;
}

/** Register a job processor. In production, starts a BullMQ Worker. */
export function registerWorker(queueName: string, processor: JobProcessor): void {
  processors.set(queueName, processor);

  if (!isRedisAvailable()) return;

  const connection = getConnectionConfig();
  if (!connection) return;

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      await processor(job.data);
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 20, duration: 1000 },
    }
  );

  worker.on("failed", (job, err) => {
    logger.error("Job failed", { queue: queueName, jobId: job?.id, error: err.message });
  });

  workers.set(queueName, worker);
}

/** Add a job to the queue. Falls back to inline execution if Redis unavailable. */
export async function enqueue(queueName: string, data: Record<string, unknown>): Promise<void> {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.add(queueName, data);
    return;
  }

  // Fallback: execute inline (fire-and-forget)
  const processor = processors.get(queueName);
  if (processor) {
    processor(data).catch((err) => {
      logger.error("Inline job execution failed", { queue: queueName, error: err instanceof Error ? err.message : String(err) });
    });
  }
}

// ─── Graceful shutdown ──────────────────────────────────

export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, worker] of workers) {
    closePromises.push(worker.close());
  }
  for (const [, queue] of queues) {
    closePromises.push(queue.close());
  }
  await Promise.allSettled(closePromises);
  workers.clear();
  queues.clear();
}
