import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlanAndUsage } from "@/lib/usage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, usage, subscription, monthlyUsage, expired } = await getUserPlanAndUsage(
    session.user.id
  );

  return NextResponse.json({
    expired,
    plan: plan
      ? {
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          messagesPerDay: plan.messagesPerDay,
          tokensPerMessage: plan.tokensPerMessage,
          tokensPerMonth: plan.tokensPerMonth,
          requestsPerMinute: plan.requestsPerMinute,
          contextWindowSize: plan.contextWindowSize,
          maxConversations: plan.maxConversations,
          maxAgents: plan.maxAgents,
          documentsPerMonth: plan.documentsPerMonth,
          canUseAdvancedTools: plan.canUseAdvancedTools,
          canUseReasoning: plan.canUseReasoning,
          canUseRag: plan.canUseRag,
          canUseGraph: plan.canUseGraph,
          canChooseProvider: plan.canChooseProvider,
        }
      : null,
    subscription: subscription
      ? {
          grantedAt: subscription.createdAt,
          expiresAt: subscription.expiresAt,
          trialEndsAt: (subscription as Record<string, unknown>).trialEndsAt || null,
          isTrial: !!(subscription as Record<string, unknown>).trialEndsAt && new Date((subscription as Record<string, unknown>).trialEndsAt as string) > new Date(),
        }
      : null,
    usage: {
      messageCount: usage?.messageCount || 0,
      tokenCount: usage?.tokenCount || 0,
    },
    monthlyUsage: {
      tokenCount: monthlyUsage.tokenCount,
      messageCount: monthlyUsage.messageCount,
    },
  });
}
