import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/me
 * Returns authenticated user profile with subscription tier.
 * Requires Bearer token (proxy.ts bridges to session cookie).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        locale: true,
        twoFactorEnabled: true,
        isBanned: true,
        subscription: {
          select: {
            plan: {
              select: {
                id: true,
                slug: true,
                name: true,
                messagesPerDay: true,
                tokensPerMessage: true,
                tokensPerMonth: true,
                maxConversations: true,
                maxAgents: true,
                canUseAdvancedTools: true,
                canUseReasoning: true,
                canUseRag: true,
              },
            },
            expiresAt: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Account is banned", code: "BANNED" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        locale: user.locale,
        twoFactorEnabled: user.twoFactorEnabled,
        subscription: user.subscription
          ? {
              plan: user.subscription.plan,
              expiresAt: user.subscription.expiresAt,
              trialEndsAt: user.subscription.trialEndsAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[AUTH:ME] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
