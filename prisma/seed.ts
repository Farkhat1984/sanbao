import { PrismaClient } from "@prisma/client";
import { seedPlans } from "./seeds/plans";
import { seedAgents } from "./seeds/agents";
import { seedTools } from "./seeds/tools";
import { seedMcp } from "./seeds/mcp";
import { seedProviders } from "./seeds/providers";
import { seedSkills } from "./seeds/skills";
import { seedSettings } from "./seeds/settings";

const prisma = new PrismaClient();

/**
 * Main seed orchestrator.
 * Execution order matters — each step depends on the previous:
 * 1. Plans (+ admin user) — foundation for subscriptions and model access
 * 2. Agents — must exist before tools and MCP servers can reference them
 * 3. Tools — linked to agents, must run after agents
 * 4. MCP servers — linked to agents, includes tool discovery
 * 5. Providers + Models — linked to plans via PlanModel
 * 6. Skills — independent, but logically part of the platform setup
 * 7. Settings — seeds from registry, must run last (imports from src/lib)
 */
async function main() {
  await seedPlans(prisma);
  await seedAgents(prisma);
  await seedTools(prisma);
  await seedMcp(prisma);
  await seedProviders(prisma);
  await seedSkills(prisma);
  await seedSettings(prisma);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
