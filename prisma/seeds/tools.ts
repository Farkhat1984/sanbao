import type { PrismaClient } from "@prisma/client";

/**
 * Prompt template tools removed — they were just chat input shortcuts
 * with no backend functionality. Kept as no-op for seed compatibility.
 */
export async function seedTools(_prisma: PrismaClient): Promise<void> {
  console.log("Prompt template tools removed — skipping");
}
