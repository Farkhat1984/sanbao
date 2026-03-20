import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let _cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production. " +
        "Generate one with: openssl rand -hex 32"
      );
    }
    // Fallback for dev/migration only
    const fallback = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!fallback) throw new Error("ENCRYPTION_KEY must be set (NEXTAUTH_SECRET/AUTH_SECRET accepted as temporary fallback)");
    _cachedKey = crypto.createHash("sha256").update(fallback).digest();
    return _cachedKey;
  }

  // If ENCRYPTION_KEY is already 32 bytes of hex (64 hex chars), use directly
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    _cachedKey = Buffer.from(secret, "hex");
    return _cachedKey;
  }

  // If ENCRYPTION_KEY is base64-encoded 32 bytes (44 chars with padding)
  const b64 = Buffer.from(secret, "base64");
  if (b64.length === 32 && secret.length >= 40) {
    _cachedKey = b64;
    return _cachedKey;
  }

  // Fallback: derive via SHA-256 (backward compat for non-raw keys)
  _cachedKey = crypto.createHash("sha256").update(secret).digest();
  return _cachedKey;
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
