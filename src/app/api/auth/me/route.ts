import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/me
 * Returns authenticated user profile with subscription tier.
 * Requires Bearer token (proxy.ts bridges to session cookie).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
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
                canUseAgents: true,
                canUseOrganizations: true,
                canUseIntegrations: true,
                canUseMcp: true,
                canUseReasoning: true,
                canUseSkills: true,
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
      return jsonError("User not found", 404);
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Account is banned", code: "BANNED" },
        { status: 403 }
      );
    }

    return jsonOk({
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
    logger.error("[AUTH:ME] error", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("Internal server error", 500);
  }
}
