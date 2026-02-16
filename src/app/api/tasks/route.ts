import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(status ? { status: status as "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "FAILED" } : {}),
    },
    include: {
      conversation: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return jsonOk(tasks.map((t) => ({
    id: t.id,
    title: t.title,
    steps: t.steps,
    status: t.status,
    progress: t.progress,
    conversationId: t.conversationId,
    conversationTitle: t.conversation?.title || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { title, steps, conversationId } = body;

  if (!title?.trim() || !Array.isArray(steps) || steps.length === 0) {
    return jsonError("Название и шаги обязательны", 400);
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: title.trim(),
      steps,
      conversationId: conversationId || null,
      progress: 0,
    },
  });

  return jsonOk({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }, 201);
}
