import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementTokens } from "@/lib/usage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify ownership
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  // Limit batch size and individual message size
  if (messages.length > 50) {
    return NextResponse.json({ error: "Too many messages in batch" }, { status: 400 });
  }
  const MAX_MSG_SIZE = 200_000; // 200KB per message
  for (const m of messages) {
    if (typeof m.content === "string" && m.content.length > MAX_MSG_SIZE) {
      return NextResponse.json({ error: "Message too large" }, { status: 400 });
    }
  }

  const created = await prisma.message.createMany({
    data: messages.map((m: { role: string; content: string; planContent?: string }) => ({
      conversationId,
      role: m.role as "USER" | "ASSISTANT" | "SYSTEM" | "TOOL",
      content: m.content,
      planContent: m.planContent || null,
    })),
  });

  // Update conversation's updatedAt and title if it's the first message
  const msgCount = await prisma.message.count({ where: { conversationId } });
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  // Auto-title from first user message
  if (msgCount <= 2) {
    const firstUserMsg = messages.find((m: { role: string }) => m.role === "USER");
    if (firstUserMsg) {
      updateData.title = firstUserMsg.content.slice(0, 60) || "Новый чат";
    }
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: updateData,
  });

  // Track output token usage from assistant response
  const assistantMsg = messages.find((m: { role: string }) => m.role === "ASSISTANT");
  if (assistantMsg?.content) {
    const outputTokens = Math.ceil(assistantMsg.content.length / 3);
    await incrementTokens(session.user.id, outputTokens);
  }

  // Save planning data if present
  const planContent = assistantMsg?.planContent;
  if (planContent && conversationId) {
    try {
      // Extract key decisions from plan content
      const decisionsMatch = planContent.match(
        /\*\*(?:Ключевые решения|Решения|Контекст)[:\s]*\*\*([\s\S]*?)(?=\n##|\n\*\*|$)/i
      );
      const decisions = decisionsMatch?.[1]?.trim() || "";

      // Get existing active plan to merge memory
      const existing = await prisma.conversationPlan.findFirst({
        where: { conversationId, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      const newMemory = existing?.memory && decisions
        ? `${existing.memory}\n\n--- Обновление ---\n${decisions}`
        : decisions || existing?.memory || null;

      // Atomically deactivate previous plans and create new one
      await prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.conversationPlan.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
        }
        await tx.conversationPlan.create({
          data: {
            conversationId,
            content: planContent,
            memory: newMemory,
            isActive: true,
          },
        });
      });
    } catch {
      // Plan persistence is best-effort
    }
  }

  return NextResponse.json({ count: created.count });
}
