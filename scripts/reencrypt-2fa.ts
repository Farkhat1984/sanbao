/**
 * One-off migration: re-encrypt 2FA secrets from old key to new ENCRYPTION_KEY.
 *
 * Old key: AUTH_SECRET (fallback used before ENCRYPTION_KEY was set)
 * New key: ENCRYPTION_KEY (dedicated encryption key)
 *
 * Usage:
 *   OLD_ENCRYPTION_KEY="<AUTH_SECRET value>" npx tsx scripts/reencrypt-2fa.ts
 *
 * If OLD_ENCRYPTION_KEY is not set, uses AUTH_SECRET as the old key.
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptWith(ciphertext: string, key: Buffer): string {
  if (!ciphertext.includes(":")) return ciphertext;
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;

  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function encryptWith(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

const prisma = new PrismaClient();

async function main() {
  const oldSecret = process.env.OLD_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  const newSecret = process.env.ENCRYPTION_KEY;

  if (!oldSecret) {
    console.error("ERROR: Set OLD_ENCRYPTION_KEY or AUTH_SECRET (the key used to encrypt existing data)");
    process.exit(1);
  }
  if (!newSecret) {
    console.error("ERROR: Set ENCRYPTION_KEY (the new dedicated encryption key)");
    process.exit(1);
  }
  if (oldSecret === newSecret) {
    console.log("Old and new keys are the same — nothing to re-encrypt.");
    return;
  }

  const oldKey = deriveKey(oldSecret);
  const newKey = deriveKey(newSecret);

  // Find users with 2FA secrets
  const users = await prisma.user.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, email: true, twoFactorSecret: true },
  });

  if (users.length === 0) {
    console.log("No users with 2FA secrets found.");
    return;
  }

  console.log(`Found ${users.length} user(s) with 2FA secrets to re-encrypt.`);

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    const secret = user.twoFactorSecret!;
    try {
      // Decrypt with old key
      const plaintext = decryptWith(secret, oldKey);

      // Re-encrypt with new key
      const reencrypted = encryptWith(plaintext, newKey);

      // Verify roundtrip
      const verify = decryptWith(reencrypted, newKey);
      if (verify !== plaintext) {
        errors.push(`${user.email}: roundtrip verification failed`);
        continue;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: reencrypted },
      });

      success++;
      console.log(`  ✓ ${user.email}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // If decrypt fails, the secret might be plaintext or encrypted with a different key
      if (msg.includes("Unsupported state") || msg.includes("unable to authenticate")) {
        // Try treating as plaintext (not encrypted)
        try {
          const reencrypted = encryptWith(secret, newKey);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: reencrypted },
          });
          success++;
          console.log(`  ✓ ${user.email} (was plaintext, now encrypted)`);
        } catch (e2) {
          errors.push(`${user.email}: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      } else {
        errors.push(`${user.email}: ${msg}`);
      }
    }
  }

  console.log(`\nDone: ${success} re-encrypted, ${skipped} skipped, ${errors.length} errors.`);
  if (errors.length > 0) {
    console.error("Errors:");
    errors.forEach((e) => console.error(`  ✗ ${e}`));
  }
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
