import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { verifyGoogleIdToken } from "@/lib/mobile-auth";
import { mintSessionToken } from "@/lib/mobile-session";

export async function POST(req: Request) {
  try {
    // Rate limit
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const ip = cfIp || forwarded?.split(",")[0]?.trim() || "unknown";

    const rateCheck = checkAuthRateLimit(`google-mobile:${ip}`);
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
    const { idToken } = body as { idToken?: string };

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "idToken is required" },
        { status: 400 }
      );
    }

    // Verify Google ID token
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid Google ID token" },
        { status: 401 }
      );
    }

    const googleSub = googlePayload.sub;
    const googleEmail = googlePayload.email?.toLowerCase().trim() ?? null;
    const googleName = googlePayload.name ?? null;
    const googlePicture = googlePayload.picture ?? null;

    // Look for existing Google account link (same provider as web OAuth)
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleSub,
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
    }

    // No existing account — find or create user
    let user;

    if (googleEmail) {
      user = await prisma.user.findUnique({ where: { email: googleEmail } });
    }

    if (!googleEmail) {
      return NextResponse.json(
        { error: "Google account has no email" },
        { status: 400 }
      );
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleEmail,
          name: googleName,
          image: googlePicture,
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

    // Create Google account link
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: googleSub,
      },
    });

    const session = await mintSessionToken({
      id: user.id,
      email: user.email,
      name: user.name ?? googleName,
      image: user.image ?? googlePicture,
      role: user.role,
      twoFactorVerified: user.twoFactorEnabled || false,
    });

    return NextResponse.json({
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? googleName,
        image: user.image ?? googlePicture,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("[AUTH:GOOGLE-MOBILE] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
