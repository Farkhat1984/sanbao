import type { PrismaClient } from "@prisma/client";

/** Agent IDs — no hardcoded agents. System agents are managed via admin panel. */
export const AGENT_IDS = {} as const;

/**
 * No hardcoded agents to seed.
 * System agents are created/managed via the admin panel.
 */
export async function seedAgents(_prisma: PrismaClient): Promise<void> {
  console.log("No hardcoded agents — system agents managed via admin panel");
}
