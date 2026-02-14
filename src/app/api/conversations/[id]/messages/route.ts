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

  const created = await prisma.message.createMany({
    data: messages.map((m: { role: string; content: string }) => ({
      conversationId,
      role: m.role as "USER" | "ASSISTANT" | "SYSTEM" | "TOOL",
      content: m.content,
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

  return NextResponse.json({ count: created.count });
}
