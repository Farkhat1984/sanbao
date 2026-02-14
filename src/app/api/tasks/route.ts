import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "FAILED" } : {}),
    },
    include: {
      conversation: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    steps: t.steps,
    status: t.status,
    progress: t.progress,
    conversationId: t.conversationId,
    conversationTitle: t.conversation?.title || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, steps, conversationId } = await req.json();

  if (!title?.trim() || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json(
      { error: "Название и шаги обязательны" },
      { status: 400 }
    );
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      steps,
      conversationId: conversationId || null,
      progress: 0,
    },
  });

  return NextResponse.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
}
