import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { SkillStatus } from "@prisma/client";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as SkillStatus | null;

  const where: Record<string, unknown> = { isPublic: true };
  if (status) where.status = status;

  const agents = await prisma.agent.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(agents);
}

export async function PUT(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { agentId, status } = await req.json();

  if (!agentId || !status) {
    return NextResponse.json({ error: "agentId and status required" }, { status: 400 });
  }

  // Validate status against allowed SkillStatus enum values
  const ALLOWED_STATUSES = ["PENDING", "APPROVED", "REJECTED"];
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
  }

  const agent = await prisma.agent.update({
    where: { id: agentId },
    data: { status },
  });

  return NextResponse.json(agent);
}
