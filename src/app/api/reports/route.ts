import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetType, targetId, reason } = await req.json();

  if (!targetType || !targetId || !reason) {
    return NextResponse.json({ error: "targetType, targetId, reason required" }, { status: 400 });
  }

  if (!["agent", "skill"].includes(targetType)) {
    return NextResponse.json({ error: "targetType must be agent or skill" }, { status: 400 });
  }

  // Prevent duplicate reports from same user
  const existing = await prisma.contentReport.findFirst({
    where: {
      reporterId: session.user.id,
      targetType,
      targetId,
      status: "PENDING",
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Жалоба уже отправлена" }, { status: 409 });
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId: session.user.id,
      targetType,
      targetId,
      reason,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
