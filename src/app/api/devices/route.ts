/**
 * Device token registration API for push notifications.
 *
 * POST /api/devices — Register (upsert) a device token
 * DELETE /api/devices — Unregister a device token
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const VALID_PLATFORMS = new Set(["ios", "android", "web"]);
const MAX_TOKEN_LENGTH = 4096;

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);

  const { token, platform } = body as { token?: string; platform?: string };

  if (!token || typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return jsonError("Invalid device token", 400);
  }

  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return jsonError("Platform must be one of: ios, android, web", 400);
  }

  try {
    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });

    logger.info("Device token registered", {
      userId,
      platform,
      tokenPrefix: token.slice(0, 12) + "...",
    });

    return jsonOk({ success: true });
  } catch (err) {
    logger.error("Failed to register device token", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return jsonError("Failed to register device", 500);
  }
}

export async function DELETE(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);

  const { token } = body as { token?: string };

  if (!token || typeof token !== "string") {
    return jsonError("Token is required", 400);
  }

  try {
    // Only delete if the token belongs to the requesting user
    await prisma.deviceToken.deleteMany({
      where: { token, userId },
    });

    logger.info("Device token unregistered", {
      userId,
      tokenPrefix: token.slice(0, 12) + "...",
    });

    return jsonOk({ success: true });
  } catch (err) {
    logger.error("Failed to unregister device token", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return jsonError("Failed to unregister device", 500);
  }
}
