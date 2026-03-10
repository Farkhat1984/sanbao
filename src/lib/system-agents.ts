/**
 * System agents — managed via admin panel (isSystem = true in DB).
 * No hardcoded agent IDs — everything is DB-driven.
 */

import { prisma } from "@/lib/prisma";
import { getSettingNumber } from "@/lib/settings";

// Cache for system agent IDs
let systemAgentIdsCache: { ids: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL_FALLBACK = 60_000;

async function getCacheTtl(): Promise<number> {
  try {
    return await getSettingNumber("cache_system_agents_ttl_ms");
  } catch {
    return CACHE_TTL_FALLBACK;
  }
}

async function getSystemAgentIds(): Promise<Set<string>> {
  if (systemAgentIdsCache && systemAgentIdsCache.expiresAt > Date.now()) {
    return systemAgentIdsCache.ids;
  }
  const cacheTtl = await getCacheTtl();
  try {
    const agents = await prisma.agent.findMany({
      where: { isSystem: true, status: "APPROVED" },
      select: { id: true },
    });
    const ids = new Set(agents.map((a) => a.id));
    systemAgentIdsCache = { ids, expiresAt: Date.now() + cacheTtl };
    return ids;
  } catch {
    return new Set();
  }
}

/** Check if an agent ID is a system agent (uses cache, falls back to DB) */
export function isSystemAgent(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  if (systemAgentIdsCache && systemAgentIdsCache.expiresAt > Date.now()) {
    return systemAgentIdsCache.ids.has(agentId);
  }
  return false;
}

/** Async version that queries DB */
export async function isSystemAgentAsync(agentId: string | null | undefined): Promise<boolean> {
  if (!agentId) return false;
  const ids = await getSystemAgentIds();
  return ids.has(agentId);
}

/** Load system agents from DB */
export async function getSystemAgents() {
  try {
    const agents = await prisma.agent.findMany({
      where: { isSystem: true, status: "APPROVED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        iconColor: true,
        model: true,
        instructions: true,
      },
    });

    const cacheTtl = await getCacheTtl();
    systemAgentIdsCache = {
      ids: new Set(agents.map((a) => a.id)),
      expiresAt: Date.now() + cacheTtl,
    };

    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || "",
      icon: a.icon,
      iconColor: a.iconColor,
      model: a.model,
      systemPrompt: a.instructions,
    }));
  } catch {
    return [];
  }
}
