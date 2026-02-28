import crypto from "crypto";
import { encode } from "@auth/core/jwt";
import { MOBILE_ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from "@/lib/constants";
import { getRedis, cacheGet } from "@/lib/redis";

const SESSION_MAX_AGE = MOBILE_ACCESS_TOKEN_EXPIRY; // 1 hour (short-lived access token)

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

interface MintParams {
  id: string;
  email: string | null;
  name: string | null;
  image?: string | null;
  role: string;
  twoFactorVerified: boolean;
}

export async function mintSessionToken(user: MintParams): Promise<{
  token: string;
  expiresAt: string;
}> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    salt: COOKIE_NAME,
    secret,
    maxAge: SESSION_MAX_AGE,
    token: {
      id: user.id,
      sub: user.id,
      jti,
      name: user.name,
      email: user.email,
      picture: user.image ?? null,
      role: user.role,
      twoFactorVerified: user.twoFactorVerified,
      iat: now,
    },
  });

  return {
    token,
    expiresAt: new Date((now + SESSION_MAX_AGE) * 1000).toISOString(),
  };
}

// ─── Refresh Token (opaque, stored in Redis) ─────────────

/**
 * Mint an opaque refresh token and store it in Redis.
 * Key: `refresh:${token}`, value: userId, TTL: 30 days.
 * Returns the opaque token string.
 */
export async function mintRefreshToken(userId: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;

  const token = crypto.randomBytes(48).toString("base64url");
  const key = `refresh:${token}`;

  try {
    await client.set(key, userId, "EX", REFRESH_TOKEN_EXPIRY);
    return token;
  } catch {
    return null;
  }
}

/**
 * Validate a refresh token against Redis.
 * Returns the userId if valid, null otherwise.
 * On success, extends the TTL (sliding window).
 */
export async function validateRefreshToken(token: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;

  const key = `refresh:${token}`;

  try {
    const userId = await client.get(key);
    if (!userId) return null;

    // Sliding window — extend TTL on each use
    await client.expire(key, REFRESH_TOKEN_EXPIRY);
    return userId;
  } catch {
    return null;
  }
}

/**
 * Revoke a refresh token by deleting it from Redis.
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(`refresh:${token}`);
  } catch {
    // silent
  }
}

// ─── Token Blacklist (JTI-based) ─────────────────────────

/**
 * Blacklist a JWT by its JTI (JWT ID). Used when logging out or revoking access.
 * The blacklist entry lives for `ttl` seconds (should match remaining token lifetime).
 */
export async function blacklistToken(jti: string, ttl: number): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(`blacklist:${jti}`, "1", "EX", Math.max(ttl, 1));
  } catch {
    // silent — if Redis is down, token will still expire naturally
  }
}

/**
 * Check if a JWT is blacklisted by its JTI.
 * Returns true if blacklisted, false if not (or Redis unavailable — fail open).
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const val = await cacheGet(`blacklist:${jti}`);
  return val === "1";
}
