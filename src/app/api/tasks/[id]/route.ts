import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: { conversation: { select: { title: true } } },
  });

  if (!task) {
    return jsonError("Не найдено", 404);
  }

  return jsonOk(serializeDates({
    id: task.id,
    title: task.title,
    steps: task.steps,
    status: task.status,
    progress: task.progress,
    conversationId: task.conversationId,
    conversationTitle: task.conversation?.title || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.task.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найдено", 404);
  }

  const body = await req.json();
  const { steps, status } = body;

  // Calculate progress from steps
  let progress = existing.progress;
  if (steps && Array.isArray(steps)) {
    const doneCount = steps.filter((s: { done: boolean }) => s.done).length;
    progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;
  }

  // Auto-complete if all steps done
  let finalStatus = status || existing.status;
  if (steps && Array.isArray(steps)) {
    const allDone = steps.every((s: { done: boolean }) => s.done);
    if (allDone && finalStatus === "IN_PROGRESS") {
      finalStatus = "COMPLETED";
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(steps !== undefined && { steps }),
      status: finalStatus,
      progress,
    },
  });

  return jsonOk(serializeDates(task));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const existing = await prisma.task.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return jsonError("Не найдено", 404);
  }

  await prisma.task.delete({ where: { id } });

  return jsonOk({ success: true });
}
