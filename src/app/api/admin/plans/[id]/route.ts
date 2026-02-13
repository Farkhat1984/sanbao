import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const allowedFields = [
    "name",
    "description",
    "price",
    "messagesPerDay",
    "tokensPerMessage",
    "tokensPerMonth",
    "requestsPerMinute",
    "contextWindowSize",
    "maxConversations",
    "maxAgents",
    "documentsPerMonth",
    "canUseAdvancedTools",
    "canUseReasoning",
    "canUseRag",
    "canUseGraph",
    "canChooseProvider",
    "isDefault",
    "sortOrder",
    "highlighted",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (data.isDefault === true) {
    await prisma.plan.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.plan.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
