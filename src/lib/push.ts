/**
 * Push notification service — sends notifications to user's registered devices.
 * Uses Firebase Cloud Messaging (FCM) HTTP v1 API for both Android and iOS.
 *
 * Requires env vars:
 * - FCM_PROJECT_ID — Firebase project ID
 * - FCM_SERVICE_ACCOUNT_KEY — JSON string of the service account key
 *
 * Gracefully degrades: if FCM is not configured, logs a warning and returns silently.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─── FCM config ─────────────────────────────────────────

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;
const FCM_SERVICE_ACCOUNT_KEY = process.env.FCM_SERVICE_ACCOUNT_KEY;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Parse the service account key from env.
 * Returns null if not configured or malformed.
 */
function getServiceAccountKey(): ServiceAccountKey | null {
  if (!FCM_SERVICE_ACCOUNT_KEY) return null;
  try {
    const parsed = JSON.parse(FCM_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    logger.warn("FCM_SERVICE_ACCOUNT_KEY is not valid JSON");
    return null;
  }
}

/**
 * Create a signed JWT for Google OAuth2 token exchange.
 * Uses the Web Crypto API (available in Node 18+ and Edge Runtime).
 */
async function createSignedJwt(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload as unknown as Record<string, unknown>);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the PEM private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binaryKey = Buffer.from(pemContents, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = Buffer.from(signature).toString("base64url");
  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Get a valid OAuth2 access token for FCM API calls.
 * Caches the token until 5 minutes before expiry.
 */
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300_000) {
    return cachedAccessToken.token;
  }

  const jwt = await createSignedJwt(serviceAccount);
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM token exchange failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  return cachedAccessToken.token;
}

// ─── FCM send ───────────────────────────────────────────

interface FcmError {
  error?: {
    details?: Array<{
      errorCode?: string;
    }>;
  };
}

/**
 * Send a single push notification via FCM HTTP v1 API.
 * Returns true on success, false if the token should be removed.
 */
async function sendFcmMessage(
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

  const message: Record<string, unknown> = {
    token: deviceToken,
    notification: { title, body },
  };

  if (data && Object.keys(data).length > 0) {
    message.data = data;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (res.ok) return true;

  // Check for stale token error
  const errorBody = (await res.json().catch(() => ({}))) as FcmError;
  const errorCode = errorBody?.error?.details?.[0]?.errorCode;

  if (
    res.status === 404 ||
    errorCode === "UNREGISTERED" ||
    errorCode === "INVALID_ARGUMENT"
  ) {
    // Token is stale — caller should remove it
    return false;
  }

  logger.warn("FCM send failed", {
    status: res.status,
    errorCode,
    deviceToken: deviceToken.slice(0, 12) + "...",
  });

  return true; // Non-stale error — don't remove token
}

// ─── Public API ─────────────────────────────────────────

/**
 * Send a push notification to all devices registered by the given user.
 * Gracefully degrades if FCM is not configured — logs a warning and returns.
 * Automatically removes stale device tokens.
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT_KEY) {
    logger.debug("Push notification skipped — FCM not configured", { userId });
    return;
  }

  const serviceAccount = getServiceAccountKey();
  if (!serviceAccount) {
    logger.warn("Push notification skipped — invalid FCM service account key");
    return;
  }

  const devices = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (devices.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (err) {
    logger.error("Failed to get FCM access token", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const staleTokenIds: string[] = [];

  await Promise.allSettled(
    devices.map(async (device) => {
      const success = await sendFcmMessage(accessToken, device.token, title, body, data);
      if (!success) {
        staleTokenIds.push(device.id);
      }
    })
  );

  // Clean up stale tokens
  if (staleTokenIds.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { id: { in: staleTokenIds } },
      });
      logger.info("Removed stale device tokens", {
        userId,
        count: staleTokenIds.length,
      });
    } catch (err) {
      logger.warn("Failed to remove stale device tokens", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
