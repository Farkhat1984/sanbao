import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      canUseRag: true,
      canUseGraph: true,
      canChooseProvider: true,
      highlighted: true,
    },
  });

  return NextResponse.json(plans);
}
