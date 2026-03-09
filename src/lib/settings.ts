/**
 * Core settings loader with L1 (in-memory) + L2 (Redis) cache
 * and Redis pub/sub invalidation across replicas.
 *
 * Fallback chain: L1 BoundedMap -> L2 Redis -> DB -> Default from registry.
 * Gracefully degrades when Redis or DB is unavailable.
 */

import type Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { BoundedMap } from "@/lib/bounded-map";
import { cacheGet, cacheSet, cacheDel, getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { SETTINGS_MAP, SETTINGS_REGISTRY } from "@/lib/settings-registry";

// ─── Constants ───────────────────────────────────────────────

const L1_MAX_SIZE = 500;
const L1_TTL_MS = 60_000; // 60s — hardcoded, not self-referencing
const L2_TTL_SECONDS = 120; // 2 minutes
const L2_PREFIX = "sys_setting:";
const PUBSUB_CHANNEL = "sanbao:settings:invalidate";

// ─── L1 Cache ────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const l1Cache = new BoundedMap<string, CacheEntry>(L1_MAX_SIZE);

// ─── Pub/Sub Subscriber ──────────────────────────────────────

let subscriber: Redis | null = null;

// ─── Core Getters ────────────────────────────────────────────

/**
 * Get a single setting value by key.
 * Fallback chain: L1 -> L2 Redis -> DB -> default from registry.
 * Throws if key is not registered in SETTINGS_MAP.
 */
export async function getSetting(key: string): Promise<string> {
  const definition = SETTINGS_MAP.get(key);
  if (!definition) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  // L1: in-memory cache
  const now = Date.now();
  const cached = l1Cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // L2: Redis cache
  try {
    const redisVal = await cacheGet(`${L2_PREFIX}${key}`);
    if (redisVal !== null) {
      l1Cache.set(key, { value: redisVal, expiresAt: now + L1_TTL_MS });
      return redisVal;
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // DB: SystemSetting table
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    const value = setting?.value ?? definition.defaultValue;

    // Populate L1
    l1Cache.set(key, { value, expiresAt: now + L1_TTL_MS });

    // Populate L2 (fire-and-forget)
    cacheSet(`${L2_PREFIX}${key}`, value, L2_TTL_SECONDS).catch(() => {});

    return value;
  } catch (err) {
    logger.warn("Settings DB read failed, using default", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });

    const value = definition.defaultValue;
    l1Cache.set(key, { value, expiresAt: now + L1_TTL_MS });
    return value;
  }
}

/**
 * Get a setting parsed as a number. Returns NaN if the value is not numeric.
 */
export async function getSettingNumber(key: string): Promise<number> {
  const raw = await getSetting(key);
  return Number(raw);
}

/**
 * Get a setting parsed as a boolean. Returns true for "true"/"1"/"yes" (case-insensitive).
 */
export async function getSettingBoolean(key: string): Promise<boolean> {
  const raw = await getSetting(key);
  return ["true", "1", "yes"].includes(raw.toLowerCase());
}

// ─── Batch Loader ────────────────────────────────────────────

/**
 * Load multiple settings in a single DB query. More efficient than
 * calling getSetting() in a loop when you need several values at once.
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  // Validate all keys exist in registry
  for (const key of keys) {
    if (!SETTINGS_MAP.has(key)) {
      throw new Error(`Unknown setting key: ${key}`);
    }
  }

  const now = Date.now();
  const result: Record<string, string> = {};
  const missingFromL1: string[] = [];

  // Check L1 first
  for (const key of keys) {
    const cached = l1Cache.get(key);
    if (cached && cached.expiresAt > now) {
      result[key] = cached.value;
    } else {
      missingFromL1.push(key);
    }
  }

  if (missingFromL1.length === 0) {
    return result;
  }

  // Check L2 for remaining keys
  const missingFromL2: string[] = [];
  for (const key of missingFromL1) {
    try {
      const redisVal = await cacheGet(`${L2_PREFIX}${key}`);
      if (redisVal !== null) {
        result[key] = redisVal;
        l1Cache.set(key, { value: redisVal, expiresAt: now + L1_TTL_MS });
      } else {
        missingFromL2.push(key);
      }
    } catch {
      missingFromL2.push(key);
    }
  }

  if (missingFromL2.length === 0) {
    return result;
  }

  // DB: single query for all remaining keys
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: missingFromL2 } },
    });
    const dbMap = new Map(settings.map((s) => [s.key, s.value]));

    for (const key of missingFromL2) {
      const definition = SETTINGS_MAP.get(key)!;
      const value = dbMap.get(key) ?? definition.defaultValue;
      result[key] = value;

      // Populate L1
      l1Cache.set(key, { value, expiresAt: now + L1_TTL_MS });

      // Populate L2 (fire-and-forget)
      cacheSet(`${L2_PREFIX}${key}`, value, L2_TTL_SECONDS).catch(() => {});
    }
  } catch (err) {
    logger.warn("Settings batch DB read failed, using defaults", {
      keys: missingFromL2,
      error: err instanceof Error ? err.message : String(err),
    });

    // Fill remaining with defaults
    for (const key of missingFromL2) {
      const definition = SETTINGS_MAP.get(key)!;
      const value = definition.defaultValue;
      result[key] = value;
      l1Cache.set(key, { value, expiresAt: now + L1_TTL_MS });
    }
  }

  return result;
}

// ─── Cache Invalidation ──────────────────────────────────────

/**
 * Invalidate settings cache. Called by admin API after saving.
 * If keys provided: invalidate specific keys.
 * If no keys: invalidate all cached settings.
 * Publishes to Redis pub/sub so other replicas invalidate too.
 */
export async function invalidateSettings(keys?: string[]): Promise<void> {
  if (keys && keys.length > 0) {
    // Clear specific keys from L1
    for (const key of keys) {
      l1Cache.delete(key);
    }

    // Clear specific keys from L2 (fire-and-forget)
    for (const key of keys) {
      cacheDel(`${L2_PREFIX}${key}`).catch(() => {});
    }

    // Publish invalidation event
    publishInvalidation(keys);
  } else {
    // Clear entire L1
    l1Cache.clear();

    // Publish "all" invalidation event
    publishInvalidation("all");
  }
}

/** Publish invalidation message to Redis pub/sub (fire-and-forget). */
function publishInvalidation(keys: string[] | "all"): void {
  const client = getRedis();
  if (!client) return;

  const message = JSON.stringify({ keys });
  client.publish(PUBSUB_CHANNEL, message).catch((err) => {
    logger.warn("Settings invalidation publish failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// ─── Pub/Sub Subscriber ──────────────────────────────────────

/**
 * Initialize Redis pub/sub subscriber for cross-replica cache invalidation.
 * Should be called once from instrumentation.ts on server start.
 */
export function initSettingsSubscriber(): void {
  const client = getRedis();
  if (!client) {
    logger.debug("Settings subscriber skipped — Redis not available");
    return;
  }

  try {
    // Create a dedicated connection for subscribing (ioredis requires this)
    subscriber = client.duplicate();

    subscriber.on("error", (err) => {
      logger.warn("Settings subscriber connection error", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    subscriber.subscribe(PUBSUB_CHANNEL).catch((err) => {
      logger.warn("Settings subscriber subscribe failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    subscriber.on("message", (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as { keys: string[] | "all" };

        if (parsed.keys === "all") {
          l1Cache.clear();
          logger.debug("Settings L1 cache cleared (all) via pub/sub");
        } else if (Array.isArray(parsed.keys)) {
          for (const key of parsed.keys) {
            l1Cache.delete(key);
          }
          logger.debug("Settings L1 cache invalidated via pub/sub", {
            keys: parsed.keys,
          });
        }
      } catch (err) {
        logger.warn("Settings subscriber message parse error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info("Settings pub/sub subscriber initialized");
  } catch (err) {
    logger.warn("Settings subscriber init failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Unsubscribe and disconnect the pub/sub subscriber.
 * Called from shutdown.ts during graceful shutdown.
 */
export async function closeSettingsSubscriber(): Promise<void> {
  if (!subscriber) return;

  try {
    await subscriber.unsubscribe(PUBSUB_CHANNEL);
    await subscriber.quit();
  } catch {
    // Best-effort cleanup
  } finally {
    subscriber = null;
  }
}

// ─── Admin Utilities ─────────────────────────────────────────

/**
 * Get all registered settings with their current values.
 * Used by admin UI to display settings with override indicators.
 */
export async function getAllSettingsWithValues(): Promise<
  Array<{
    key: string;
    value: string;
    isOverridden: boolean;
  }>
> {
  let dbMap: Map<string, string>;

  try {
    const settings = await prisma.systemSetting.findMany();
    dbMap = new Map(settings.map((s) => [s.key, s.value]));
  } catch (err) {
    logger.warn("Settings getAllSettingsWithValues DB read failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    dbMap = new Map();
  }

  return SETTINGS_REGISTRY.map((entry) => ({
    key: entry.key,
    value: dbMap.get(entry.key) ?? entry.defaultValue,
    isOverridden: dbMap.has(entry.key),
  }));
}
