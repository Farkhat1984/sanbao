import { NextResponse } from "next/server";
import { decode } from "@auth/core/jwt";
import { prisma } from "@/lib/prisma";
import { mintSessionToken } from "@/lib/mobile-session";
import { checkAuthRateLimit } from "@/lib/rate-limit";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

/**
 * POST /api/auth/refresh
 * Decodes current JWT, validates user, mints new token pair.
 * Body: { token } or uses Authorization header.
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

    // Get token from body or Authorization header
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const token =
      (body as { token?: string }).token ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Decode the existing JWT
    let payload;
    try {
      payload = await decode({ salt: SESSION_COOKIE, secret, token });
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!payload?.id && !payload?.sub) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 }
      );
    }

    const userId = (payload.id as string) || (payload.sub as string);

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

    // Mint fresh token
    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });

    return NextResponse.json({
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
