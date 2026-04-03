import type { PrismaClient } from "@prisma/client";

/** Agent IDs exported for cross-referencing in tools and MCP modules */
export const AGENT_IDS = {
  sanbao: "system-sanbao-agent",
  femida: "system-femida-agent",
  broker: "system-broker-agent",
  accountant: "system-accountant-agent",
  consultant1c: "system-1c-assistant-agent",
  github: "system-github-agent",
  sql: "system-sql-agent",
  researcher: "system-researcher-agent",
  filemanager: "system-filemanager-agent",
  qa: "system-qa-agent",
} as const;

/**
 * System agents are managed via the admin panel.
 * This function is a no-op — agents already exist in DB.
 */
export async function seedAgents(_prisma: PrismaClient): Promise<void> {
  console.log("System agents managed via admin panel — skipping");
}
