// ─── Unified cache invalidation service ───
// Centralizes all cache invalidation patterns into a single API.
// Existing domain-specific functions are preserved and re-exported.

import { invalidateSettings } from "@/lib/settings";
import { invalidateAgentContextCache } from "@/lib/tool-resolver";
import { invalidateModelCache } from "@/lib/model-router";
import { invalidatePlanCache } from "@/lib/usage";
import { invalidateExperimentCache } from "@/lib/ab-experiment";
import { resetIpWhitelistCache } from "@/lib/admin";
import { logger } from "@/lib/logger";

export type CacheDomain =
  | "settings"
  | "agents"
  | "models"
  | "plans"
  | "experiments"
  | "ip-whitelist";

interface InvalidateOptions {
  /** For 'settings': specific keys to invalidate */
  keys?: string[];
  /** For 'agents': specific agentId to invalidate */
  agentId?: string;
  /** For 'plans': specific userId to invalidate */
  userId?: string;
}

/**
 * Invalidate cache for one or more domains.
 *
 * Usage:
 *   await invalidateCache("models");
 *   await invalidateCache(["settings", "agents"]);
 *   await invalidateCache("plans", { userId: "..." });
 *   await invalidateCache("settings", { keys: ["rate_admin_per_minute"] });
 */
export async function invalidateCache(
  domains: CacheDomain | CacheDomain[],
  options?: InvalidateOptions,
): Promise<void> {
  const domainList = Array.isArray(domains) ? domains : [domains];

  const tasks = domainList.map(async (domain) => {
    try {
      switch (domain) {
        case "settings":
          await invalidateSettings(options?.keys);
          break;
        case "agents":
          invalidateAgentContextCache(options?.agentId);
          break;
        case "models":
          invalidateModelCache();
          break;
        case "plans":
          if (options?.userId) {
            await invalidatePlanCache(options.userId);
          }
          break;
        case "experiments":
          invalidateExperimentCache();
          break;
        case "ip-whitelist":
          resetIpWhitelistCache();
          break;
      }
    } catch (error) {
      logger.warn("Cache invalidation failed", {
        context: "CACHE",
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await Promise.all(tasks);
}

// Re-export domain-specific functions for backwards compatibility
export {
  invalidateSettings,
  invalidateAgentContextCache,
  invalidateModelCache,
  invalidatePlanCache,
  invalidateExperimentCache,
  resetIpWhitelistCache,
};
