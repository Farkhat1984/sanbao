import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAgentContext } from "@/lib/tool-resolver";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ownership check: user can only access their own agents or system agents
  const agent = await prisma.agent.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { isSystem: true },
      ],
    },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

  const ctx = await resolveAgentContext(id);

  let tools = ctx.promptTools;

  if (typeFilter) {
    // Filter by tool type string (e.g., "PROMPT_TEMPLATE")
    // Since promptTools are all PROMPT_TEMPLATE, this is future-proofing
    tools = tools.filter((tool) => tool.type === typeFilter);
  }

  return NextResponse.json(tools);
}
