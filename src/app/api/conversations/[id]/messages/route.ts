import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementTokens } from "@/lib/usage";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { getSettingNumber } from "@/lib/settings";
import { DEFAULT_CONVERSATION_TITLE } from "@/lib/constants";
import { sendPush } from "@/lib/push";
import { fireAndForget } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { id: conversationId } = await params;

  // Verify ownership
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
    select: { id: true },
  });

  if (!conversation) {
    return jsonError("Not found", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonError("Invalid JSON", 400);
  }
  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("No messages", 400);
  }

  // Limit batch size and individual message size
  const [batchMax, maxMsgSize] = await Promise.all([
    getSettingNumber('chat_messages_batch_max'),
    getSettingNumber('chat_max_msg_size_bytes'),
  ]);
  if (messages.length > batchMax) {
    return jsonError("Too many messages in batch", 400);
  }
  const ALLOWED_ROLES = new Set(["USER", "ASSISTANT"]);
  const MAX_MSG_SIZE = maxMsgSize;
  for (const m of messages) {
    if (typeof m.content === "string" && m.content.length > MAX_MSG_SIZE) {
      return jsonError("Message too large", 400);
    }
    // Prevent role injection — clients can only submit USER and ASSISTANT messages
    if (!ALLOWED_ROLES.has(m.role)) {
      return jsonError("Invalid message role", 400);
    }
  }

  const created = await prisma.message.createMany({
    data: messages.map((m: { role: string; content: string }) => ({
      conversationId,
      role: m.role as "USER" | "ASSISTANT",
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
      updateData.title = firstUserMsg.content.slice(0, 60) || DEFAULT_CONVERSATION_TITLE;
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

    // Send push notification for assistant response (fire-and-forget)
    const pushTitle = "Sanbao AI";
    const pushBody = assistantMsg.content.length > 100
      ? assistantMsg.content.slice(0, 100) + "..."
      : assistantMsg.content;
    fireAndForget(
      sendPush(session.user.id, pushTitle, pushBody, { conversationId }),
      "push-notification"
    );
  }

  return jsonOk({ count: created.count });
}
