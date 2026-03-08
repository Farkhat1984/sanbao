import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

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
      canUseAdvancedTools: true,
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
