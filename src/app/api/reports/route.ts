import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonError("Invalid JSON", 400);
  }
  const { targetType, targetId, reason } = body;

  if (!targetType || !targetId || !reason) {
    return jsonError("targetType, targetId, reason required", 400);
  }

  if (!["agent", "skill"].includes(targetType)) {
    return jsonError("targetType must be agent or skill", 400);
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
    return jsonError("Жалоба уже отправлена", 409);
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId: session.user.id,
      targetType,
      targetId,
      reason,
    },
  });

  return jsonOk(report, 201);
}
