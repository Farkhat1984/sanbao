import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      price: true,
      messagesPerDay: true,
      tokensPerMessage: true,
      tokensPerMonth: true,
      requestsPerMinute: true,
      contextWindowSize: true,
      maxConversations: true,
      maxAgents: true,
      documentsPerMonth: true,
      canUseAgents: true,
      canUseMultiAgents: true,
      canUseIntegrations: true,
      canUseMcp: true,
      canUseReasoning: true,
      canUseSkills: true,
      canUseRag: true,
      canUseGraph: true,
      canChooseProvider: true,
      maxOrganizations: true,
      highlighted: true,
    },
  });

  return jsonOk(plans);
}
