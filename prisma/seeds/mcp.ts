import type { PrismaClient } from "@prisma/client";

/**
 * MCP servers are now user-created and linked to user-owned agents.
 * This function is kept as a no-op for backward compatibility with the seed orchestrator.
 */
export async function seedMcp(_prisma: PrismaClient): Promise<void> {
  console.log("MCP servers are now user-created — skipping system MCP seeding");
}
