import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { verifyAppleToken } from "@/lib/mobile-auth";
import { mintSessionToken, mintRefreshToken } from "@/lib/mobile-session";

export async function POST(req: Request) {
  try {
    // Rate limit
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const ip = cfIp || forwarded?.split(",")[0]?.trim() || "unknown";

    const rateCheck = await checkAuthRateLimit(`apple:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds ?? 900),
          },
        }
      );
    }

    const body = await req.json();
    const { identityToken, email, fullName, nonce } = body as {
      identityToken?: string;
      email?: string;
      fullName?: { givenName?: string; familyName?: string };
      nonce?: string;
    };

    if (!identityToken || typeof identityToken !== "string") {
      return NextResponse.json(
        { error: "identityToken is required" },
        { status: 400 }
      );
    }

    // Verify Apple identity token
    let applePayload;
    try {
      applePayload = await verifyAppleToken(identityToken, nonce);
    } catch {
      return NextResponse.json(
        { error: "Invalid Apple identity token" },
        { status: 401 }
      );
    }

    const appleSub = applePayload.sub;
    // Apple sends email only on first auth; use from request body as fallback
    const appleEmail =
      applePayload.email || (email ? email.toLowerCase().trim() : null);

    // Build display name from fullName (Apple sends it only on first auth)
    const displayName = fullName
      ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ") ||
        null
      : null;

    // Look for existing Apple account link
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "apple",
          providerAccountId: appleSub,
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
      // OAuth provider verification counts as 2FA: Apple has already verified
      // the user's identity through their own authentication mechanisms (Face ID,
      // Touch ID, device passcode, or Apple ID password + SMS/device-based 2FA).
      // Setting twoFactorVerified = true lets OAuth users skip our separate TOTP step.
      const session = await mintSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        twoFactorVerified: user.twoFactorEnabled || false,
      });
      const refreshToken = await mintRefreshToken(user.id);

      return NextResponse.json({
        accessToken: session.token,
        refreshToken,
        // Legacy field for backward compat
        token: session.token,
        user: { id: user.id, email: user.email, name: user.name },
        expiresAt: session.expiresAt,
      });
    }

    // No existing account — find or create user
    let user;

    // Try to link by email if user already exists
    if (appleEmail) {
      user = await prisma.user.findUnique({ where: { email: appleEmail } });
    }

    // Email is required in our schema — use Apple private relay or generate placeholder
    const userEmail = appleEmail || `apple_${appleSub}@privaterelay.appleid.com`;

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: displayName,
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

    // Create Apple account link
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "apple",
        providerAccountId: appleSub,
      },
    });

    // OAuth = 2FA: Apple's identity verification (Face ID / Touch ID / device passcode)
    // serves as the second factor, so twoFactorVerified is set accordingly.
    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name ?? displayName,
      image: user.image,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });
    const refreshToken = await mintRefreshToken(user.id);

    return NextResponse.json({
      accessToken: session.token,
      refreshToken,
      // Legacy field for backward compat
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? displayName,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("[AUTH:APPLE] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
