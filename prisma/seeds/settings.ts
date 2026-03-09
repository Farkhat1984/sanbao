import type { PrismaClient } from "@prisma/client";

/**
 * Seed system settings from the settings registry.
 * Uses dynamic import to avoid circular dependency issues at compile time.
 */
export async function seedSettings(prisma: PrismaClient): Promise<void> {
  const { SETTINGS_REGISTRY } = await import("../../src/lib/settings-registry");

  for (const setting of SETTINGS_REGISTRY) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {}, // Don't overwrite existing values — admin may have customized them
      create: {
        key: setting.key,
        value: setting.defaultValue,
        type: setting.type,
      },
    });
  }
  console.log(`Seeded ${SETTINGS_REGISTRY.length} system settings`);
}
