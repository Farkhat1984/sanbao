import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
