import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { splitMessagesForCompaction } from "@/lib/context";
import { compactInBackground } from "@/lib/services/compaction-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
  });

  if (!conversation) {
    return jsonError("Диалог не найден", 404);
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  if (messages.length < 4) {
    return jsonError("Недостаточно сообщений для сжатия", 400);
  }

  const summary = await prisma.conversationSummary.findUnique({
    where: { conversationId: id },
  });

  const mapped = messages.map((m) => ({
    role: m.role.toLowerCase(),
    content: m.content,
  }));

  const { messagesToSummarize, messagesToKeep } =
    await splitMessagesForCompaction(mapped, 6);

  if (messagesToSummarize.length === 0) {
    return jsonError("Нечего сжимать", 400);
  }

  compactInBackground(
    id,
    summary?.content ?? null,
    messagesToSummarize,
    2048,
    userId
  );

  return jsonOk({
    success: true,
    messagesSummarized: messagesToSummarize.length,
    messagesKept: messagesToKeep.length,
  });
}
