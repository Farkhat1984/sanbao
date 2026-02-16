import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    // Fallback for dev/migration only — log warning
    const fallback = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!fallback) throw new Error("ENCRYPTION_KEY must be set (NEXTAUTH_SECRET/AUTH_SECRET accepted as temporary fallback)");
    if (process.env.NODE_ENV === "production") {
      console.warn("[CRYPTO] Using NEXTAUTH_SECRET/AUTH_SECRET as encryption key fallback — set ENCRYPTION_KEY for production!");
    }
    return crypto.createHash("sha256").update(fallback).digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  // If it doesn't look encrypted (no colons), return as-is (backwards compat)
  if (!ciphertext.includes(":")) return ciphertext;

  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;

  const key = getKey();
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const HEX_PATTERN = /^[0-9a-f]+$/i;

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [iv, tag, ciphertext] = parts;
  // IV = 12 bytes = 24 hex chars, Tag = 16 bytes = 32 hex chars, ciphertext > 0
  return (
    iv.length === 24 &&
    tag.length === 32 &&
    ciphertext.length > 0 &&
    HEX_PATTERN.test(iv) &&
    HEX_PATTERN.test(tag) &&
    HEX_PATTERN.test(ciphertext)
  );
}
