import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlanAndUsage } from "@/lib/usage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, usage, subscription } = await getUserPlanAndUsage(
    session.user.id
  );

  return NextResponse.json({
    plan: plan
      ? {
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          messagesPerDay: plan.messagesPerDay,
          tokensPerMessage: plan.tokensPerMessage,
          requestsPerMinute: plan.requestsPerMinute,
          contextWindowSize: plan.contextWindowSize,
          maxConversations: plan.maxConversations,
          canUseAdvancedTools: plan.canUseAdvancedTools,
          canChooseProvider: plan.canChooseProvider,
        }
      : null,
    subscription: subscription
      ? {
          grantedAt: subscription.createdAt,
          expiresAt: subscription.expiresAt,
        }
      : null,
    usage: {
      messageCount: usage?.messageCount || 0,
      tokenCount: usage?.tokenCount || 0,
    },
  });
}
