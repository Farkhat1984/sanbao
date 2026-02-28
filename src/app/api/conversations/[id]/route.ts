import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { conversationUpdateSchema } from "@/lib/validation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // cursor for older messages

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        ...(before ? { cursor: { id: before }, skip: 1 } : {}),
        include: {
          legalRefs: true,
          artifacts: true,
        },
      },
    },
  });

  if (!conversation) {
    return jsonError("Not found", 404);
  }

  // Reverse to chronological order for client
  conversation.messages.reverse();

  return jsonOk(conversation);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = conversationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Invalid data", 400);
  }

  const conversation = await prisma.conversation.updateMany({
    where: { id, userId },
    data: parsed.data,
  });

  return jsonOk(conversation);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  await prisma.conversation.deleteMany({
    where: { id, userId },
  });

  return jsonOk({ success: true });
}
