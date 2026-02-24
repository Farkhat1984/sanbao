/**
 * System agents — built-in agents available to all users.
 * Now reads from Agent table (isSystem = true).
 * Backward-compatible: FEMIDA_ID and isSystemAgent() still work.
 */

import { prisma } from "@/lib/prisma";

// System agent constants
export const LAWYER_ID = "system-lawyer";
export const LAWYER_AGENT_ID = "system-femida-agent";
export const BROKER_AGENT_ID = "system-broker-agent";
export const SANBAO_AGENT_ID = "system-sanbao-agent";
export const ACCOUNTANT_AGENT_ID = "system-accountant-agent";
export const CONSULTANT_1C_AGENT_ID = "system-1c-assistant-agent";

// Legacy aliases (backward compat)
export const FEMIDA_ID = LAWYER_ID;
export const FEMIDA_AGENT_ID = LAWYER_AGENT_ID;

// Cache for system agent IDs
let systemAgentIdsCache: { ids: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL = 60_000;

async function getSystemAgentIds(): Promise<Set<string>> {
  if (systemAgentIdsCache && systemAgentIdsCache.expiresAt > Date.now()) {
    return systemAgentIdsCache.ids;
  }
  try {
    const agents = await prisma.agent.findMany({
      where: { isSystem: true, status: "APPROVED" },
      select: { id: true },
    });
    const ids = new Set(agents.map((a) => a.id));
    systemAgentIdsCache = { ids, expiresAt: Date.now() + CACHE_TTL };
    return ids;
  } catch {
    return new Set([LAWYER_AGENT_ID, BROKER_AGENT_ID, SANBAO_AGENT_ID, ACCOUNTANT_AGENT_ID, CONSULTANT_1C_AGENT_ID]);
  }
}

/** Check if an agent ID is a system agent */
export function isSystemAgent(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  // Synchronous check for well-known IDs
  if (agentId === LAWYER_ID || agentId === LAWYER_AGENT_ID || agentId === BROKER_AGENT_ID || agentId === SANBAO_AGENT_ID || agentId === ACCOUNTANT_AGENT_ID || agentId === CONSULTANT_1C_AGENT_ID) {
    return true;
  }
  // Check cache if available
  if (systemAgentIdsCache && systemAgentIdsCache.expiresAt > Date.now()) {
    return systemAgentIdsCache.ids.has(agentId);
  }
  // Legacy prefix check
  return agentId.startsWith("system-");
}

/** Async version that queries DB */
export async function isSystemAgentAsync(agentId: string | null | undefined): Promise<boolean> {
  if (!agentId) return false;
  const ids = await getSystemAgentIds();
  return ids.has(agentId) || agentId === LAWYER_ID;
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

    // Update cache
    systemAgentIdsCache = {
      ids: new Set(agents.map((a) => a.id)),
      expiresAt: Date.now() + CACHE_TTL,
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

/** Resolve a legacy system agent ID to the new Agent ID */
export function resolveAgentId(agentId: string): string {
  if (agentId === LAWYER_ID) return LAWYER_AGENT_ID;
  if (agentId === "system-femida") return LAWYER_AGENT_ID;
  return agentId;
}
