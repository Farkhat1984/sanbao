/**
 * One-off migration script: hash plaintext API keys.
 *
 * Finds all ApiKey rows where `keyHash` is NULL (indicating the `key` field
 * still contains the full plaintext value), computes SHA-256 hash → `keyHash`,
 * and truncates `key` to a 12-char prefix → `keyPrefix`.
 *
 * Usage: npx tsx scripts/migrate-api-keys.ts
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const plaintextKeys = await prisma.apiKey.findMany({
    where: { keyHash: null },
    select: { id: true, key: true },
  });

  if (plaintextKeys.length === 0) {
    console.log("No plaintext API keys found — nothing to migrate.");
    return;
  }

  console.log(`Found ${plaintextKeys.length} API key(s) with plaintext key (keyHash IS NULL).`);

  // Filter to keys that look like full plaintext (longer than 12 chars)
  const toMigrate = plaintextKeys.filter((k) => k.key.length > 12);
  const alreadyPrefixed = plaintextKeys.length - toMigrate.length;

  if (alreadyPrefixed > 0) {
    console.log(`Skipping ${alreadyPrefixed} key(s) that appear to already be prefixes (≤12 chars).`);
  }

  if (toMigrate.length === 0) {
    console.log("No keys to migrate.");
    return;
  }

  // Migrate in a transaction for atomicity
  await prisma.$transaction(
    toMigrate.map((k) => {
      const keyHash = createHash("sha256").update(k.key).digest("hex");
      const keyPrefix = k.key.slice(0, 12);
      return prisma.apiKey.update({
        where: { id: k.id },
        data: { keyHash, keyPrefix, key: keyPrefix },
      });
    })
  );

  console.log(`Successfully migrated ${toMigrate.length} API key(s): plaintext → SHA-256 hash + prefix.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
