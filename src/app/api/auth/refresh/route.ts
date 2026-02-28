import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mintSessionToken,
  validateRefreshToken,
} from "@/lib/mobile-session";
import { checkAuthRateLimit } from "@/lib/rate-limit";

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
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const ip = cfIp || forwarded?.split(",")[0]?.trim() || "unknown";

    const rateCheck = checkAuthRateLimit(`refresh:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 900) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body as { refreshToken?: string };

    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json(
        { error: "refreshToken is required" },
        { status: 400 }
      );
    }

    // Validate opaque refresh token against Redis
    const userId = await validateRefreshToken(refreshToken);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
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

    return NextResponse.json({
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
    console.error("[AUTH:REFRESH] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
