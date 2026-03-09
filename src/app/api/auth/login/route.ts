import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonRateLimited } from "@/lib/api-helpers";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { mintSessionToken } from "@/lib/mobile-session";
import { getClientIp, verifyTotpCode } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { BCRYPT_SALT_ROUNDS } from "@/lib/constants";
import { logger } from "@/lib/logger";

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sanbao.local";

/**
 * POST /api/auth/login
 * Email/password login with optional 2FA.
 * Body: { email, password, totpCode? }
 * Returns: { token, user, expiresAt } or { error, code? }
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const rateCheck = await checkAuthRateLimit(`login:${ip}`);
    if (!rateCheck.allowed) {
      return jsonRateLimited(rateCheck.retryAfterSeconds);
    }

    const body = await req.json();
    const { email, password, totpCode } = body as {
      email?: string;
      password?: string;
      totpCode?: string;
    };

    if (!email || !password) {
      return jsonError("Email and password are required", 400);
    }

    const login = email.trim().toLowerCase();

    // ─── Admin credentials ───
    if (
      ADMIN_PASSWORD &&
      (login === ADMIN_LOGIN || login === ADMIN_EMAIL) &&
      password.length === ADMIN_PASSWORD.length &&
      timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD))
    ) {
      const admin = await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: { role: "ADMIN" },
        create: {
          email: ADMIN_EMAIL,
          name: "Администратор",
          password: await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS),
          role: "ADMIN",
        },
      });

      // 2FA check for admin
      if (admin.twoFactorEnabled && admin.twoFactorSecret) {
        if (!totpCode) {
          return NextResponse.json(
            { error: "2FA code required", code: "2FA_REQUIRED" },
            { status: 403 }
          );
        }
        const valid = await verifyTotpCode(admin.twoFactorSecret, totpCode);
        if (!valid) {
          return NextResponse.json(
            { error: "Invalid 2FA code", code: "2FA_INVALID" },
            { status: 403 }
          );
        }
      }

      const session = await mintSessionToken({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        image: admin.image,
        role: admin.role,
        twoFactorVerified: admin.twoFactorEnabled || false,
      });

      return jsonOk({
        token: session.token,
        user: { id: admin.id, email: admin.email, name: admin.name },
        expiresAt: session.expiresAt,
      });
    }

    // ─── Regular user ───
    const user = await prisma.user.findUnique({ where: { email: login } });

    if (!user || !user.password) {
      return jsonError("Invalid email or password", 401);
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Account is banned", code: "BANNED" },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return jsonError("Invalid email or password", 401);
    }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        return NextResponse.json(
          { error: "2FA code required", code: "2FA_REQUIRED" },
          { status: 403 }
        );
      }
      const valid = await verifyTotpCode(user.twoFactorSecret, totpCode);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid 2FA code", code: "2FA_INVALID" },
          { status: 403 }
        );
      }
    }

    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });

    return jsonOk({
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
    logger.error("Login error", { context: "AUTH:LOGIN", error: error instanceof Error ? error.message : String(error) });
    return jsonError("Internal server error", 500);
  }
}
