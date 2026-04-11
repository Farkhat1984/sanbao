// ─── Shared auth utilities ────────────────────────────────
// Extracted from auth routes to eliminate duplication.

import { prisma } from "@/lib/prisma";
import { mintSessionToken, mintRefreshToken } from "@/lib/mobile-session";
import { decrypt } from "@/lib/crypto";

/**
 * Extract the client IP address from request headers.
 * Priority: cf-connecting-ip (Cloudflare) > x-forwarded-for (proxy) > "unknown".
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

/**
 * Verify a TOTP code against an encrypted 2FA secret.
 * Uses dynamic import of otplib to keep it out of the client bundle.
 */
export async function verifyTotpCode(encryptedSecret: string, code: string): Promise<boolean> {
  const { OTP } = await import("otplib");
  const otpInstance = new OTP();
  const decryptedSecret = decrypt(encryptedSecret);
  const result = await otpInstance.verify({ token: code, secret: decryptedSecret });
  return result.valid;
}

interface OAuthLoginParams {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  image?: string | null;
  /** Fallback email when provider doesn't supply one (e.g. Apple private relay). */
  fallbackEmail?: string;
}

interface OAuthLoginResult {
  user: { id: string; email: string; name: string | null; image: string | null };
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

/**
 * Shared OAuth login flow: look up existing account link, or create user + link.
 * Handles free plan auto-assignment for new users and session token minting.
 */
export async function handleOAuthLogin(params: OAuthLoginParams): Promise<OAuthLoginResult> {
  const { provider, providerAccountId, email, name, image, fallbackEmail } = params;

  // 1. Look for existing provider account link
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          twoFactorEnabled: true,
        },
      },
    },
  });

  if (existingAccount) {
    const user = existingAccount.user;
    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });
    const refreshToken = await mintRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
      accessToken: session.token,
      refreshToken,
      expiresAt: session.expiresAt,
    };
  }

  // 2. No existing account link — find or create user
  let user;

  // Only auto-link by email if user exists but has NO OAuth accounts
  // (i.e., was created via credentials). Never merge two OAuth identities.
  if (email) {
    const candidate = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { where: { type: "oauth" }, select: { id: true }, take: 1 } },
    });
    if (candidate && candidate.accounts.length === 0) {
      // Credentials-only user — safe to link this OAuth account
      user = candidate;
    }
    // If candidate has existing OAuth accounts, do NOT auto-link — create new user below
  }

  // Email is required in our schema — use fallback if provider doesn't supply one
  const userEmail = email || fallbackEmail;
  if (!userEmail) {
    throw new OAuthEmailRequiredError();
  }

  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name,
        image: image ?? null,
        emailVerified: new Date(),
      },
    });

    // Auto-assign free subscription
    const freePlan = await prisma.plan.findFirst({
      where: { isDefault: true },
    });
    if (freePlan) {
      await prisma.subscription.create({
        data: { userId: user.id, planId: freePlan.id },
      });
    }
  }

  // 3. Create provider account link
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "oauth",
      provider,
      providerAccountId,
    },
  });

  // OAuth = 2FA: provider's identity verification (Face ID / Touch ID / passkeys)
  // serves as the second factor, so twoFactorVerified is set accordingly.
  const session = await mintSessionToken({
    id: user.id,
    email: user.email,
    name: user.name ?? name,
    image: user.image ?? image ?? null,
    role: user.role,
    twoFactorVerified: user.twoFactorEnabled || false,
  });
  const refreshToken = await mintRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? name,
      image: user.image ?? image ?? null,
    },
    accessToken: session.token,
    refreshToken,
    expiresAt: session.expiresAt,
  };
}

/** Thrown when OAuth provider does not supply an email and no fallback is available. */
export class OAuthEmailRequiredError extends Error {
  constructor() {
    super("OAuth account has no email");
    this.name = "OAuthEmailRequiredError";
  }
}
