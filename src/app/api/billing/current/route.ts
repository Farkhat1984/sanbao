import { getUserPlanAndUsage } from "@/lib/usage";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

  const { plan, usage, subscription, monthlyUsage, expired } = await getUserPlanAndUsage(
    userId
  );

  return jsonOk({
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
          canUseSkills: plan.canUseSkills,
          canUseRag: plan.canUseRag,
          canUseGraph: plan.canUseGraph,
          canChooseProvider: plan.canChooseProvider,
          maxOrganizations: plan.maxOrganizations,
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
