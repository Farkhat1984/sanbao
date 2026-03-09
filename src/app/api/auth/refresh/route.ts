import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonRateLimited } from "@/lib/api-helpers";
import {
  mintSessionToken,
  validateRefreshToken,
} from "@/lib/mobile-session";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/refresh
 * Accepts { refreshToken }, validates it against Redis,
 * returns a new access token + same refresh token (sliding window).
 *
 * Backward compatibility: also accepts { token } (old JWT-based refresh)
 * and Authorization header for a transition period.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const rateCheck = await checkAuthRateLimit(`refresh:${ip}`);
    if (!rateCheck.allowed) {
      return jsonRateLimited(rateCheck.retryAfterSeconds);
    }

    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body as { refreshToken?: string };

    if (!refreshToken || typeof refreshToken !== "string") {
      return jsonError("refreshToken is required", 400);
    }

    // Validate opaque refresh token against Redis
    const userId = await validateRefreshToken(refreshToken);
    if (!userId) {
      return jsonError("Invalid or expired refresh token", 401);
    }

    // Validate user still exists and is not banned
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isBanned: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return jsonError("User not found", 401);
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Account is banned", code: "BANNED" },
        { status: 403 }
      );
    }

    // Mint fresh short-lived access token
    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });

    // Optionally rotate refresh token (if Redis available, mint a new one)
    // For now, we use sliding window — same token, TTL extended in validateRefreshToken()
    const newRefreshToken = refreshToken;

    return jsonOk({
      accessToken: session.token,
      refreshToken: newRefreshToken,
      // Legacy field for backward compat
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    logger.error("Token refresh error", { context: "AUTH:REFRESH", error: error instanceof Error ? error.message : String(error) });
    return jsonError("Internal server error", 500);
  }
}
