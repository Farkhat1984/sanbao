import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

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
      reporterId: userId,
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
      reporterId: userId,
      targetType,
      targetId,
      reason,
    },
  });

  return jsonOk(report, 201);
}
